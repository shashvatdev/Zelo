"use client";

import {
  fmtDate,
  pct,
  personTickets,
  progressOf,
  releaseProgress,
} from "@/lib/graph";
import { useStore } from "@/lib/store";
import { Avatar } from "./nodes";

export function SideToggle({ open }: { open: boolean }) {
  const { dispatch } = useStore();
  const label = open ? "Hide sidebar" : "Show sidebar";
  return (
    <button
      type="button"
      className="side-toggle"
      onClick={() => dispatch({ type: "side" })}
      aria-label={label}
      aria-expanded={open}
      title={`${label} (⌘\\)`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="2.5"
          y="3.5"
          width="15"
          height="13"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path d="M7.5 3.5v13" stroke="currentColor" strokeWidth="1.6" />
        <path
          d={open ? "M13.5 8 11.5 10l2 2" : "M11.5 8l2 2-2 2"}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <svg width="24" height="24" viewBox="0 0 26 26" aria-hidden="true">
        <path
          d="M13 6.5 L6 19 M13 6.5 L20 19"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="13" cy="5.5" r="3.6" fill="currentColor" />
        <circle
          cx="6"
          cy="20"
          r="3.2"
          fill="var(--paper)"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <circle cx="20" cy="20" r="3.2" fill="var(--coral)" />
      </svg>
      zelo
    </span>
  );
}

export default function Sidebar() {
  const { state, dispatch } = useStore();
  const g = state.graph;
  const releases = [...g.releases].sort((a, b) => b.date.localeCompare(a.date));
  const first = [...g.releases].sort((a, b) => a.date.localeCompare(b.date))[0];
  const last = releases[0];
  const scopeRelease = state.scope === "all" ? undefined : state.scope;

  return (
    <aside
      className="side"
      aria-hidden={!state.sideOpen}
      inert={!state.sideOpen}
    >
      <div className="side-top">
        <div className="side-brand">
          <Logo />
          <SideToggle open />
        </div>
        <div className="product-pill">
          <span className="product-dot" />
          <span>{g.product.name}</span>
        </div>
      </div>

      <nav className="side-sec" aria-label="Versions">
        <p className="side-h">
          <span>Versions</span>
          <span className="side-count">{g.releases.length}</span>
        </p>
        <button
          type="button"
          className={`side-item all ${state.scope === "all" ? "on" : ""}`}
          onClick={() => dispatch({ type: "scope", scope: "all" })}
        >
          <span className="all-ico" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 12h18M6 8v8M12 6v12M18 9v6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="side-text">
            <strong>All versions</strong>
            <small>
              {fmtDate(first.date).split(" ").slice(1).join(" ")} →{" "}
              {fmtDate(last.date).split(" ").slice(1).join(" ")}
            </small>
          </span>
        </button>
        {releases.map((r) => {
          const p = releaseProgress(g, r.id, state.personId);
          return (
            <button
              key={r.id}
              type="button"
              className={`side-item ${state.scope === r.id ? "on" : ""}`}
              onClick={() => dispatch({ type: "scope", scope: r.id })}
            >
              <span className={`ver s-${r.state}`}>{r.version}</span>
              <span className="side-text">
                <strong>{r.name}</strong>
                <small>
                  <span className="mini-bar">
                    <span style={{ width: `${pct(p)}%` }} />
                  </span>
                  {pct(p)}% · {r.state}
                </small>
              </span>
            </button>
          );
        })}
      </nav>

      <nav className="side-sec" aria-label="People">
        <p className="side-h">
          <span>People</span>
          <span className="side-count">{g.people.length}</span>
        </p>
        <button
          type="button"
          className={`side-item ${!state.personId ? "on" : ""}`}
          onClick={() => dispatch({ type: "person", personId: null })}
        >
          <span className="avatar everyone" aria-hidden="true">
            ✱
          </span>
          <span className="side-text">
            <strong>Everyone</strong>
            <small>{g.people.length} people</small>
          </span>
        </button>
        {g.people.map((person) => {
          const p = progressOf(personTickets(g, person.id, scopeRelease));
          return (
            <button
              key={person.id}
              type="button"
              className={`side-item ${state.personId === person.id ? "on" : ""}`}
              onClick={() => dispatch({ type: "person", personId: person.id })}
            >
              <Avatar personId={person.id} size={26} />
              <span className="side-text">
                <strong>{person.name}</strong>
                <small>
                  {p.done}/{p.total} tickets {scopeRelease ? "here" : "overall"}
                </small>
              </span>
              {(() => {
                const n = g.comments.filter((c) =>
                  c.body.includes(`@${person.name}`),
                ).length;
                return n ? (
                  <span
                    className="mention-badge"
                    title={`Tagged in ${n} comment${n === 1 ? "" : "s"}`}
                  >
                    @{n}
                  </span>
                ) : null;
              })()}
            </button>
          );
        })}
      </nav>

      <div className="side-sec side-modules">
        <p className="side-h">
          <span>Modules</span>
          <span className="side-count">{g.modules.length}</span>
        </p>
        <ul className="legend">
          {g.modules.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="legend-btn"
                onClick={() =>
                  dispatch({
                    type: "select",
                    selected: { kind: "module", id: m.id },
                  })
                }
              >
                <span className="legend-dot" style={{ background: m.color }} />
                {m.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="side-foot">
        <span>Demo data, saved in this browser.</span>
        <button
          type="button"
          className="link-btn"
          onClick={() => dispatch({ type: "reset" })}
        >
          Reset
        </button>
      </div>
    </aside>
  );
}
