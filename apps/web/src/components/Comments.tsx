"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import {
  STATUS_LABEL,
  type Activity,
  type Attachment,
  type Comment,
  type CommentTarget,
  type Person,
  type Status,
} from "@/data/model";
import { fmtSize, MAX_FILE_BYTES } from "@/lib/files";
import { api, ApiError } from "@/lib/api";
import { fmtAgo, fmtStamp } from "@/lib/graph";
import { useStore } from "@/lib/store";
import { Avatar } from "./nodes";
import { StatusIcon } from "./Picker";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function mentionRegex(people: Person[]) {
  return new RegExp(`(@(?:${people.map((p) => esc(p.name)).join("|")}))`, "g");
}

export const commentsOn = (comments: Comment[], t: CommentTarget) =>
  comments.filter((c) => c.target.kind === t.kind && c.target.id === t.id);

function Body({ text }: { text: string }) {
  const { state } = useStore();
  const names = new Set(state.graph.people.map((p) => `@${p.name}`));
  return (
    <p className="cm-text">
      {text.split(mentionRegex(state.graph.people)).map((part, i) =>
        names.has(part) ? (
          <span key={i} className="mention">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </p>
  );
}

export const activityOn = (activity: Activity[], t: CommentTarget) =>
  activity.filter((a) => a.target.kind === t.kind && a.target.id === t.id);

const NOUN = { ticket: "task", feature: "feature", bug: "bug" } as const;

function StatusChip({ s }: { s: string | null | undefined }) {
  if (!s) return null;
  return (
    <span className={`log-chip tone-${s}`}>
      <StatusIcon status={s as Status} />
      {STATUS_LABEL[s as Status]}
    </span>
  );
}

/** One automatic log line: created, moved, assigned. */
function LogRow({ a, noun }: { a: Activity; noun: string }) {
  const { state } = useStore();
  const name = (id: string | null | undefined) =>
    state.graph.people.find((p) => p.id === id)?.name ?? "Someone";
  let what: React.ReactNode;
  let icon: React.ReactNode;
  if (a.kind === "created") {
    icon = <span className="log-ico created">+</span>;
    what = <>{noun === "bug" ? "reported this bug" : `created this ${noun}`}</>;
  } else if (a.kind === "status") {
    icon = (
      <span className="log-ico">{<StatusIcon status={a.to as Status} />}</span>
    );
    what = (
      <>
        moved this from <StatusChip s={a.from} /> to <StatusChip s={a.to} />
      </>
    );
  } else {
    icon = (
      <span className="log-ico">
        <Avatar personId={a.to ?? null} size={18} />
      </span>
    );
    what = !a.to ? (
      <>
        unassigned <b>{name(a.from)}</b>
      </>
    ) : a.from ? (
      <>
        reassigned this from <b>{name(a.from)}</b> to <b>{name(a.to)}</b>
      </>
    ) : (
      <>
        assigned this to <b>{name(a.to)}</b>
      </>
    );
  }
  return (
    <li className="log-row">
      {icon}
      <p>
        <b>{a.actorId ? name(a.actorId) : "Zelo"}</b> {what}
        <time dateTime={a.at} title={fmtAgo(a.at)}>
          {fmtStamp(a.at)}
        </time>
      </p>
    </li>
  );
}

const isImage = (a: Attachment) => a.type.startsWith("image/");

function FileIcon({ a }: { a: Attachment }) {
  const ext = (a.name.split(".").pop() ?? "file").slice(0, 4).toUpperCase();
  return <span className="file-ico">{ext}</span>;
}

/** Loads a stored file and shows it: images as thumbnails (click to enlarge), others as a download chip. */
function AttachmentView({
  a,
  onRemove,
  local,
}: {
  a: Attachment;
  onRemove?: () => void;
  local?: string;
}) {
  // Files are served by the API to workspace members only; `local` is the instant preview while uploading.
  const url = local ?? `/api/files/${a.id}`;
  const download = local ?? `/api/files/${a.id}?download=1`;
  const [missing, setMissing] = useState(false);
  const [zoom, setZoom] = useState(false);

  const remove = onRemove && (
    <button
      type="button"
      className="att-x"
      onClick={onRemove}
      aria-label={`Remove ${a.name}`}
    >
      ×
    </button>
  );

  if (isImage(a) && !missing) {
    return (
      <span className="att att-img">
        <button
          type="button"
          className="att-thumb"
          onClick={() => setZoom(true)}
          aria-label={`Open ${a.name}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL, not optimisable */}
          <img src={url} alt={a.name} onError={() => setMissing(true)} />
        </button>
        {remove}
        {zoom && (
          <div
            className="lightbox"
            role="dialog"
            aria-label={a.name}
            onClick={() => setZoom(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
            <img src={url} alt={a.name} />
            <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
              <span>{a.name}</span>
              <a href={download} download={a.name}>
                Download
              </a>
              <button type="button" onClick={() => setZoom(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </span>
    );
  }
  return (
    <span className={`att att-file ${missing ? "missing" : ""}`}>
      <FileIcon a={a} />
      <span className="att-meta">
        {url ? (
          <a href={download} download={a.name} className="att-name">
            {a.name}
          </a>
        ) : (
          <span className="att-name">{a.name}</span>
        )}
        <small>{missing ? "Not on this device" : fmtSize(a.size)}</small>
      </span>
      {remove}
    </span>
  );
}

type Pending = Attachment & { url: string };

export default function Comments({ target }: { target: CommentTarget }) {
  const { state, dispatch, workspaceId } = useStore();
  const people = state.graph.people;
  const list = useMemo(
    () => commentsOn(state.graph.comments, target),
    [state.graph.comments, target],
  );
  // Comments and automatic log entries, oldest first. Features get a "created" line from their own date.
  const timeline = useMemo(() => {
    const logs = activityOn(state.graph.activity, target);
    if (!logs.some((l) => l.kind === "created")) {
      const src =
        target.kind === "feature"
          ? state.graph.features.find((f) => f.id === target.id)
          : target.kind === "ticket"
            ? state.graph.tickets.find((t) => t.id === target.id)
            : state.graph.bugs.find((b) => b.id === target.id);
      if (src?.createdAt)
        logs.unshift({
          id: `created-${target.id}`,
          target,
          actorId: src.createdBy,
          at: src.createdAt,
          kind: "created",
        });
    }
    return [
      ...logs.map((l) => ({ at: l.at, log: l })),
      ...list.map((c) => ({ at: c.createdAt, c })),
    ].sort((x, y) => x.at.localeCompare(y.at));
  }, [
    list,
    state.graph.activity,
    state.graph.features,
    state.graph.tickets,
    state.graph.bugs,
    target,
  ]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [mention, setMention] = useState<{
    start: number;
    query: string;
    active: number;
  } | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const caretAt = useRef<number | null>(null);

  // Place the caret after an inserted mention before the next keystroke can land.
  useLayoutEffect(() => {
    if (caretAt.current === null || !box.current) return;
    box.current.focus();
    box.current.setSelectionRange(caretAt.current, caretAt.current);
    caretAt.current = null;
  }, [text]);

  const matches = mention
    ? people.filter((p) =>
        p.name.toLowerCase().includes(mention.query.toLowerCase()),
      )
    : [];

  const onType = (value: string) => {
    setText(value);
    const caret = box.current?.selectionStart ?? value.length;
    const m = /(^|\s)@([\w ]{0,20})$/.exec(value.slice(0, caret));
    if (m && !/\s{2}/.test(m[2]))
      setMention({ start: caret - m[2].length - 1, query: m[2], active: 0 });
    else setMention(null);
  };

  const insertMention = (p: Person) => {
    if (!mention || !box.current) return;
    const caret = box.current.selectionStart;
    const next = `${text.slice(0, mention.start)}@${p.name} ${text.slice(caret)}`;
    setText(next);
    setMention(null);
    caretAt.current = mention.start + p.name.length + 2;
  };

  const addFiles = async (picked: FileList | File[]) => {
    setError("");
    for (const f of Array.from(picked)) {
      if (f.size > MAX_FILE_BYTES) {
        setError(`${f.name} is over 10 MB.`);
        continue;
      }
      const form = new FormData();
      form.append("file", f, f.name || "pasted-image.png");
      try {
        setUploading((n) => n + 1);
        const meta = await api<{ id: string; name: string; type: string; size: number }>(`/api/workspaces/${workspaceId}/files`, { form });
        setFiles((cur) => [...cur, { ...meta, url: URL.createObjectURL(f) }]);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : `Couldn't upload ${f.name}.`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const removePending = (id: string) => {
    setFiles((cur) => {
      const f = cur.find((x) => x.id === id);
      if (f) URL.revokeObjectURL(f.url);
      return cur.filter((x) => x.id !== id);
    });
    void api(`/api/files/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const send = () => {
    if ((!text.trim() && !files.length) || uploading) return;
    dispatch({
      type: "addComment",
      target,
      body: text,
      attachments: files.map(({ id, name, type, size }) => ({
        id,
        name,
        type,
        size,
      })),
    });
    files.forEach((f) => URL.revokeObjectURL(f.url));
    setText("");
    setFiles([]);
    setMention(null);
    requestAnimationFrame(() =>
      end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
    );
  };

  const remove = (c: Comment) => {
    if (window.confirm("Delete this comment?")) dispatch({ type: "deleteComment", id: c.id });
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && matches.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const d = e.key === "ArrowDown" ? 1 : -1;
        setMention({
          ...mention,
          active: (mention.active + d + matches.length) % matches.length,
        });
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(matches[mention.active]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  };

  const onPaste = (e: ClipboardEvent) => {
    const imgs = Array.from(e.clipboardData.files);
    if (imgs.length) {
      e.preventDefault();
      void addFiles(imgs);
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
  };

  return (
    <section className="cm" aria-label="Comments">
      <ol className="cm-list">
        {timeline.map((row) => {
          if ("log" in row && row.log)
            return (
              <LogRow key={row.log.id} a={row.log} noun={NOUN[target.kind]} />
            );
          const c = (row as { c: Comment }).c;
          const author = people.find((p) => p.id === c.authorId);
          return (
            <li key={c.id} className="cm-item">
              <Avatar personId={c.authorId} size={26} />
              <div className="cm-main">
                <div className="cm-head">
                  <strong>{author?.name ?? "Someone"}</strong>
                  <time dateTime={c.createdAt} title={fmtAgo(c.createdAt)}>
                    {fmtStamp(c.createdAt)}
                  </time>
                  {c.authorId === state.meId && (
                    <button
                      type="button"
                      className="cm-del"
                      onClick={() => remove(c)}
                      aria-label="Delete comment"
                    >
                      Delete
                    </button>
                  )}
                </div>
                {c.body && <Body text={c.body} />}
                {c.attachments.length > 0 && (
                  <div className="att-row">
                    {c.attachments.map((a) => (
                      <AttachmentView key={a.id} a={a} />
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={end} />

      <div
        className={`composer ${drag ? "drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
      >
        <div className="composer-top">
          <span className="composer-me" title="You">
            <Avatar personId={state.meId} size={26} />
          </span>
          <textarea
            ref={box}
            value={text}
            rows={2}
            placeholder="Write a comment. Type @ to tag someone."
            aria-label="Write a comment"
            onChange={(e) => onType(e.target.value)}
            onKeyDown={onKey}
            onPaste={onPaste}
            onBlur={() => setTimeout(() => setMention(null), 150)}
          />
        </div>
        {mention && matches.length > 0 && (
          <ul className="mention-menu" role="listbox" aria-label="Tag someone">
            {matches.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === mention.active}
                  className={i === mention.active ? "active" : ""}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(p);
                  }}
                >
                  <Avatar personId={p.id} size={22} />
                  <span>{p.name}</span>
                  <small>{p.role}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
        {files.length > 0 && (
          <div className="att-row pending">
            {files.map((f) => (
              <AttachmentView
                key={f.id}
                a={f}
                local={f.url}
                onRemove={() => removePending(f.id)}
              />
            ))}
          </div>
        )}
        {error && <p className="cm-error">{error}</p>}
        <div className="composer-bar">
          <button
            type="button"
            className="attach-btn"
            onClick={() => pick.current?.click()}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M10.5 4.5 5.4 9.6a1.6 1.6 0 0 0 2.3 2.3l5.4-5.4a3 3 0 0 0-4.3-4.3L3.4 7.6a4.4 4.4 0 0 0 6.2 6.2L13 10.4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Photo or file
          </button>
          <input
            ref={pick}
            type="file"
            multiple
            hidden
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.md,.zip"
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <span className="composer-hint">⌘↵ to send</span>
          <button
            type="button"
            className="btn-ink"
            onClick={send}
            disabled={uploading > 0 || (!text.trim() && !files.length)}
          >
            {uploading > 0 ? "Uploading…" : "Comment"}
          </button>
        </div>
        {drag && <div className="drop-hint">Drop files to attach</div>}
      </div>
    </section>
  );
}
