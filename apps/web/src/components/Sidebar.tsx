"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { enterDemo, logOut, PLANS, ROLE_LABEL, switchWorkspace, useMe, type Workspace } from "@/lib/account";
import { fmtDate, pct, personTickets, progressOf, releaseProgress } from "@/lib/graph";
import { useStore } from "@/lib/store";
import NewVersion from "./NewVersion";
import { Avatar } from "./nodes";
import { Logo } from "./ui";

export { Logo };

export function SideToggle({ open }: { open: boolean }) {
  const { dispatch } = useStore();
  const label = open ? "Hide sidebar" : "Show sidebar";
  return (
    <button type="button" className="side-toggle" onClick={() => dispatch({ type: "side" })} aria-label={label} aria-expanded={open} title={`${label} (⌘\\)`}>
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2.5" y="3.5" width="15" height="13" rx="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7.5 3.5v13" stroke="currentColor" strokeWidth="1.6" />
        <path d={open ? "M13.5 8 11.5 10l2 2" : "M11.5 8l2 2-2 2"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

const Plus = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

/** Who you are, plus team, billing, switch account (demo) and log out. */
function UserMenu({ ws }: { ws: Workspace }) {
  const { me: session } = useMe();
  const router = useRouter();
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key);
    };
  }, [open]);
  const me = session?.user;
  const member = ws.members.find((m) => m.userId === state.meId);
  // Switching person is only offered in the sample workspace (it signs in as the other sample user).
  const others = ws.demo ? ws.members.filter((m) => m.userId !== state.meId) : [];
  const otherWorkspaces = (session?.workspaces ?? []).filter((w) => w.id !== ws.id && w.onboarded);

  return (
    <div className="umenu" ref={wrap}>
      {open && (
        <div className="umenu-pop" role="menu">
          <div className="umenu-who">
            <Avatar personId={state.meId} size={34} />
            <div>
              <strong>{me?.name}</strong>
              <small>{me?.email}</small>
            </div>
          </div>
          <Link href="/settings?tab=members" className="umenu-item" role="menuitem">
            Members and invites
            <span>{ws.members.length + ws.invites.length}</span>
          </Link>
          <Link href="/settings?tab=billing" className="umenu-item" role="menuitem">
            Plan and billing
            <span>{PLANS[ws.plan].name}</span>
          </Link>
          <Link href="/settings?tab=workspace" className="umenu-item" role="menuitem">
            Workspace settings
          </Link>
          {otherWorkspaces.length > 0 && (
            <>
              <p className="umenu-h">Your workspaces</p>
              {otherWorkspaces.map((w) => (
                <button key={w.id} type="button" className="umenu-item" role="menuitem" onClick={() => void switchWorkspace(w.id)}>
                  {w.name || "Untitled"}
                  <span>{ROLE_LABEL[w.role]}</span>
                </button>
              ))}
            </>
          )}
          {others.length > 0 && (
            <>
              <p className="umenu-h">Switch person (sample)</p>
              {others.map((m) => (
                <button key={m.email} type="button" className="umenu-item" role="menuitem" onClick={() => void enterDemo(m.email.startsWith("shashvat") ? "shashvat" : "bhumika")}>
                  <span className="umenu-sw">
                    <Avatar personId={m.userId} size={20} /> {m.name}
                  </span>
                  <span>{ROLE_LABEL[m.role]}</span>
                </button>
              ))}
            </>
          )}
          <button
            type="button"
            className="umenu-item danger"
            role="menuitem"
            onClick={() => {
              void logOut().then(() => router.replace("/login"));
            }}
          >
            Log out
          </button>
        </div>
      )}
      <button type="button" className="umenu-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        <Avatar personId={state.meId} size={30} />
        <span className="umenu-text">
          <strong>{me?.name ?? "You"}</strong>
          <small>
            {ws.name} · {member ? ROLE_LABEL[member.role] : ""}
          </small>
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 7.5 6 4.5 9 7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

function AddModule() {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    dispatch({ type: "addModule", name });
    setName("");
    setOpen(false);
  };
  if (!open)
    return (
      <button type="button" className="legend-btn add" onClick={() => setOpen(true)}>
        <Plus /> Module
      </button>
    );
  return (
    <form className="mod-form" onSubmit={submit}>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={() => !name && setOpen(false)} placeholder="Module name" aria-label="New module name" />
      <button type="submit" className="btn-ink" disabled={!name.trim()}>
        Add
      </button>
    </form>
  );
}

export default function Sidebar({ ws }: { ws: Workspace }) {
  const { state, dispatch } = useStore();
  const [newVersion, setNewVersion] = useState(false);
  const g = state.graph;
  const releases = [...g.releases].sort((a, b) => b.date.localeCompare(a.date));
  const first = [...g.releases].sort((a, b) => a.date.localeCompare(b.date))[0];
  const last = releases[0];
  const scopeRelease = state.scope === "all" ? undefined : state.scope;
  const pending = ws.invites.filter((i) => !i.expired);
  const month = (d: string) => fmtDate(d).split(" ").slice(1).join(" ");

  useEffect(() => {
    const open = () => setNewVersion(true);
    window.addEventListener("zelo:new-version", open);
    return () => window.removeEventListener("zelo:new-version", open);
  }, []);

  return (
    <aside className="side" aria-hidden={!state.sideOpen} inert={!state.sideOpen}>
      <div className="side-top">
        <div className="side-brand">
          <Logo />
          <SideToggle open />
        </div>
        <div className="product-pill" title={`${ws.name} workspace`}>
          <span className="product-dot" />
          <span>{g.product.name}</span>
        </div>
      </div>

      <nav className="side-sec" aria-label="Versions">
        <p className="side-h">
          <span>Versions</span>
          <span className="side-h-right">
            <span className="side-count">{g.releases.length}</span>
            <button type="button" className="side-add" onClick={() => setNewVersion(true)} aria-label="New version" title="New version">
              <Plus />
            </button>
          </span>
        </p>
        {first && (
          <button type="button" className={`side-item all ${state.scope === "all" ? "on" : ""}`} onClick={() => dispatch({ type: "scope", scope: "all" })}>
            <span className="all-ico" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M3 12h18M6 8v8M12 6v12M18 9v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="side-text">
              <strong>All versions</strong>
              <small>{first.id === last.id ? month(first.date) : `${month(first.date)} → ${month(last.date)}`}</small>
            </span>
          </button>
        )}
        {releases.map((r) => {
          const p = releaseProgress(g, r.id, state.personId);
          return (
            <button key={r.id} type="button" className={`side-item ${state.scope === r.id ? "on" : ""}`} onClick={() => dispatch({ type: "scope", scope: r.id })}>
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
          <span className="side-h-right">
            <span className="side-count">{g.people.length}</span>
            <Link href="/settings?tab=members&invite=1" className="side-add" aria-label="Invite people" title="Invite people">
              <Plus />
            </Link>
          </span>
        </p>
        <button type="button" className={`side-item ${!state.personId ? "on" : ""}`} onClick={() => dispatch({ type: "person", personId: null })}>
          <span className="avatar everyone" aria-hidden="true">
            ✱
          </span>
          <span className="side-text">
            <strong>Everyone</strong>
            <small>
              {g.people.length} {g.people.length === 1 ? "person" : "people"}
            </small>
          </span>
        </button>
        {g.people.map((person) => {
          const p = progressOf(personTickets(g, person.id, scopeRelease));
          const n = g.comments.filter((c) => c.body.includes(`@${person.name}`)).length;
          return (
            <button key={person.id} type="button" className={`side-item ${state.personId === person.id ? "on" : ""}`} onClick={() => dispatch({ type: "person", personId: person.id })}>
              <Avatar personId={person.id} size={26} />
              <span className="side-text">
                <strong>
                  {person.name}
                  {person.id === state.meId && <em className="you"> (you)</em>}
                </strong>
                <small>
                  {p.done}/{p.total} tickets {scopeRelease ? "here" : "overall"}
                </small>
              </span>
              {n > 0 && (
                <span className="mention-badge" title={`Tagged in ${n} comment${n === 1 ? "" : "s"}`}>
                  @{n}
                </span>
              )}
            </button>
          );
        })}
        {pending.map((m) => (
          <Link key={m.id} href="/settings?tab=members" className="side-item pending">
            <span className="avatar none" style={{ width: 26, height: 26 }}>
              ✉
            </span>
            <span className="side-text">
              <strong>{m.email}</strong>
              <small>Invited · waiting to accept</small>
            </span>
          </Link>
        ))}
      </nav>

      <div className="side-sec side-modules">
        <p className="side-h">
          <span>Modules</span>
          <span className="side-count">{g.modules.length}</span>
        </p>
        <ul className="legend">
          {g.modules.map((m) => (
            <li key={m.id}>
              <button type="button" className="legend-btn" onClick={() => dispatch({ type: "select", selected: { kind: "module", id: m.id } })}>
                <span className="legend-dot" style={{ background: m.color }} />
                {m.name}
              </button>
            </li>
          ))}
          <li>
            <AddModule />
          </li>
        </ul>
      </div>

      <div className="side-foot">
        {ws.demo && (
          <div className="side-demo">
            <span>Sample workspace, saved in this browser.</span>
            <button type="button" className="link-btn" onClick={() => dispatch({ type: "reset" })}>
              Reset
            </button>
          </div>
        )}
        <UserMenu ws={ws} />
      </div>
      {newVersion && <NewVersion onClose={() => setNewVersion(false)} />}
    </aside>
  );
}
