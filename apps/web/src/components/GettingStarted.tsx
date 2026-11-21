"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Workspace } from "@/lib/account";
import { useStore } from "@/lib/store";

type Step = { id: string; label: string; done: boolean; action?: () => void; href?: string; cta: string };

/** Floating checklist for a new workspace: what to do first, ticked off as it happens. */
export default function GettingStarted({ ws }: { ws: Workspace }) {
  const { state, dispatch } = useStore();
  const key = `zelo-start-${ws.id}`;
  const [flags, setFlags] = useState<{ hidden?: boolean; asked?: boolean; open?: boolean }>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "{}");
    } catch {
      return {};
    }
  });
  const save = (f: typeof flags) => {
    setFlags(f);
    try {
      localStorage.setItem(key, JSON.stringify(f));
    } catch {
      // not saved
    }
  };

  const asked = flags.asked || state.askOpen;
  useEffect(() => {
    if (state.askOpen && !flags.asked) {
      try {
        localStorage.setItem(key, JSON.stringify({ ...flags, asked: true }));
      } catch {
        // not saved
      }
    }
  }, [state.askOpen, flags, key]);

  const g = state.graph;
  const others = ws.members.filter((m) => m.role !== "owner" && m.status !== "revoked");
  const current = g.releases.find((r) => r.state === "current") ?? g.releases[0];
  const steps: Step[] = [
    { id: "ws", label: "Create your workspace", done: true, cta: "" },
    { id: "invite", label: "Invite your team", done: others.length > 0, href: "/settings?tab=members&invite=1", cta: "Invite" },
    { id: "feature", label: "Add your first feature", done: g.features.some((f) => !g.modules.find((m) => m.id === f.moduleId)?.misc), action: () => window.dispatchEvent(new CustomEvent("zelo:add-feature")), cta: "Add" },
    { id: "ticket", label: "Break it into tickets", done: g.tickets.length > 0, action: () => g.features[0] && dispatch({ type: "goto", scope: g.features[0].releaseId, selected: { kind: "feature", id: g.features[0].id } }), cta: g.features.length ? "Open" : "" },
    { id: "assign", label: "Assign a ticket to someone", done: g.tickets.some((t) => t.assigneeId && t.assigneeId !== state.meId), cta: "" },
    { id: "version", label: "Plan your next version", done: g.releases.length > 1, action: () => window.dispatchEvent(new CustomEvent("zelo:new-version")), cta: "Plan" },
    { id: "ask", label: "Ask Zelo a question", done: !!asked, action: () => dispatch({ type: "ask", open: true }), cta: "Try" },
  ];
  const done = steps.filter((s) => s.done).length;
  const open = flags.open ?? true;

  if (flags.hidden || !current) return null;
  return (
    <aside className={`start ${open ? "" : "closed"}`} aria-label="Getting started">
      <button type="button" className="start-head" onClick={() => save({ ...flags, open: !open })} aria-expanded={open}>
        <span className="start-ring" style={{ "--p": done / steps.length } as React.CSSProperties}>
          <span>
            {done}/{steps.length}
          </span>
        </span>
        <span className="start-title">
          <strong>Getting started</strong>
          <small>{done === steps.length ? "All done. Nice work." : `${steps.length - done} steps to a working board`}</small>
        </span>
        <svg className="start-caret" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 7.5 6 4.5 9 7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <>
          <ol className="start-list">
            {steps.map((s) => (
              <li key={s.id} className={s.done ? "done" : ""}>
                <span className="start-check" aria-hidden="true">
                  {s.done ? "✓" : ""}
                </span>
                <span className="start-label">{s.label}</span>
                {!s.done && s.cta && (s.href ? <Link href={s.href} className="start-cta">{s.cta}</Link> : s.action && <button type="button" className="start-cta" onClick={s.action}>{s.cta}</button>)}
              </li>
            ))}
          </ol>
          <button type="button" className="start-hide" onClick={() => save({ ...flags, hidden: true })}>
            Hide this list
          </button>
        </>
      )}
    </aside>
  );
}
