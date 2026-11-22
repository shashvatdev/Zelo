"use client";

import {
  bugsIn,
  byId,
  featuresForPerson,
  featuresIn,
  openBugs,
  pct,
  releaseProgress,
  progressOf,
  personTickets,
} from "@/lib/graph";
import { useStore } from "@/lib/store";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AskButton } from "./AskZelo";
import Notifications from "./Notifications";
import { SideToggle } from "./Sidebar";

/** Quick add for work that has no feature: lands in the release's Miscellaneous bucket. */
function MiscAdd() {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const g = state.graph;
  const release =
    g.releases.find((r) => r.id === state.scope) ??
    g.releases.find((r) => r.state === "current")!;

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) =>
      !wrap.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key);
    };
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (state.scope !== release.id)
      dispatch({ type: "scope", scope: release.id });
    dispatch({ type: "addMiscTicket", releaseId: release.id, title });
    setTitle("");
    setOpen(false);
  };

  return (
    <div className="misc-add" ref={wrap}>
      <button
        type="button"
        className="misc-btn"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path
            d="M7 2.5v9M2.5 7h9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <span className="misc-label">Misc task</span>
      </button>
      {open && (
        <form className="misc-pop" onSubmit={submit}>
          <label htmlFor="misc-title">
            Work that isn&apos;t part of a feature
          </label>
          <input
            id="misc-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Renew the domain"
          />
          <div className="misc-row">
            <span>
              Goes to <b>{release.version}</b> · Miscellaneous
            </span>
            <button type="submit" className="btn-ink" disabled={!title.trim()}>
              Add
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** "Saving…" while changes are on their way, then a "Saved" that fades out by itself. */
function SaveState() {
  const { saving, savedAt, live } = useStore();
  const dot = (
    <span className={`live-dot ${live ? "on" : ""}`} title={live ? "Live: changes from your team appear instantly" : "Reconnecting… changes still sync every few seconds"}>
      {live ? "Live" : "Offline"}
    </span>
  );
  if (saving)
    return (
      <>
        {dot}
        <span className="save-state saving" role="status" aria-live="polite">
          Saving…
        </span>
      </>
    );
  return (
    <>
      {dot}
      {savedAt && (
        <span key={savedAt} className="save-state saved" role="status" aria-live="polite">
          Saved
        </span>
      )}
    </>
  );
}

export default function TopBar() {
  const { state, dispatch } = useStore();
  const g = state.graph;
  const release =
    state.scope === "all" ? undefined : byId(g.releases, state.scope);
  const person = byId(g.people, state.personId);

  let features: number;
  let progress;
  let bugs: number;
  if (release) {
    features = (
      person
        ? featuresForPerson(g, person.id, release.id)
        : featuresIn(g, release.id)
    ).length;
    progress = releaseProgress(g, release.id, person?.id);
    bugs = openBugs(bugsIn(g, release.id, person?.id)).length;
  } else {
    features = person
      ? featuresForPerson(g, person.id).length
      : g.features.length;
    progress = person
      ? progressOf(personTickets(g, person.id))
      : progressOf(g.tickets);
    bugs = openBugs(
      person ? g.bugs.filter((b) => b.assigneeId === person.id) : g.bugs,
    ).length;
  }

  return (
    <header className="top">
      <div className="top-left">
        {!state.sideOpen && <SideToggle open={false} />}
        <nav className="crumbs" aria-label="Breadcrumb">
          <span>{g.product.name}</span>
          <b>/</b>
          <strong>
            {release ? `${release.version} · ${release.name}` : "All versions"}
          </strong>
          {person && (
            <>
              <b>/</b>
              <button
                type="button"
                className="person-chip"
                onClick={() => dispatch({ type: "person", personId: null })}
                title="Show everyone"
              >
                {person.name} <span aria-hidden="true">×</span>
              </button>
            </>
          )}
        </nav>
      </div>
      <div className="top-right">
        <SaveState />
        <div className="stats">
          <span className="stat">
            <strong>{features}</strong> features
          </span>
          <span className="stat">
            <strong>
              {progress.done}/{progress.total}
            </strong>{" "}
            tickets · {pct(progress)}%
          </span>
          <span className={`stat ${bugs ? "warn" : ""}`}>
            <strong>{bugs}</strong> open bugs
          </span>
        </div>
        <Notifications />
        <MiscAdd />
        <AskButton />
      </div>
    </header>
  );
}
