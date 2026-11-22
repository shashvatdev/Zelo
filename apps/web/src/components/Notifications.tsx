"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtAgo, fmtStamp } from "@/lib/graph";
import { buildNotifications, type Notif } from "@/lib/notifications";
import { useStore } from "@/lib/store";
import { Avatar } from "./nodes";

const VERB: Record<Notif["kind"], string> = {
  assigned: "assigned you",
  mention: "mentioned you on",
  comment: "commented on your task",
};

const KIND_ICON: Record<Notif["kind"], React.ReactNode> = {
  assigned: (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.5 6.2 5 8.5l4.5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  mention: (
    <span style={{ fontSize: 10, fontWeight: 800, lineHeight: 1 }}>@</span>
  ),
  comment: (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 3a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 10 3v3.5A1.5 1.5 0 0 1 8.5 8H5.5L3 10V8A1.5 1.5 0 0 1 2 6.5V3Z"
        fill="currentColor"
      />
    </svg>
  ),
};

/** Bell in the top bar: unread badge, and a list of what needs this person's attention. */
export default function Notifications() {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const g = state.graph;

  const all = useMemo(() => buildNotifications(g, state.meId), [g, state.meId]);
  const read = state.notif ? { ids: state.notif.readIds, before: state.notif.readBefore } : null;
  const before = read?.before ?? null;
  const isUnread = (n: Notif) => before !== null && n.at > before && !read?.ids.includes(n.id);
  const unread = all.filter(isUnread).length;
  const list = onlyUnread ? all.filter(isUnread) : all;

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      // The person picker's menu lives in a portal; clicks there must not close the list.
      if (!wrap.current?.contains(t) && !t.closest(".pk-menu")) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key);
    };
  }, [open]);

  const go = (n: Notif) => {
    dispatch({ type: "notifRead", ids: [n.id] });
    dispatch({
      type: "goto",
      scope: n.releaseId,
      selected: { kind: n.target.kind, id: n.target.id },
    });
    setOpen(false);
  };

  return (
    <div className="notif" ref={wrap}>
      <button
        type="button"
        className={`bell ${open ? "on" : ""}`}
        aria-label={
          unread ? `Notifications, ${unread} unread` : "Notifications"
        }
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 8a5 5 0 0 1 10 0c0 3.5 1.2 5 2 5.8H3c.8-.8 2-2.3 2-5.8Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M8 16.5a2.2 2.2 0 0 0 4 0"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        {unread > 0 && (
          <span className="bell-badge">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div className="notif-pop" role="dialog" aria-label="Notifications">
          <header className="np-head">
            <div className="np-title">
              <strong>Notifications</strong>
              <span className="np-for">
                for <Avatar personId={state.meId} size={16} /> {g.people.find((p) => p.id === state.meId)?.name ?? "you"}
              </span>
            </div>
            <button
              type="button"
              className="np-readall"
              onClick={() => dispatch({ type: "notifReadAll" })}
              disabled={!unread}
            >
              Mark all read
            </button>
          </header>
          <div className="np-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={!onlyUnread}
              className={!onlyUnread ? "on" : ""}
              onClick={() => setOnlyUnread(false)}
            >
              All <span>{all.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={onlyUnread}
              className={onlyUnread ? "on" : ""}
              onClick={() => setOnlyUnread(true)}
            >
              Unread <span>{unread}</span>
            </button>
          </div>

          <ol className="np-list">
            {list.length === 0 && (
              <li className="np-empty">
                <strong>
                  {onlyUnread ? "You're all caught up." : "Nothing yet."}
                </strong>
                <span>
                  You&apos;ll hear here when someone assigns you a task, tags
                  you, or comments on your work.
                </span>
              </li>
            )}
            {list.map((n) => {
              const actor = g.people.find((p) => p.id === n.actorId);
              const fresh = isUnread(n);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`np-item ${fresh ? "unread" : ""}`}
                    onClick={() => go(n)}
                  >
                    <span className="np-av">
                      <Avatar personId={n.actorId} size={30} />
                      <span className={`np-kind k-${n.kind}`}>
                        {KIND_ICON[n.kind]}
                      </span>
                    </span>
                    <span className="np-body">
                      <span className="np-line">
                        <b>{actor?.name ?? "Someone"}</b> {VERB[n.kind]}
                      </span>
                      <span className="np-task">
                        <span className="np-key">{n.key}</span>
                        {n.title}
                      </span>
                      {n.preview && (
                        <span className="np-preview">“{n.preview}”</span>
                      )}
                      <time dateTime={n.at} title={fmtAgo(n.at)}>
                        {fmtStamp(n.at)} · {fmtAgo(n.at)}
                      </time>
                    </span>
                    {fresh && <span className="np-dot" aria-label="Unread" />}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
