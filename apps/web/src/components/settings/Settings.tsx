"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  currentUser,
  currentWorkspace,
  inviteDaysLeft,
  inviteExpired,
  PERSON_COLORS,
  PLANS,
  removeMember,
  resendInvite,
  revokeInvite,
  ROLE_HINT,
  ROLE_LABEL,
  setRole,
  slugify,
  updateWorkspace,
  useDb,
  type Member,
  type Role,
} from "@/lib/account";
import { EmailPreview, InviteForm, inviteLink } from "../invite/Invite";
import { Picker } from "../Picker";
import { DemoNote, Field, Logo, Modal } from "../ui";

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const TABS = ["members", "billing", "workspace"] as const;
type Tab = (typeof TABS)[number];

function Initial({ name, i, pending }: { name: string; i: number; pending?: boolean }) {
  return (
    <span className={`init ${pending ? "pending" : ""}`} style={pending ? undefined : { background: PERSON_COLORS[i % PERSON_COLORS.length] }}>
      {pending ? "✉" : name[0]?.toUpperCase()}
    </span>
  );
}

export default function Settings() {
  const db = useDb();
  const router = useRouter();
  const params = useSearchParams();
  const tab = (TABS.includes(params.get("tab") as Tab) ? params.get("tab") : "members") as Tab;
  const [inviting, setInviting] = useState(params.get("invite") === "1");
  const [preview, setPreview] = useState<Member | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [wsName, setWsName] = useState<string | null>(null);
  const [wsSlug, setWsSlug] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const user = db ? currentUser(db) : undefined;
  const ws = db ? currentWorkspace(db) : undefined;
  useEffect(() => {
    if (db && (!user || !ws)) router.replace(!user ? "/login" : "/onboarding");
  }, [db, user, ws, router]);
  if (!db || !user || !ws) return <div className="boot" aria-busy="true" />;

  const me = ws.members.find((m) => m.userId === user.id);
  const canManage = me?.role === "owner" || me?.role === "admin";
  const list = ws.members.filter((m) => m.status !== "revoked");
  const active = list.filter((m) => m.status === "active");
  const invited = list.filter((m) => m.status === "invited");
  const seats = ws.plan === "free" ? PLANS.free.maxUsers! : ws.seats;
  const usedSeats = list.filter((m) => m.role !== "viewer").length;
  const P = PLANS[ws.plan];
  const renews = ws.paidAt ? new Date(new Date(ws.paidAt).getTime() + 365 * 86400000).toISOString() : undefined;
  const yearly = P.price * ws.seats * 12;
  const product = (() => {
    try {
      return (JSON.parse(localStorage.getItem(`zelo-graph-${ws.id}`) ?? "null") as { product?: { name: string } } | null)?.product?.name;
    } catch {
      return undefined;
    }
  })();

  const copy = (m: Member) => {
    void navigator.clipboard?.writeText(inviteLink(m.token));
    setCopied(m.email);
    setTimeout(() => setCopied(null), 1600);
  };
  const setTab = (t: Tab) => router.replace(`/settings?tab=${t}`);

  return (
    <div className="settings">
      <header className="set-top">
        <Link href="/app" className="set-back">
          ← Back to the map
        </Link>
        <Logo size={22} />
        <span className="set-ws">{ws.name}</span>
      </header>
      <div className="set-wrap">
        <nav className="set-tabs" aria-label="Settings">
          {TABS.map((t) => (
            <button key={t} type="button" className={tab === t ? "on" : ""} onClick={() => setTab(t)} aria-current={tab === t ? "page" : undefined}>
              {t === "members" ? "Members" : t === "billing" ? "Plan & billing" : "Workspace"}
              {t === "members" && <span>{list.length}</span>}
            </button>
          ))}
        </nav>

        <main className="set-main">
          {tab === "members" && (
            <>
              <div className="set-head">
                <div>
                  <h1>Members</h1>
                  <p>
                    {active.length} active · {invited.length} invited · {usedSeats} of {seats} seats used
                  </p>
                </div>
                {canManage && (
                  <button type="button" className="btn-ink" onClick={() => setInviting(true)}>
                    + Invite people
                  </button>
                )}
              </div>
              <div className="seatbar" aria-hidden="true">
                <span style={{ width: `${Math.min(100, (usedSeats / seats) * 100)}%` }} className={usedSeats > seats ? "over" : ""} />
              </div>
              {usedSeats > seats && (
                <p className="warn-line">
                  You&apos;re over your {seats} seats. <button type="button" className="link-btn" onClick={() => setTab("billing")}>Add seats</button>
                </p>
              )}

              <ul className="mlist">
                {list.map((m, i) => {
                  const pending = m.status === "invited";
                  const expired = pending && inviteExpired(m);
                  const isMe = m.userId === user.id;
                  const daysLeft = pending ? inviteDaysLeft(m) : 0;
                  return (
                    <li key={m.email} className={pending ? "is-pending" : ""}>
                      <Initial name={m.name ?? m.email} i={i} pending={pending} />
                      <span className="m-who">
                        <strong>
                          {pending ? m.email : m.name}
                          {isMe && <em> (you)</em>}
                        </strong>
                        <small>
                          {pending
                            ? expired
                              ? `Invite expired · sent ${fmt(m.invitedAt)}`
                              : `Invited ${fmt(m.invitedAt)} by ${db.users.find((u) => u.id === m.invitedBy)?.name ?? "a teammate"} · expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
                            : `${m.email} · joined ${fmt(m.acceptedAt)}`}
                        </small>
                      </span>
                      <span className="m-role">
                        {m.role === "owner" || !canManage || isMe ? (
                          <span className="role-tag" title={ROLE_HINT[m.role]}>
                            {ROLE_LABEL[m.role]}
                          </span>
                        ) : (
                          <Picker
                            label={`Role for ${m.email}`}
                            value={m.role}
                            onChange={(r) => setRole(ws.id, m.email, r as Role)}
                            className="pk-compact role-pk"
                            menuWidth={240}
                            options={(["admin", "member", "viewer"] as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r], sub: ROLE_HINT[r] }))}
                            trigger={<span className="pk-value">{ROLE_LABEL[m.role]}</span>}
                          />
                        )}
                      </span>
                      <span className="m-status">{pending ? <span className={`pill ${expired ? "bad" : "wait"}`}>{expired ? "Expired" : "Pending"}</span> : <span className="pill ok">Active</span>}</span>
                      <span className="m-actions">
                        {pending && canManage && (
                          <>
                            <button type="button" className="mini-btn" onClick={() => setPreview(m)}>
                              View email
                            </button>
                            <button type="button" className="mini-btn" onClick={() => copy(m)}>
                              {copied === m.email ? "Copied" : "Copy link"}
                            </button>
                            <button type="button" className="mini-btn" onClick={() => resendInvite(ws.id, m.email)}>
                              Resend
                            </button>
                            <button type="button" className="mini-btn danger" onClick={() => revokeInvite(ws.id, m.email)}>
                              Revoke
                            </button>
                          </>
                        )}
                        {!pending && canManage && m.role !== "owner" && !isMe && (
                          <button type="button" className="mini-btn danger" onClick={() => removeMember(ws.id, m.email)}>
                            Remove
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <DemoNote>Invite emails aren&apos;t sent in the demo. Use “View email” or “Copy link” and open it to accept as that person.</DemoNote>
            </>
          )}

          {tab === "billing" && (
            <>
              <div className="set-head">
                <div>
                  <h1>Plan & billing</h1>
                  <p>Billed yearly in USD.</p>
                </div>
              </div>
              <div className="bill-grid">
                <section className="bill-card main">
                  <span className="bill-label">Current plan</span>
                  <strong className="bill-plan">{P.name}</strong>
                  <p>{ws.plan === "free" ? "Free forever for up to 5 people." : `${ws.seats} seats · $${P.price} per user / month · $${yearly.toLocaleString()} a year`}</p>
                  {renews && <p className="muted">Renews on {fmt(renews)}</p>}
                  <div className="bill-actions">
                    {ws.plan !== "business" && (
                      <Link className="btn-ink" href={`/checkout?plan=${ws.plan === "free" ? "team" : "business"}`}>
                        Upgrade to {ws.plan === "free" ? "Team" : "Business"}
                      </Link>
                    )}
                    {ws.plan !== "free" && (
                      <span className="stepper small">
                        <button type="button" onClick={() => updateWorkspace(ws.id, { seats: Math.max(usedSeats, ws.seats - 1) })} aria-label="Fewer seats">
                          −
                        </button>
                        <span>{ws.seats} seats</span>
                        <button type="button" onClick={() => updateWorkspace(ws.id, { seats: ws.seats + 1 })} aria-label="More seats">
                          +
                        </button>
                      </span>
                    )}
                  </div>
                </section>
                <section className="bill-card">
                  <span className="bill-label">Payment method</span>
                  {ws.card ? (
                    <p className="card-line">
                      <span className="cbrand on">{ws.card.brand}</span> •••• {ws.card.last4} <span className="muted">exp {ws.card.exp}</span>
                    </p>
                  ) : (
                    <p className="muted">No card on file.</p>
                  )}
                </section>
                <section className="bill-card wide">
                  <span className="bill-label">Invoices</span>
                  {ws.paidAt ? (
                    <table className="inv-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Description</th>
                          <th>Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>{fmt(ws.paidAt)}</td>
                          <td>
                            {P.name} · {ws.seats} seats · 12 months
                          </td>
                          <td>${yearly.toLocaleString()}</td>
                          <td>
                            <span className="pill ok">Paid</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <p className="muted">No invoices yet.</p>
                  )}
                </section>
              </div>
              <DemoNote>Test mode. Seat changes would be prorated by the payment provider.</DemoNote>
            </>
          )}

          {tab === "workspace" && (
            <>
              <div className="set-head">
                <div>
                  <h1>Workspace</h1>
                  <p>Created {fmt(ws.createdAt)}</p>
                </div>
              </div>
              <form
                className="form narrow"
                onSubmit={(e) => {
                  e.preventDefault();
                  updateWorkspace(ws.id, { name: (wsName ?? ws.name).trim() || ws.name, slug: slugify(wsSlug ?? ws.slug) || ws.slug });
                  setSaved(true);
                  setTimeout(() => setSaved(false), 1500);
                }}
              >
                <Field label="Name">
                  <input value={wsName ?? ws.name} onChange={(e) => setWsName(e.target.value)} disabled={!canManage} />
                </Field>
                <Field label="URL">
                  <span className="url-input">
                    <span>zelo.app/</span>
                    <input value={wsSlug ?? ws.slug} onChange={(e) => setWsSlug(slugify(e.target.value))} disabled={!canManage} />
                  </span>
                </Field>
                {canManage && (
                  <button type="submit" className="btn-ink">
                    {saved ? "Saved ✓" : "Save changes"}
                  </button>
                )}
              </form>
            </>
          )}
        </main>
      </div>

      {inviting && (
        <Modal title={`Invite people to ${ws.name}`} sub="They'll get an email with a link to join." onClose={() => setInviting(false)} width={560}>
          <InviteForm ws={ws} me={user} product={product} compact />
        </Modal>
      )}
      {preview && <EmailPreview ws={ws} member={preview} inviter={db.users.find((u) => u.id === preview.invitedBy)} product={product} onClose={() => setPreview(null)} />}
    </div>
  );
}
