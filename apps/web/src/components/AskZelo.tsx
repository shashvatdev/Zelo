"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { byId } from "@/lib/graph";
import { ask, SUGGESTIONS, type Answer } from "@/lib/ask";
import { useStore } from "@/lib/store";

type Turn = { id: number; q: string; a: Answer };

function Rich({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\*\*[^*]+\*\*)/g)
        .map((p, i) =>
          p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p,
        )}
    </>
  );
}

/** Reveals an answer a few characters at a time, like a model streaming. */
function Typed({ text, onDone }: { text: string; onDone: () => void }) {
  const [n, setN] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const id = setInterval(() => {
      setN((v) => {
        const next = Math.min(text.length, v + 3);
        if (next === text.length) {
          clearInterval(id);
          setTimeout(() => done.current(), 0);
        }
        return next;
      });
    }, 14);
    return () => clearInterval(id);
  }, [text]);
  // Keep ** pairs balanced while typing so bold never flashes as raw asterisks.
  let shown = text.slice(0, n);
  if ((shown.match(/\*\*/g)?.length ?? 0) % 2) shown += "**";
  return <Rich text={shown} />;
}

const Spark = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M8 1.5 9.3 5.2a2 2 0 0 0 1.5 1.5L14.5 8l-3.7 1.3a2 2 0 0 0-1.5 1.5L8 14.5l-1.3-3.7a2 2 0 0 0-1.5-1.5L1.5 8l3.7-1.3a2 2 0 0 0 1.5-1.5L8 1.5Z"
      fill="currentColor"
    />
  </svg>
);

export function AskButton() {
  const { state, dispatch } = useStore();
  return (
    <button
      type="button"
      className={`ask-btn ${state.askOpen ? "on" : ""}`}
      aria-expanded={state.askOpen}
      onClick={() => dispatch({ type: "ask" })}
    >
      <Spark />
      Ask Zelo
      <kbd>⌘K</kbd>
    </button>
  );
}

/** Ask Zelo as a copilot docked on the right: chat stays open while you work on the tree. */
export default function AskZelo() {
  const { state, dispatch } = useStore();
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [typing, setTyping] = useState<number | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const open = state.askOpen;
  const g = state.graph;
  const release =
    state.scope === "all" ? undefined : byId(g.releases, state.scope);
  const person = byId(g.people, state.personId);

  useEffect(() => {
    if (open) requestAnimationFrame(() => input.current?.focus());
  }, [open]);

  // Grow the box with the text, up to a few lines.
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [q]);

  // Bring the newest question to the top of the log, so its answer reads from the start.
  const lastId = turns[turns.length - 1]?.id;
  useEffect(() => {
    if (!lastId || !log.current) return;
    const el = log.current.querySelector<HTMLElement>(
      `[data-turn="${lastId}"]`,
    );
    if (el)
      log.current.scrollTo({ top: el.offsetTop - 12, behavior: "smooth" });
  }, [lastId]);

  const submit = (text: string) => {
    if (!text.trim()) return;
    const id = nextId.current++;
    setTurns((t) => [
      ...t.slice(-11),
      { id, q: text.trim(), a: ask(g, text, state.scope) },
    ]);
    setTyping(id);
    setQ("");
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(q);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(q);
    } else if (e.key === "Escape") {
      dispatch({ type: "ask", open: false });
    }
  };

  return (
    <aside
      className="copilot"
      aria-label="Ask Zelo"
      aria-hidden={!open}
      inert={!open}
    >
      <header className="cp-head">
        <span className="cp-mark">
          <Spark size={15} />
        </span>
        <div className="cp-title">
          <strong>Ask Zelo</strong>
          <small>Copilot for this board</small>
        </div>
        {turns.length > 0 && (
          <button
            type="button"
            className="cp-icon"
            onClick={() => setTurns([])}
            aria-label="New chat"
            title="New chat"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8 3v10M3 8h10"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
        <button
          type="button"
          className="cp-icon"
          onClick={() => dispatch({ type: "ask", open: false })}
          aria-label="Close Ask Zelo"
          title="Close (⌘K)"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m4 4 8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      <div className="cp-log" ref={log}>
        {turns.length === 0 && (
          <div className="cp-hello">
            <span className="cp-big-mark">
              <Spark size={22} />
            </span>
            <h2>What do you want to know?</h2>
            <p>
              Ask about versions, people, bugs or history. Answers link straight
              to the right spot in the tree.
            </p>
            <div className="cp-suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => submit(s)}>
                  {s}
                  <span aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t) => (
          <div key={t.id} className="turn" data-turn={t.id}>
            <p className="turn-q">{t.q}</p>
            <div className="turn-a">
              <span className="ask-dot" aria-hidden="true" />
              <div className="turn-body">
                <p className="turn-text">
                  {typing === t.id ? (
                    <Typed text={t.a.text} onDone={() => setTyping(null)} />
                  ) : (
                    <Rich text={t.a.text} />
                  )}
                </p>
                {typing !== t.id && t.a.items.length > 0 && (
                  <ul className="ask-items">
                    {t.a.items.slice(0, 8).map((it, i) => (
                      <li key={i} style={{ animationDelay: `${i * 40}ms` }}>
                        <button
                          type="button"
                          onClick={() => dispatch({ type: "goto", ...it.go })}
                        >
                          <span
                            className={`ask-tone t-${it.tone ?? "muted"}`}
                          />
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
                    {t.a.items.length > 8 && (
                      <li className="ask-more">+{t.a.items.length - 8} more</li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <form className="cp-compose" onSubmit={onSubmit}>
        {turns.length > 0 && (
          <div className="cp-chips">
            {SUGGESTIONS.slice(0, 4).map((s) => (
              <button key={s} type="button" onClick={() => submit(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="cp-box">
          <span
            className="cp-context"
            title="Ask Zelo answers about what you are looking at"
          >
            {release ? `${release.version} · ${release.name}` : "All versions"}
            {person ? ` · ${person.name.split(" ")[0]}` : ""}
          </span>
          <textarea
            ref={input}
            rows={1}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask anything about this product…"
            aria-label="Ask Zelo a question"
          />
          <div className="cp-box-bar">
            <span>↵ send · ⇧↵ new line</span>
            <button
              type="submit"
              className="cp-send"
              disabled={!q.trim()}
              aria-label="Send"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M8 13V3M3.5 7.5 8 3l4.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
        <p className="ask-note">
          Demo answers from this board&apos;s data. Claude takes over once the
          backend is live.
        </p>
      </form>
    </aside>
  );
}
