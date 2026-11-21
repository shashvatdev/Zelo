"use client";

import { useState, type FormEvent } from "react";
import {
  bugsIn,
  byId,
  featuresForPerson,
  featuresIn,
  fmtAgo,
  fmtDate,
  fmtStamp,
  lineage,
  openBugs,
  pct,
  personTickets,
  progressOf,
  releaseProgress,
  ticketsOf,
} from "@/lib/graph";
import { useStore } from "@/lib/store";
import { Avatar } from "./nodes";
import Comments, { commentsOn } from "./Comments";
import { PersonPicker, StatusPicker } from "./Picker";

function Meter({ done, total }: { done: number; total: number }) {
  const v = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="meter">
      <span
        style={{
          width: `${v}%`,
          background: v === 100 ? "var(--green)" : "var(--ink)",
        }}
      />
    </div>
  );
}

/** "Created 12 Oct 2026, 10:24 by Bhumika Saxena": shown under every task, feature and bug title. */
function Created({
  at,
  by,
  verb = "Created",
}: {
  at?: string;
  by?: string | null;
  verb?: string;
}) {
  const { state } = useStore();
  if (!at) return null;
  const who = state.graph.people.find((p) => p.id === by);
  return (
    <p className="pn-created">
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="2"
          y="3"
          width="12"
          height="11"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {verb}{" "}
      <time dateTime={at} title={fmtAgo(at)}>
        {fmtStamp(at)}
      </time>
      {who && (
        <>
          {" "}
          by <Avatar personId={who.id} size={16} /> <b>{who.name}</b>
        </>
      )}
    </p>
  );
}

export default function Panel() {
  const { state, dispatch } = useStore();
  const [draft, setDraft] = useState("");
  const g = state.graph;
  const sel = state.selected;
  if (!sel) return null;
  const close = () => dispatch({ type: "select", selected: null });
  const go = (scope: string) => dispatch({ type: "scope", scope });

  let body = null;

  if (sel.kind === "feature") {
    const f = byId(g.features, sel.id);
    if (!f) return null;
    const m = byId(g.modules, f.moduleId)!;
    const r = byId(g.releases, f.releaseId)!;
    const tickets = ticketsOf(g, f.id);
    const p = progressOf(tickets);
    const chain = lineage(g, f);
    const add = (e: FormEvent) => {
      e.preventDefault();
      dispatch({ type: "addTicket", featureId: f.id, title: draft });
      setDraft("");
    };
    body = (
      <>
        <div className="pn-chips">
          <span
            className="chip"
            style={{ borderColor: m.color, color: m.color }}
          >
            {m.name}
          </span>
          <button
            type="button"
            className="chip chip-btn"
            onClick={() => go(r.id)}
          >
            {r.version} · {r.name}
          </button>
        </div>
        <h2>{f.name}</h2>
        <p className="pn-key">
          {f.key} · owner <Avatar personId={f.ownerId} size={18} />{" "}
          {byId(g.people, f.ownerId)?.name ?? "Unassigned"}
        </p>
        <Created at={f.createdAt} by={f.createdBy} />
        <Meter done={p.done} total={p.total} />
        <p className="pn-muted">
          {p.done}/{p.total} tickets done · {p.donePoints}/{p.points} points
        </p>
        <h3>Spec</h3>
        <p className="pn-spec">{f.spec}</p>
        <h3>Tickets</h3>
        <ul className="pn-list">
          {tickets.map((t) => (
            <li key={t.id}>
              <div>
                <strong>{t.title}</strong>
                <small>
                  {t.key} · {t.points} pts · {fmtDate(t.createdAt.slice(0, 10))}
                </small>
              </div>
              <PersonPicker
                compact
                value={t.assigneeId}
                onChange={(id) =>
                  dispatch({ type: "ticketAssignee", id: t.id, assigneeId: id })
                }
              />
              <StatusPicker
                compact
                value={t.status}
                onChange={(s) =>
                  dispatch({ type: "ticketStatus", id: t.id, status: s })
                }
              />
            </li>
          ))}
        </ul>
        <form className="pn-add" onSubmit={add}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a ticket to this feature"
            aria-label="New ticket title"
          />
          <button type="submit" className="btn-ink" disabled={!draft.trim()}>
            Add
          </button>
        </form>
        {chain.length > 1 && (
          <>
            <h3>Versions of this feature</h3>
            <ol className="pn-chain">
              {chain.map((c) => {
                const cr = byId(g.releases, c.releaseId)!;
                return (
                  <li key={c.id} className={c.id === f.id ? "here" : ""}>
                    <button
                      type="button"
                      onClick={() =>
                        dispatch({
                          type: "select",
                          selected: { kind: "feature", id: c.id },
                        })
                      }
                    >
                      <span className="ver-tag">{cr.version}</span> {c.name}
                    </button>
                  </li>
                );
              })}
            </ol>
          </>
        )}
        <h3>
          Activity{" "}
          <span className="h3-count" title="Comments">
            {commentsOn(g.comments, { kind: "feature", id: f.id }).length}
          </span>
        </h3>
        <Comments key={f.id} target={{ kind: "feature", id: f.id }} />
      </>
    );
  }

  if (sel.kind === "ticket") {
    const t = byId(g.tickets, sel.id);
    if (!t) return null;
    const f = byId(g.features, t.featureId)!;
    body = (
      <>
        <div className="pn-chips">
          <button
            type="button"
            className="chip chip-btn"
            onClick={() =>
              dispatch({
                type: "select",
                selected: { kind: "feature", id: f.id },
              })
            }
          >
            Feature: {f.name}
          </button>
        </div>
        <h2>{t.title}</h2>
        <p className="pn-key">
          {t.key} · {t.points} points
        </p>
        <Created at={t.createdAt} by={t.createdBy} />
        <div className="pn-fields">
          <div className="pn-field">
            <span>Status</span>
            <StatusPicker
              value={t.status}
              onChange={(s) =>
                dispatch({ type: "ticketStatus", id: t.id, status: s })
              }
            />
          </div>
          <div className="pn-field">
            <span>Assignee</span>
            <PersonPicker
              value={t.assigneeId}
              onChange={(id) =>
                dispatch({ type: "ticketAssignee", id: t.id, assigneeId: id })
              }
            />
          </div>
        </div>
        <h3>From the feature&apos;s spec</h3>
        <p className="pn-spec">{f.spec}</p>
        <h3>
          Activity{" "}
          <span className="h3-count" title="Comments">
            {commentsOn(g.comments, { kind: "ticket", id: t.id }).length}
          </span>
        </h3>
        <Comments key={t.id} target={{ kind: "ticket", id: t.id }} />
      </>
    );
  }

  if (sel.kind === "bug") {
    const b = byId(g.bugs, sel.id);
    if (!b) return null;
    const m = byId(g.modules, b.moduleId)!;
    const r = byId(g.releases, b.releaseId)!;
    const intro = byId(g.releases, b.introducedIn);
    body = (
      <>
        <div className="pn-chips">
          <span
            className="chip"
            style={{ borderColor: m.color, color: m.color }}
          >
            {m.name}
          </span>
          <span className={`chip sev-${b.severity}`}>{b.severity}</span>
        </div>
        <h2>{b.title}</h2>
        <p className="pn-key">{b.key}</p>
        <Created at={b.createdAt} by={b.createdBy} verb="Reported" />
        <div className="pn-fields one">
          <div className="pn-field">
            <span>Status</span>
            <StatusPicker
              value={b.status}
              onChange={(s) =>
                dispatch({ type: "bugStatus", id: b.id, status: s })
              }
            />
          </div>
        </div>
        <dl className="pn-dl">
          <dt>Planned in</dt>
          <dd>{r.version}</dd>
          <dt>Introduced in</dt>
          <dd>{intro ? intro.version : "Unknown"}</dd>
          <dt>Fixed in</dt>
          <dd>{b.status === "done" ? r.version : "Not yet"}</dd>
          <dt>Owner</dt>
          <dd>{byId(g.people, b.assigneeId)?.name ?? "Unassigned"}</dd>
        </dl>
        <h3>
          Activity{" "}
          <span className="h3-count" title="Comments">
            {commentsOn(g.comments, { kind: "bug", id: b.id }).length}
          </span>
        </h3>
        <Comments key={b.id} target={{ kind: "bug", id: b.id }} />
      </>
    );
  }

  if (sel.kind === "release") {
    const r = byId(g.releases, sel.id);
    if (!r) return null;
    const p = releaseProgress(g, r.id);
    body = (
      <>
        <div className="pn-chips">
          <span className={`state s-${r.state}`}>{r.state}</span>
        </div>
        <h2>
          {r.version} · {r.name}
        </h2>
        <p className="pn-key">Target {fmtDate(r.date)}</p>
        <Meter done={p.done} total={p.total} />
        <p className="pn-muted">
          {p.done}/{p.total} tickets · {pct(p)}% ·{" "}
          {openBugs(bugsIn(g, r.id)).length} open bugs
        </p>
        <h3>People in this release</h3>
        <ul className="pn-list people">
          {g.people.map((pp) => {
            const pr = progressOf(personTickets(g, pp.id, r.id));
            return (
              <li key={pp.id}>
                <button
                  type="button"
                  className="pn-person"
                  onClick={() => dispatch({ type: "person", personId: pp.id })}
                >
                  <Avatar personId={pp.id} size={24} /> {pp.name}
                </button>
                <small>
                  {pr.done}/{pr.total} done
                </small>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  if (sel.kind === "person") {
    const pp = byId(g.people, sel.id);
    if (!pp) return null;
    body = (
      <>
        <h2>{pp.name}</h2>
        <p className="pn-key">{pp.role}</p>
        <h3>Across every version</h3>
        <ul className="pn-list">
          {[...g.releases]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((r) => {
              const pr = progressOf(personTickets(g, pp.id, r.id));
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className="pn-person"
                    onClick={() => go(r.id)}
                  >
                    <span className="ver-tag">{r.version}</span>{" "}
                    {featuresForPerson(g, pp.id, r.id).length} features
                  </button>
                  <small>
                    {pr.done}/{pr.total} tickets
                  </small>
                </li>
              );
            })}
        </ul>
      </>
    );
  }

  if (sel.kind === "module") {
    const m = byId(g.modules, sel.id);
    if (!m) return null;
    const list = [...g.releases].sort((a, b) => a.date.localeCompare(b.date));
    body = (
      <>
        <div className="pn-chips">
          <span
            className="chip"
            style={{ borderColor: m.color, color: m.color }}
          >
            Module
          </span>
        </div>
        <h2>{m.name}</h2>
        <p className="pn-key">
          Every feature this module has had, version by version
        </p>
        <ol className="pn-chain">
          {list.flatMap((r) =>
            featuresIn(g, r.id)
              .filter((f) => f.moduleId === m.id)
              .map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: "select",
                        selected: { kind: "feature", id: f.id },
                      })
                    }
                  >
                    <span className="ver-tag">{r.version}</span> {f.name}
                  </button>
                </li>
              )),
          )}
        </ol>
        <p className="pn-muted">
          {g.bugs.filter((b) => b.moduleId === m.id).length} bugs reported on
          this module so far.
        </p>
      </>
    );
  }

  if (sel.kind === "product") {
    body = (
      <>
        <h2>{g.product.name}</h2>
        <p className="pn-key">
          {g.modules.length} modules · {g.releases.length} versions ·{" "}
          {g.features.length} features · {g.tickets.length} tickets
        </p>
        <Meter done={progressOf(g.tickets).done} total={g.tickets.length} />
        <p className="pn-muted">
          {pct(progressOf(g.tickets))}% of all tickets ever planned are done.
        </p>
      </>
    );
  }

  return (
    <aside className="panel" aria-label="Details">
      <button
        type="button"
        className="pn-close"
        onClick={close}
        aria-label="Close details"
      >
        ×
      </button>
      {body}
    </aside>
  );
}
