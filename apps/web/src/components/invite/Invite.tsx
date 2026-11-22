"use client";

import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { invite, isEmail, PLANS, ROLE_HINT, ROLE_LABEL, useProviders, type Role, type SentInvite, type Workspace } from "@/lib/account";
import { ApiError } from "@/lib/api";
import { Picker } from "../Picker";

const ROLES: Exclude<Role, "owner">[] = ["admin", "member", "viewer"];

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Invite people by email: type or paste several, pick a role, send.
 * The server checks seats and sends the emails; each sent invite gets a copyable link.
 */
export function InviteForm({ ws, compact = false, onSent }: { ws: Workspace; compact?: boolean; onSent?: (m: SentInvite[]) => void }) {
  const { data: providers } = useProviders();
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [role, setRole] = useState<Exclude<Role, "owner">>("member");
  const [error, setError] = useState("");
  const [sent, setSent] = useState<SentInvite[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const used = ws.members.filter((m) => m.role !== "viewer").length + ws.invites.filter((i) => i.role !== "viewer" && !i.expired).length;
  const seats = ws.plan === "free" ? PLANS.free.maxUsers! : ws.seats;
  const editors = role === "viewer" ? 0 : emails.length;
  const over = used + editors > seats;

  const add = (raw: string) => {
    const parts = raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    const bad = parts.filter((p) => !isEmail(p));
    const known = parts.filter((p) => ws.members.some((m) => m.email === p));
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

  const send = async () => {
    const list = [...emails, ...draft.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(isEmail)];
    if (!list.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const made = await invite(ws.id, [...new Set(list)], role);
      setSent((s) => [...made, ...s]);
      setEmails([]);
      setDraft("");
      onSent?.(made);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't send the invites.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (m: SentInvite) => {
    if (await copyText(m.link)) {
      setCopied(m.email);
      setTimeout(() => setCopied(null), 1600);
    }
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
          onChange={(v) => setRole(v as Exclude<Role, "owner">)}
          className="pk-compact role-pk"
          menuWidth={250}
          options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r], sub: ROLE_HINT[r] }))}
          trigger={<span className="pk-value">as {ROLE_LABEL[role].toLowerCase()}</span>}
        />
        <span className={`seat-note ${over ? "warn" : ""}`}>
          {used + editors} of {seats} seats{over ? " · add seats in billing" : ""}
        </span>
        <button type="button" className="btn-ink" onClick={() => void send()} disabled={busy || (!emails.length && !isEmail(draft.trim()))}>
          {busy ? "Sending…" : `Send invite${emails.length > 1 ? `s (${emails.length})` : ""}`}
        </button>
      </div>

      {sent.length > 0 && (
        <ul className="sent">
          {sent.map((m) => (
            <li key={m.id}>
              <span className={`sent-ico ${m.emailError ? "warn" : ""}`}>✉</span>
              <span className="sent-text">
                <strong>{m.email}</strong>
                <small>{m.emailError ? `Saved, but the email failed: ${m.emailError}` : `Invite sent · ${ROLE_LABEL[m.role as Role]}`}</small>
              </span>
              {providers?.devMailbox && (
                <a className="mini-btn" href={`/dev/mailbox?id=${m.emailId}`} target="_blank" rel="noreferrer">
                  View email
                </a>
              )}
              <button type="button" className="mini-btn" onClick={() => void copy(m)}>
                {copied === m.email ? "Copied" : "Copy link"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
