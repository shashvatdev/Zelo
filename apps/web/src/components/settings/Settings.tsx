"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  inviteDaysLeft,
  inviteLink,
  PLANS,
  removeMember,
  resendInvite,
  revokeInvite,
  ROLE_HINT,
  ROLE_LABEL,
  setRole,
  setSeats,
  slugify,
  updateWorkspace,
  useMe,
  useProviders,
  useWorkspace,
  type Role,
} from "@/lib/account";
import { ApiError, useQuery } from "@/lib/api";
import { copyText, InviteForm } from "../invite/Invite";
import { Picker } from "../Picker";
import { DemoNote, Field, Logo, Modal } from "../ui";

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const TABS = ["members", "billing", "workspace"] as const;
type Tab = (typeof TABS)[number];
type Payment = { id: string; plan: string; seats: number; amountCents: number; taxCents: number; status: "paid" | "failed"; failureReason: string | null; card: string | null; createdAt: string };

function Initial({ name, color, pending }: { name: string; color?: string; pending?: boolean }) {
  return (
    <span className={`init ${pending ? "pending" : ""}`} style={pending ? undefined : { background: color }}>
      {pending ? "✉" : name[0]?.toUpperCase()}
    </span>
  );
}

export default function Settings() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (TABS.includes(params.get("tab") as Tab) ? params.get("tab") : "members") as Tab;
  const { me } = useMe();
  const { data: providers } = useProviders();
  const wsId = me?.activeWorkspaceId ?? null;
  const { data: ws, error: wsError } = useWorkspace(wsId);
  const payments = useQuery<Payment[]>(ws?.canManage && tab === "billing" ? `/api/workspaces/${ws.id}/payments` : null);
  const [inviting, setInviting] = useState(params.get("invite") === "1");
  const [copied, setCopied] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const [wsName, setWsName] = useState<string | null>(null);
  const [wsSlug, setWsSlug] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    if (me === null) router.replace("/login?next=/settings");
    else if (me && !wsId) router.replace("/onboarding");
  }, [me, wsId, router]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  if (wsError) return <div className="boot center"><p className="form-error">{wsError.message}</p></div>;
  if (!me || !ws) return <div className="boot" aria-busy="true" />;

  const user = me.user;
  const canManage = ws.canManage;
  const seats = ws.plan === "free" ? PLANS.free.maxUsers! : ws.seats;
  const usedSeats = ws.members.filter((m) => m.role !== "viewer").length + ws.invites.filter((i) => i.role !== "viewer" && !i.expired).length;
  const P = PLANS[ws.plan];
  const yearly = P.price * ws.seats * 12;
  const setTab = (t: Tab) => router.replace(`/settings?tab=${t}`);

  /** Runs a member/invite action with a per-row busy state and a clear message on failure. */
  const run = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusyKey(key);
    try {
      await fn();
      if (done) setNotice({ text: done });
    } catch (e) {
      setNotice({ text: e instanceof ApiError ? e.message : "That didn't work. Try again.", bad: true });
    } finally {
      setBusyKey(null);
    }
  };

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
              {t === "members" && <span>{ws.members.length + ws.invites.length}</span>}
            </button>
          ))}
        </nav>

        <main className="set-main">
          {notice && (
            <p className={`notice ${notice.bad ? "bad" : ""}`} role="status">
              {notice.text}
            </p>
          )}

          {tab === "members" && (
            <>
              <div className="set-head">
                <div>
                  <h1>Members</h1>
                  <p>
                    {ws.members.length} active · {ws.invites.length} invited · {usedSeats} of {seats} seats used
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

              <ul className="mlist">
                {ws.members.map((m) => {
                  const isMe = m.userId === user.id;
                  return (
                    <li key={m.userId}>
                      <Initial name={m.name} color={m.color} />
                      <span className="m-who">
                        <strong>
                          {m.name}
                          {isMe && <em> (you)</em>}
                        </strong>
                        <small>
                          {m.email} · joined {fmt(m.joinedAt)}
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
                            onChange={(r) => void run(`role-${m.userId}`, () => setRole(ws.id, m.userId, r as Exclude<Role, "owner">), `${m.name} is now ${ROLE_LABEL[r as Role].toLowerCase()}.`)}
                            className="pk-compact role-pk"
                            menuWidth={240}
                            options={(["admin", "member", "viewer"] as const).map((r) => ({ value: r, label: ROLE_LABEL[r], sub: ROLE_HINT[r] }))}
                            trigger={<span className="pk-value">{ROLE_LABEL[m.role]}</span>}
                          />
                        )}
                      </span>
                      <span className="m-status">
                        <span className="pill ok">Active</span>
                      </span>
                      <span className="m-actions">
                        {canManage && m.role !== "owner" && !isMe && (
                          <button
                            type="button"
                            className="mini-btn danger"
                            disabled={busyKey === `rm-${m.userId}`}
                            onClick={() => window.confirm(`Remove ${m.name} from ${ws.name}? Their open tickets become unassigned.`) && void run(`rm-${m.userId}`, () => removeMember(ws.id, m.userId), `${m.name} was removed.`)}
                          >
                            Remove
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
                {ws.invites.map((i) => (
                  <li key={i.id} className="is-pending">
                    <Initial name={i.email} pending />
                    <span className="m-who">
                      <strong>{i.email}</strong>
                      <small>
                        {i.expired ? `Invite expired · sent ${fmt(i.createdAt)}` : `Invited ${fmt(i.createdAt)} by ${i.inviterName ?? "a teammate"} · expires in ${inviteDaysLeft(i.expiresAt)} day${inviteDaysLeft(i.expiresAt) === 1 ? "" : "s"}`}
                      </small>
                    </span>
                    <span className="m-role">
                      <span className="role-tag">{ROLE_LABEL[i.role]}</span>
                    </span>
                    <span className="m-status">
                      <span className={`pill ${i.expired ? "bad" : "wait"}`}>{i.expired ? "Expired" : "Pending"}</span>
                    </span>
                    <span className="m-actions">
                      {canManage && (
                        <>
                          {providers?.devMailbox && (
                            <a className="mini-btn" href={`/dev/mailbox?to=${encodeURIComponent(i.email)}`} target="_blank" rel="noreferrer">
                              View email
                            </a>
                          )}
                          <button
                            type="button"
                            className="mini-btn"
                            disabled={busyKey === `link-${i.id}`}
                            onClick={() =>
                              void run(`link-${i.id}`, async () => {
                                const link = await inviteLink(ws.id, i.id);
                                if (await copyText(link)) {
                                  setCopied(i.id);
                                  setTimeout(() => setCopied(null), 1600);
                                } else window.prompt("Copy this invite link:", link);
                              })
                            }
                            title="Makes a fresh link; the old one stops working"
                          >
                            {copied === i.id ? "Copied" : "Copy link"}
                          </button>
                          <button type="button" className="mini-btn" disabled={busyKey === `re-${i.id}`} onClick={() => void run(`re-${i.id}`, () => resendInvite(ws.id, i.id), `Invite sent again to ${i.email}.`)}>
                            Resend
                          </button>
                          <button type="button" className="mini-btn danger" disabled={busyKey === `rv-${i.id}`} onClick={() => void run(`rv-${i.id}`, () => revokeInvite(ws.id, i.id), `Invite to ${i.email} cancelled.`)}>
                            Revoke
                          </button>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
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
                  {ws.paidUntil && <p className="muted">Renews on {fmt(ws.paidUntil)}</p>}
                  {ws.role === "owner" && (
                    <div className="bill-actions">
                      {ws.plan !== "business" && (
                        <Link className="btn-ink" href={`/checkout?plan=${ws.plan === "free" ? "team" : "business"}&upgrade=1`}>
                          Upgrade to {ws.plan === "free" ? "Team" : "Business"}
                        </Link>
                      )}
                      {ws.plan !== "free" && (
                        <span className="stepper small">
                          <button type="button" disabled={busyKey === "seats"} onClick={() => void run("seats", () => setSeats(ws.id, ws.seats - 1))} aria-label="Fewer seats">
                            −
                          </button>
                          <span>{ws.seats} seats</span>
                          <button type="button" disabled={busyKey === "seats"} onClick={() => void run("seats", () => setSeats(ws.id, ws.seats + 1))} aria-label="More seats">
                            +
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                </section>
                <section className="bill-card">
                  <span className="bill-label">Payment method</span>
                  {ws.card ? (
                    <p className="card-line">
                      <span className="cbrand on">{ws.card.brand}</span> •••• {ws.card.last4} <span className="muted">exp {ws.card.exp}</span>
                    </p>
                  ) : (
                    <p className="muted">{!canManage ? "Only admins can see billing details." : ws.plan !== "free" && ws.paidUntil ? "No card needed: payments are in demo mode until a payment provider is connected." : "No card on file."}</p>
                  )}
                </section>
                <section className="bill-card wide">
                  <span className="bill-label">Payments</span>
                  {!canManage ? (
                    <p className="muted">Only admins can see payments.</p>
                  ) : payments.data?.length ? (
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
                        {payments.data.map((p) => (
                          <tr key={p.id}>
                            <td>{fmt(p.createdAt)}</td>
                            <td>
                              {PLANS[p.plan as keyof typeof PLANS]?.name ?? p.plan} · {p.seats} seats{p.card ? ` · ${p.card}` : ""}
                              {p.failureReason ? <small className="muted"> · {p.failureReason}</small> : null}
                            </td>
                            <td>${((p.amountCents + p.taxCents) / 100).toLocaleString()}</td>
                            <td>
                              <span className={`pill ${p.status === "paid" ? "ok" : "bad"}`}>{p.status === "paid" ? "Paid" : "Failed"}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="muted">{payments.loading ? "Loading…" : "No payments yet."}</p>
                  )}
                </section>
              </div>
              <DemoNote>Payments run in test mode until a payment provider is connected.</DemoNote>
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
                  setSaveState("saving");
                  void run("ws", async () => {
                    await updateWorkspace(ws.id, { name: (wsName ?? ws.name).trim() || ws.name, slug: slugify(wsSlug ?? ws.slug ?? "") || undefined });
                    setSaveState("saved");
                    setTimeout(() => setSaveState("idle"), 1500);
                  }).finally(() => setSaveState((s) => (s === "saving" ? "idle" : s)));
                }}
              >
                <Field label="Name">
                  <input value={wsName ?? ws.name} onChange={(e) => setWsName(e.target.value)} disabled={!canManage} />
                </Field>
                <Field label="URL">
                  <span className="url-input">
                    <span>zelo.app/</span>
                    <input value={wsSlug ?? ws.slug ?? ""} onChange={(e) => setWsSlug(slugify(e.target.value))} disabled={!canManage} />
                  </span>
                </Field>
                {canManage && (
                  <button type="submit" className="btn-ink" disabled={saveState === "saving"}>
                    {saveState === "saved" ? "Saved ✓" : saveState === "saving" ? "Saving…" : "Save changes"}
                  </button>
                )}
              </form>
            </>
          )}
        </main>
      </div>

      {inviting && canManage && (
        <Modal title={`Invite people to ${ws.name}`} sub="They'll get an email with a link to join." onClose={() => setInviting(false)} width={560}>
          <InviteForm ws={ws} compact />
        </Modal>
      )}
    </div>
  );
}
