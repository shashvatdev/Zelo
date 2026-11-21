"use client";

import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { INVITE_DAYS, invite, isEmail, PLANS, ROLE_HINT, ROLE_LABEL, type Member, type Role, type User, type Workspace } from "@/lib/account";
import { Picker } from "../Picker";
import { Logo, Modal } from "../ui";

export const inviteLink = (token?: string) => (typeof window === "undefined" ? "" : `${window.location.origin}/invite?token=${token ?? ""}`);

/** What the invitee receives. Rendered as an email client would show it. */
export function InviteEmail({ ws, member, inviter, product }: { ws: Workspace; member: Pick<Member, "email" | "role" | "token">; inviter?: User; product?: string }) {
  const from = inviter?.name ?? "Your teammate";
  return (
    <div className="mail">
      <div className="mail-meta">
        <div>
          <span>From</span>
          <b>Zelo</b> &lt;invites@zelo.app&gt;
        </div>
        <div>
          <span>To</span>
          {member.email}
        </div>
        <div>
          <span>Subject</span>
          <b>
            {from} invited you to {ws.name || "their workspace"} on Zelo
          </b>
        </div>
      </div>
      <div className="mail-body">
        <Logo size={22} />
        <h3>
          Join {ws.name || "the team"} on Zelo
        </h3>
        <p>
          <b>{from}</b> invited you to work on {product ? <b>{product}</b> : "their product"} as {member.role === "admin" ? "an" : "a"} <b>{ROLE_LABEL[member.role].toLowerCase()}</b>. See every version, feature and ticket as one connected tree.
        </p>
        <a className="mail-btn" href={inviteLink(member.token)} target="_blank" rel="noreferrer">
          Accept invitation
        </a>
        <p className="mail-small">
          This link works for {INVITE_DAYS} days and only for {member.email}. If you weren&apos;t expecting it, you can ignore this email.
        </p>
      </div>
    </div>
  );
}

export function EmailPreview({ onClose, ...p }: Parameters<typeof InviteEmail>[0] & { onClose: () => void }) {
  return (
    <Modal title="Invite email" sub="What lands in their inbox. Demo: no email is sent; open the link to accept." onClose={onClose} width={560}>
      <InviteEmail {...p} />
      <div className="form-actions">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            void navigator.clipboard?.writeText(inviteLink(p.member.token));
          }}
        >
          Copy invite link
        </button>
        <a className="btn-ink" href={inviteLink(p.member.token)} target="_blank" rel="noreferrer">
          Open as {p.member.email.split("@")[0]} ↗
        </a>
      </div>
    </Modal>
  );
}

const ROLES: Role[] = ["admin", "member", "viewer"];

/**
 * Invite people by email: type or paste several, pick a role, send.
 * Shows seats left and, after sending, the email preview and link for each person.
 */
export function InviteForm({ ws, me, product, onSent, compact = false }: { ws: Workspace; me: User; product?: string; onSent?: (m: Member[]) => void; compact?: boolean }) {
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [error, setError] = useState("");
  const [sent, setSent] = useState<Member[]>([]);
  const [preview, setPreview] = useState<Member | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const used = ws.members.filter((m) => m.status !== "revoked" && m.role !== "viewer").length;
  const seats = ws.plan === "free" ? PLANS.free.maxUsers! : ws.seats;
  const editors = role === "viewer" ? 0 : emails.length;
  const over = used + editors > seats;

  const add = (raw: string) => {
    const parts = raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    const bad = parts.filter((p) => !isEmail(p));
    const known = parts.filter((p) => ws.members.some((m) => m.email === p && m.status === "active"));
    const good = parts.filter((p) => isEmail(p) && !known.includes(p) && !emails.includes(p));
    if (good.length) setEmails((e) => [...e, ...good]);
    setError(bad.length ? `Not an email: ${bad.join(", ")}` : known.length ? `Already in the workspace: ${known.join(", ")}` : "");
    setDraft("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (["Enter", ",", " ", "Tab"].includes(e.key) && draft.trim()) {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && emails.length) setEmails((x) => x.slice(0, -1));
  };
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const t = e.clipboardData.getData("text");
    if (/[\s,;]/.test(t)) {
      e.preventDefault();
      add(t);
    }
  };

  const send = () => {
    const list = draft.trim() ? [...emails, ...draft.split(/[\s,;]+/).filter(isEmail)] : emails;
    if (!list.length) return;
    const made = invite(ws.id, list, role, me.id);
    setSent((s) => [...made, ...s]);
    setEmails([]);
    setDraft("");
    setError("");
    onSent?.(made);
  };

  const copy = (m: Member) => {
    void navigator.clipboard?.writeText(inviteLink(m.token));
    setCopied(m.email);
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <div className={`invite ${compact ? "compact" : ""}`}>
      <div className="chips-input" onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}>
        {emails.map((em) => (
          <span key={em} className="email-chip">
            {em}
            <button type="button" onClick={() => setEmails((x) => x.filter((y) => y !== em))} aria-label={`Remove ${em}`}>
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onPaste={onPaste}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={emails.length ? "Add another…" : "name@company.com, another@company.com"}
          aria-label="Email addresses"
        />
      </div>
      {error && <p className="field-error">{error}</p>}
      <div className="invite-bar">
        <Picker
          label="Role"
          value={role}
          onChange={(v) => setRole(v as Role)}
          className="pk-compact role-pk"
          menuWidth={250}
          options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r], sub: ROLE_HINT[r] }))}
          trigger={<span className="pk-value">as {ROLE_LABEL[role].toLowerCase()}</span>}
        />
        <span className={`seat-note ${over ? "warn" : ""}`}>
          {used + editors} of {seats} seats{over ? " · add seats in billing" : ""}
        </span>
        <button type="button" className="btn-ink" onClick={send} disabled={!emails.length && !isEmail(draft.trim())}>
          Send invite{emails.length > 1 ? `s (${emails.length})` : ""}
        </button>
      </div>

      {sent.length > 0 && (
        <ul className="sent">
          {sent.map((m) => (
            <li key={m.email + m.token}>
              <span className="sent-ico">✉</span>
              <span className="sent-text">
                <strong>{m.email}</strong>
                <small>Invite sent · {ROLE_LABEL[m.role]}</small>
              </span>
              <button type="button" className="mini-btn" onClick={() => setPreview(m)}>
                View email
              </button>
              <button type="button" className="mini-btn" onClick={() => copy(m)}>
                {copied === m.email ? "Copied" : "Copy link"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {preview && <EmailPreview ws={ws} member={preview} inviter={me} product={product} onClose={() => setPreview(null)} />}
    </div>
  );
}
