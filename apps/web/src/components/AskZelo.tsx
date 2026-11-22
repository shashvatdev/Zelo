"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import type { Graph } from "@/data/model";
import { api, ApiError } from "@/lib/api";
import { byId } from "@/lib/graph";
import { useStore, type Scope, type Selected } from "@/lib/store";

/**
 * Ask Zelo, docked on the right. Answers stream from the server (Groq + the board's database),
 * chats are saved, and any change the AI suggests shows as a card you must confirm.
 */

type Card = { label: string; sub: string; tone?: "ok" | "warn" | "bad" | "muted"; go: { scope: Scope; selected: Selected } };
type Proposal = { id: string; title: string; lines: string[]; card: Card | null; status: "pending" | "applied" | "cancelled" | "failed"; error: string | null };
type Msg = { id: string; role: "user" | "assistant"; content: string; cards: Card[]; proposals: Proposal[]; error?: string | null; streaming?: boolean; status?: string | null };
type Conv = { id: string; title: string; updatedAt: string };

const SUGGESTIONS = ["What is blocking the current release?", "What am I working on?", "Show open bugs, worst first", "What is unassigned?", "What changed this week?", "Who has the most on their plate?"];

/* ---------- a small, safe markdown renderer (bold, italic, code, lists, item keys) ---------- */

const KEY_RE = /\b[A-Z][A-Z0-9]{1,6}-\d{2,6}\b/g;

function useKeyLinks(g: Graph) {
  const { dispatch } = useStore();
  return useCallback(
    (key: string): (() => void) | null => {
      const t = g.tickets.find((x) => x.key === key);
      if (t) {
        const f = g.features.find((x) => x.id === t.featureId);
        return () => dispatch({ type: "goto", scope: f?.releaseId ?? "all", selected: { kind: "ticket", id: t.id } });
      }
      const b = g.bugs.find((x) => x.key === key);
      if (b) return () => dispatch({ type: "goto", scope: b.releaseId, selected: { kind: "bug", id: b.id } });
      const f = g.features.find((x) => x.key === key);
      if (f) return () => dispatch({ type: "goto", scope: f.releaseId, selected: { kind: "feature", id: f.id } });
      return null;
    },
    [g, dispatch],
  );
}

function Inline({ text, link }: { text: string; link: (k: string) => (() => void) | null }) {
  const out: ReactNode[] = [];
  // **bold**, _italic_ / *italic*, `code`
  const re = /(\*\*[^*]+\*\*|`[^`]+`|(?<![\w*])_[^_\n]+_(?!\w)|(?<![\w*])\*[^*\n]+\*(?!\w))/g;
  let last = 0;
  let i = 0;
  const pushKeys = (s: string, wrap?: (n: ReactNode) => ReactNode) => {
    let p = 0;
    for (const m of s.matchAll(KEY_RE)) {
      const go = link(m[0]);
      if (!go) continue;
      if (m.index! > p) out.push(wrap ? <Fragment key={i++}>{wrap(s.slice(p, m.index))}</Fragment> : s.slice(p, m.index));
      out.push(
        <button key={i++} type="button" className="ask-key" onClick={go}>
          {m[0]}
        </button>,
      );
      p = m.index! + m[0].length;
    }
    if (p < s.length) out.push(wrap ? <Fragment key={i++}>{wrap(s.slice(p))}</Fragment> : s.slice(p));
  };
  for (const m of text.matchAll(re)) {
    if (m.index! > last) pushKeys(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) pushKeys(tok.slice(2, -2), (n) => <strong>{n}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={i++}>{tok.slice(1, -1)}</code>);
    else pushKeys(tok.slice(1, -1), (n) => <em>{n}</em>);
    last = m.index! + tok.length;
  }
  if (last < text.length) pushKeys(text.slice(last));
  return <>{out}</>;
}

function Markdown({ text, link }: { text: string; link: (k: string) => (() => void) | null }) {
  // Keep ** pairs balanced while streaming so bold never flashes as raw asterisks.
  const plain = text.replace(/\b([A-Z][A-Z0-9]{1,6})[\u2010-\u2015\u2212\uFE63\uFF0D](\d{2,6})\b/g, "$1-$2");
  const safe = (plain.match(/\*\*/g)?.length ?? 0) % 2 ? `${plain}**` : plain;
  const blocks: ReactNode[] = [];
  const lines = safe.replace(/\r/g, "").split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{para.map((l, j) => <Fragment key={j}>{j > 0 && <br />}<Inline text={l} link={link} /></Fragment>)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, j) => <li key={j}><Inline text={it} link={link} /></li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const head = /^#{1,4}\s+(.*)$/.exec(line);
    if (bullet || num) {
      flushPara();
      const ordered = !!num;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? num)![1]);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else if (head) {
      flushPara();
      flushList();
      blocks.push(<p key={blocks.length} className="md-h"><Inline text={head[1]} link={link} /></p>);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return <div className="md">{blocks}</div>;
}

/* ---------- icons ---------- */

const Spark = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 1.5 9.3 5.2a2 2 0 0 0 1.5 1.5L14.5 8l-3.7 1.3a2 2 0 0 0-1.5 1.5L8 14.5l-1.3-3.7a2 2 0 0 0-1.5-1.5L1.5 8l3.7-1.3a2 2 0 0 0 1.5-1.5L8 1.5Z" fill="currentColor" />
  </svg>
);
const Icon = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function AskButton() {
  const { state, dispatch } = useStore();
  return (
    <button type="button" className={`ask-btn ${state.askOpen ? "on" : ""}`} aria-expanded={state.askOpen} onClick={() => dispatch({ type: "ask" })}>
      <Spark />
      Ask Zelo
      <kbd>⌘K</kbd>
    </button>
  );
}

/* ---------- SSE over fetch (POST bodies aren't possible with EventSource) ---------- */

async function* readEvents(res: Response): AsyncGenerator<{ event: string; data: Record<string, unknown> }> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let cut: number;
    while ((cut = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      let event = "message";
      let data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        yield { event, data: JSON.parse(data) };
      } catch {
        // skip a broken event
      }
    }
  }
}

const lastKey = (ws: string) => `zelo-ask-conv:${ws}`;
let tmp = 0;

/** Ask Zelo as a copilot docked on the right: chat stays open while you work on the tree. */
export default function AskZelo() {
  const { state, dispatch, workspaceId, refresh } = useStore();
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [convs, setConvs] = useState<Conv[] | null>(null);
  const [showHist, setShowHist] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const open = state.askOpen;
  const g = state.graph;
  const link = useKeyLinks(g);
  const release = state.scope === "all" ? undefined : byId(g.releases, state.scope);
  const person = byId(g.people, state.personId);
  const base = `/api/workspaces/${workspaceId}/ask`;

  useEffect(() => {
    if (open) requestAnimationFrame(() => input.current?.focus());
  }, [open]);

  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [q]);

  const loadConv = useCallback(
    async (id: string) => {
      setLoadingConv(true);
      try {
        const r = await api<{ messages: Msg[] }>(`${base}/${id}`);
        setMsgs(r.messages);
        setConvId(id);
        try {
          localStorage.setItem(lastKey(workspaceId), id);
        } catch {
          // storage blocked
        }
      } catch {
        try {
          localStorage.removeItem(lastKey(workspaceId));
        } catch {
          // storage blocked
        }
      } finally {
        setLoadingConv(false);
      }
    },
    [base, workspaceId],
  );

  // Reopen the last chat the first time the panel opens.
  const restored = useRef(false);
  useEffect(() => {
    if (!open || restored.current) return;
    restored.current = true;
    let id: string | null = null;
    try {
      id = localStorage.getItem(lastKey(workspaceId));
    } catch {
      // storage blocked
    }
    if (id) void loadConv(id);
  }, [open, workspaceId, loadConv]);

  const loadList = useCallback(async () => {
    try {
      const r = await api<{ conversations: Conv[] }>(base);
      setConvs(r.conversations);
    } catch {
      setConvs([]);
    }
  }, [base]);

  useEffect(() => {
    if (showHist) void loadList();
  }, [showHist, loadList]);

  // Keep the newest turn in view while it streams.
  const lastMsg = msgs[msgs.length - 1];
  const lastUserId = [...msgs].reverse().find((m) => m.role === "user")?.id;
  useEffect(() => {
    if (!lastUserId || !log.current) return;
    const el = log.current.querySelector<HTMLElement>(`[data-msg="${lastUserId}"]`);
    if (el) log.current.scrollTo({ top: el.offsetTop - 12, behavior: "smooth" });
  }, [lastUserId]);

  const patchLast = (fn: (m: Msg) => Msg) => setMsgs((list) => (list.length ? [...list.slice(0, -1), fn(list[list.length - 1])] : list));

  const newChat = () => {
    abort.current?.abort();
    setMsgs([]);
    setConvId(null);
    setShowHist(false);
    try {
      localStorage.removeItem(lastKey(workspaceId));
    } catch {
      // storage blocked
    }
    requestAnimationFrame(() => input.current?.focus());
  };

  const submit = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setQ("");
    setShowHist(false);
    setBusy(true);
    const uid = `u${++tmp}`;
    setMsgs((m) => [...m, { id: uid, role: "user", content: message, cards: [], proposals: [] }, { id: `a${tmp}`, role: "assistant", content: "", cards: [], proposals: [], streaming: true, status: "Thinking" }]);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        signal: ctrl.signal,
        body: JSON.stringify({ conversationId: convId, message, view: { scope: state.scope, selected: state.selected, personId: state.personId } }),
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new ApiError(res.status, data.error ?? "Ask Zelo couldn't answer. Try again.");
      }
      for await (const { event, data } of readEvents(res)) {
        if (event === "meta") {
          const id = data.conversationId as string;
          setConvId(id);
          try {
            localStorage.setItem(lastKey(workspaceId), id);
          } catch {
            // storage blocked
          }
        } else if (event === "status") patchLast((m) => ({ ...m, status: data.text as string }));
        else if (event === "delta") patchLast((m) => ({ ...m, content: m.content + (data.text as string), status: null }));
        else if (event === "reset") patchLast((m) => ({ ...m, content: "" }));
        else if (event === "done") {
          const saved = data.message as Msg;
          patchLast(() => ({ ...saved, streaming: false, status: null }));
        } else if (event === "error") patchLast((m) => ({ ...m, streaming: false, status: null, error: (data.message as string) ?? "Something went wrong." }));
      }
      patchLast((m) => (m.streaming ? { ...m, streaming: false, status: null } : m));
    } catch (e) {
      if (ctrl.signal.aborted) patchLast((m) => ({ ...m, streaming: false, status: null, content: m.content || "_Stopped._" }));
      else patchLast((m) => ({ ...m, streaming: false, status: null, error: e instanceof ApiError ? e.message : "Can't reach Ask Zelo. Check your connection." }));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  const decide = async (msgId: string, p: Proposal, decision: "apply" | "cancel") => {
    const set = (np: Proposal) => setMsgs((list) => list.map((m) => (m.id === msgId ? { ...m, proposals: m.proposals.map((x) => (x.id === np.id ? np : x)) } : m)));
    set({ ...p, status: decision === "apply" ? "applied" : "cancelled", error: null }); // optimistic
    try {
      const r = await api<{ proposal: Proposal }>(`${base}/proposals/${p.id}`, { body: { decision } });
      set(r.proposal);
      if (decision === "apply" && r.proposal.status === "applied") void refresh();
    } catch (e) {
      set({ ...p, status: "failed", error: e instanceof ApiError ? e.message : "Couldn't apply it." });
    }
  };

  const deleteConv = async (id: string) => {
    setConvs((l) => l?.filter((c) => c.id !== id) ?? null);
    if (id === convId) newChat();
    await api(`${base}/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(q);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit(q);
    } else if (e.key === "Escape") {
      if (busy) abort.current?.abort();
      else dispatch({ type: "ask", open: false });
    }
  };

  return (
    <aside className="copilot" aria-label="Ask Zelo" aria-hidden={!open} inert={!open}>
      <header className="cp-head">
        <span className="cp-mark">
          <Spark size={15} />
        </span>
        <div className="cp-title">
          <strong>Ask Zelo</strong>
          <small>Copilot for this board</small>
        </div>
        <button type="button" className={`cp-icon ${showHist ? "on" : ""}`} onClick={() => setShowHist((v) => !v)} aria-label="Chat history" title="Chat history" aria-expanded={showHist}>
          <Icon d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.6h2.6M8 5v3.2l2 1.3" />
        </button>
        {msgs.length > 0 && (
          <button type="button" className="cp-icon" onClick={newChat} aria-label="New chat" title="New chat">
            <Icon d="M8 3v10M3 8h10" />
          </button>
        )}
        <button type="button" className="cp-icon" onClick={() => dispatch({ type: "ask", open: false })} aria-label="Close Ask Zelo" title="Close (⌘K)">
          <Icon d="m4 4 8 8M12 4l-8 8" />
        </button>
      </header>

      {showHist && (
        <div className="cp-hist">
          <div className="cp-hist-head">
            <strong>Your chats</strong>
            <button type="button" onClick={newChat}>
              + New chat
            </button>
          </div>
          {convs === null ? (
            <p className="cp-hist-empty">Loading…</p>
          ) : convs.length === 0 ? (
            <p className="cp-hist-empty">No saved chats yet. Ask something and it&apos;ll show up here.</p>
          ) : (
            <ul>
              {convs.map((c) => (
                <li key={c.id} className={c.id === convId ? "on" : ""}>
                  <button
                    type="button"
                    className="cp-hist-open"
                    onClick={() => {
                      setShowHist(false);
                      void loadConv(c.id);
                    }}
                  >
                    <span>{c.title}</span>
                    <small>{new Date(c.updatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
                  </button>
                  <button type="button" className="cp-hist-del" onClick={() => void deleteConv(c.id)} aria-label={`Delete chat ${c.title}`} title="Delete">
                    <Icon d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.6 8.5h4.8l.6-8.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="cp-log" ref={log} aria-live="polite">
        {msgs.length === 0 && !loadingConv && (
          <div className="cp-hello">
            <span className="cp-big-mark">
              <Spark size={22} />
            </span>
            <h2>What do you want to know?</h2>
            <p>Ask about versions, people, bugs or history, or tell me to change something. I answer from your live board and check with you before touching anything.</p>
            <div className="cp-suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => void submit(s)}>
                  {s}
                  <span aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {loadingConv && <p className="cp-loading">Loading chat…</p>}
        {msgs.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="turn" data-msg={m.id}>
              <p className="turn-q">{m.content}</p>
            </div>
          ) : (
            <div key={m.id} className="turn">
              <div className="turn-a">
                <span className={`ask-dot ${m.streaming ? "live" : ""}`} aria-hidden="true" />
                <div className="turn-body">
                  {m.status && !m.content && (
                    <p className="cp-status">
                      {m.status}
                      <span className="cp-dots" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    </p>
                  )}
                  {m.content && (
                    <div className="turn-text">
                      <Markdown text={m.content} link={link} />
                      {m.streaming && <span className="cp-caret" aria-hidden="true" />}
                    </div>
                  )}
                  {m.error && !["ai_unavailable", "rate_limited", "stopped"].includes(m.error) && <p className="cp-error">{m.error}</p>}
                  {!m.streaming && m.proposals.length > 0 && (
                    <div className="cp-props">
                      {m.proposals.map((p) => (
                        <div key={p.id} className={`cp-prop s-${p.status}`}>
                          <div className="cp-prop-head">
                            <strong>{p.title}</strong>
                            {p.status !== "pending" && <span className="cp-prop-chip">{p.status === "applied" ? "Done" : p.status === "cancelled" ? "Cancelled" : "Didn't apply"}</span>}
                          </div>
                          <ul>
                            {p.lines.map((l, i) => (
                              <li key={i}>{l}</li>
                            ))}
                          </ul>
                          {p.error && <p className="cp-prop-err">{p.error}</p>}
                          <div className="cp-prop-bar">
                            {p.card && (
                              <button type="button" className="cp-prop-open" onClick={() => dispatch({ type: "goto", ...p.card!.go })}>
                                Open →
                              </button>
                            )}
                            {p.status === "pending" && (
                              <span className="cp-prop-act">
                                <button type="button" className="cp-btn ghost" onClick={() => void decide(m.id, p, "cancel")}>
                                  Cancel
                                </button>
                                <button type="button" className="cp-btn" onClick={() => void decide(m.id, p, "apply")}>
                                  Confirm
                                </button>
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {m.proposals.filter((p) => p.status === "pending").length > 1 && (
                        <button type="button" className="cp-btn all" onClick={() => m.proposals.filter((p) => p.status === "pending").forEach((p) => void decide(m.id, p, "apply"))}>
                          Confirm all {m.proposals.filter((p) => p.status === "pending").length}
                        </button>
                      )}
                    </div>
                  )}
                  {!m.streaming && m.cards.length > 0 && (
                    <ul className="ask-items">
                      {m.cards.slice(0, 8).map((it, i) => (
                        <li key={i} style={{ animationDelay: `${i * 40}ms` }}>
                          <button type="button" onClick={() => dispatch({ type: "goto", ...it.go })}>
                            <span className={`ask-tone t-${it.tone ?? "muted"}`} />
                            <span className="ask-item-text">
                              <strong>{it.label}</strong>
                              <small>{it.sub}</small>
                            </span>
                            <span className="ask-go" aria-hidden="true">
                              →
                            </span>
                          </button>
                        </li>
                      ))}
                      {m.cards.length > 8 && <li className="ask-more">+{m.cards.length - 8} more</li>}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ),
        )}
      </div>

      <form className="cp-compose" onSubmit={onSubmit}>
        {msgs.length > 0 && !busy && (
          <div className="cp-chips">
            {SUGGESTIONS.slice(0, 4).map((s) => (
              <button key={s} type="button" onClick={() => void submit(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="cp-box">
          <span className="cp-context" title="Ask Zelo knows what you are looking at">
            {release ? `${release.version} · ${release.name}` : "All versions"}
            {person ? ` · ${person.name.split(" ")[0]}` : ""}
          </span>
          <textarea ref={input} rows={1} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Ask anything, or tell me what to change…" aria-label="Ask Zelo a question" maxLength={4000} />
          <div className="cp-box-bar">
            <span>{busy ? "esc to stop" : "↵ send · ⇧↵ new line"}</span>
            {busy ? (
              <button type="button" className="cp-send stop" onClick={() => abort.current?.abort()} aria-label="Stop">
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <rect x="2" y="2" width="8" height="8" rx="1.5" fill="currentColor" />
                </svg>
              </button>
            ) : (
              <button type="submit" className="cp-send" disabled={!q.trim()} aria-label="Send">
                <Icon d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
              </button>
            )}
          </div>
        </div>
        <p className="ask-note">{lastMsg?.error === "ai_unavailable" || lastMsg?.error === "rate_limited" ? "The AI is busy for a moment. Try again shortly." : "Answers come from your live board. Changes only happen when you confirm."}</p>
      </form>
    </aside>
  );
}
