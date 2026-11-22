import { db, schema } from "./db";
import { config } from "./config";

/**
 * Sends email through Resend when RESEND_API_KEY is set; otherwise it is only recorded.
 * Every email is stored either way (audit trail, and the dev mailbox reads from it).
 */
type Mail = { to: string; subject: string; html: string; text: string; kind: string };

export async function sendMail(m: Mail) {
  let provider = "outbox";
  let providerId: string | null = null;
  let error: string | null = null;
  if (config.resendKey) {
    provider = "resend";
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: config.emailFrom, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (res.ok) providerId = data.id ?? null;
      else error = data.message ?? `HTTP ${res.status}`;
    } catch (e) {
      error = (e as Error).message;
    }
  }
  const [row] = await db.insert(schema.emails).values({ ...m, provider, providerId, error }).returning({ id: schema.emails.id });
  if (error) console.error("[mail] send failed", m.kind, error);
  return { id: row.id, error };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string, cta?: { label: string; url: string }, foot?: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f3ec;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1b1a17">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf8;border:1.5px solid #1b1a17;border-radius:14px;padding:28px">
<tr><td style="font-size:22px;font-family:Georgia,serif">zelo</td></tr>
<tr><td style="padding-top:18px;font-size:20px;font-weight:700">${esc(title)}</td></tr>
<tr><td style="padding-top:10px;font-size:15px;line-height:1.55;color:#3a3832">${body}</td></tr>
${cta ? `<tr><td style="padding:22px 0 6px"><a href="${esc(cta.url)}" style="display:inline-block;background:#e5582b;color:#fffdf8;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;border:1.5px solid #1b1a17">${esc(cta.label)}</a></td></tr>
<tr><td style="font-size:12px;color:#6d695f;word-break:break-all">Or paste this link: ${esc(cta.url)}</td></tr>` : ""}
${foot ? `<tr><td style="padding-top:18px;font-size:12px;color:#6d695f">${foot}</td></tr>` : ""}
</table></td></tr></table></body></html>`;
}

export function inviteEmail(p: { to: string; inviter: string; workspace: string; product?: string | null; role: string; url: string }) {
  const article = p.role === "admin" ? "an" : "a";
  const subject = `${p.inviter} invited you to ${p.workspace} on Zelo`;
  const body = `<b>${esc(p.inviter)}</b> invited you to work on ${p.product ? `<b>${esc(p.product)}</b>` : "their product"} as ${article} <b>${esc(p.role)}</b>. See every version, feature and ticket as one connected tree.`;
  const foot = `This link works for ${config.inviteDays} days and only for ${esc(p.to)}. If you weren't expecting it, you can ignore this email.`;
  return {
    to: p.to,
    subject,
    kind: "invite",
    html: layout(`Join ${p.workspace} on Zelo`, body, { label: "Accept invitation", url: p.url }, foot),
    text: `${p.inviter} invited you to work on ${p.product ?? "their product"} in ${p.workspace} as ${article} ${p.role}.\n\nAccept: ${p.url}\n\nThis link works for ${config.inviteDays} days and only for ${p.to}.`,
  };
}

export function resetEmail(p: { to: string; url: string }) {
  return {
    to: p.to,
    subject: "Reset your Zelo password",
    kind: "reset",
    html: layout("Reset your password", "Someone asked to reset the password for this account. If it was you, set a new one below. The link works for 1 hour.", { label: "Set a new password", url: p.url }, "If you didn't ask for this, you can ignore this email; your password stays the same."),
    text: `Reset your Zelo password (link works for 1 hour): ${p.url}`,
  };
}

export function receiptEmail(p: { to: string; workspace: string; plan: string; seats: number; total: string; card: string }) {
  return {
    to: p.to,
    subject: `Your Zelo receipt: ${p.plan} plan`,
    kind: "receipt",
    html: layout("Thanks, payment received", `<b>${esc(p.plan)}</b> plan for ${p.seats} seats in <b>${esc(p.workspace || "your workspace")}</b>.<br>Total: <b>${esc(p.total)}</b>, charged to ${esc(p.card)}. Billed yearly.`),
    text: `Payment received: ${p.plan} plan, ${p.seats} seats, ${p.total}, charged to ${p.card}.`,
  };
}
