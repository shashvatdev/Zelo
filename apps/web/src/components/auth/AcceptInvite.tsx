"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { acceptInvite, logOut, nameFromEmail, ROLE_HINT, ROLE_LABEL, type InviteInfo } from "@/lib/account";
import { ApiError, useQuery } from "@/lib/api";
import { Field } from "../ui";
import AuthShell from "./AuthShell";
import { GoogleButton } from "./Signup";

const DEAD = {
  missing: ["This invite link doesn't work", "It may be mistyped, or it was replaced by a newer invite. Ask your teammate to send it again."],
  revoked: ["This invite was cancelled", "The person who invited you withdrew it. Ask them if you should still join."],
  used: ["This invite was already accepted", "Log in with the email it was sent to."],
  expired: ["This invite has expired", "Invites last 7 days. Ask your teammate to resend it from Members."],
} as const;

/** What the invitee sees after clicking "Accept invitation" in the email. */
export default function AcceptInvite() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const q = useQuery<InviteInfo>(token ? `/api/invites/${encodeURIComponent(token)}` : null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (token && (q.loading || (!q.data && !q.error))) return <div className="boot" aria-busy="true" />;
  const info: InviteInfo = !token ? { status: "missing" } : (q.data ?? { status: "missing" });

  if (info.status !== "valid") {
    const [title, text] = DEAD[info.status];
    return (
      <AuthShell>
        <div className="dead">
          <span className="dead-ico">✉</span>
          <h1>{title}</h1>
          <p className="lede">{q.error ? q.error.message : text}</p>
          <Link href="/login" className="btn-ink wide big">
            Go to log in
          </Link>
        </div>
      </AuthShell>
    );
  }

  const existing = info.existingAccount;
  const signedInAs = info.signedInAs;
  const wrongUser = signedInAs && signedInAs.email !== info.email;
  const sameUser = signedInAs && signedInAs.email === info.email;
  const article = info.role === "admin" ? "an" : "a";

  const join = async (input: { name?: string; password?: string }) => {
    setBusy(true);
    setError(null);
    try {
      const r = await acceptInvite(token, input);
      try {
        sessionStorage.setItem("zelo-welcome", `You joined ${r.workspaceName} as ${ROLE_LABEL[r.role].toLowerCase()}`);
      } catch {
        // fine without the toast
      }
      router.push("/app");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't accept the invite.");
      setBusy(false);
      void q.reload();
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (existing ? !password : !name.trim() || password.length < 8) return;
    void join(existing ? { password } : { name: name.trim(), password });
  };

  return (
    <AuthShell
      aside={
        <div className="inv-aside">
          <p className="inv-from">
            <span className="inv-av">{info.inviterName?.[0] ?? "Z"}</span>
            <span>
              <b>{info.inviterName ?? "A teammate"}</b> invited you
            </span>
          </p>
          <h2>Join {info.workspace.name} on Zelo</h2>
          <p>See every version, feature and ticket of your product as one connected tree, with your team.</p>
          <ul className="inv-facts">
            <li>
              <span>Workspace</span>
              <b>{info.workspace.name}</b>
            </li>
            <li>
              <span>Your role</span>
              <b>{ROLE_LABEL[info.role]}</b> · {ROLE_HINT[info.role].toLowerCase()}
            </li>
            <li>
              <span>Team</span>
              <b>
                {info.teamCount} {info.teamCount === 1 ? "person" : "people"}
              </b>
            </li>
          </ul>
        </div>
      }
    >
      <p className="eyebrow">Invitation for {info.email}</p>
      <h1>{sameUser ? `Join ${info.workspace.name}` : existing ? "Log in to accept" : "Create your account to join"}</h1>
      <p className="lede">
        {sameUser ? `You're signed in as ${info.email}.` : existing ? `You already have a Zelo account. Log in and you're in ${info.workspace.name}.` : `You'll join ${info.workspace.name} as ${article} ${ROLE_LABEL[info.role].toLowerCase()}.`}
      </p>

      {wrongUser ? (
        <div className="warn-box">
          <p>
            You&apos;re signed in as <b>{signedInAs.email}</b>, but this invite is for <b>{info.email}</b>.
          </p>
          <button
            type="button"
            className="btn-ghost"
            onClick={async () => {
              await logOut();
              await q.reload();
            }}
          >
            Log out and continue
          </button>
        </div>
      ) : sameUser ? (
        <>
          {error && <p className="form-error">{error}</p>}
          <button type="button" className="btn-ink wide big" onClick={() => void join({})} disabled={busy}>
            {busy ? "Joining…" : `Accept and join ${info.workspace.name}`}
          </button>
        </>
      ) : (
        <>
          <GoogleButton next={`/invite?token=${encodeURIComponent(token)}`} label={`Continue with Google as ${info.email}`} />
          <form className="form" onSubmit={submit} noValidate>
            <Field label="Email" hint="The invite only works for this address.">
              <input value={info.email} readOnly className="locked" />
            </Field>
            {!existing && (
              <Field label="Your name" error={tried && !name.trim() ? "Tell your team who you are." : undefined}>
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={nameFromEmail(info.email)} />
              </Field>
            )}
            <Field label={existing ? "Password" : "Create a password"} error={tried && (existing ? !password : password.length < 8) ? (existing ? "Enter your password." : "At least 8 characters.") : undefined}>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={existing ? "Your password" : "At least 8 characters"} autoComplete={existing ? "current-password" : "new-password"} />
            </Field>
            {existing && !info.accountHasPassword && <p className="field-hint">This account has no password yet. Use “Forgot password” on the log in page to set one.</p>}
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn-ink wide big" disabled={busy}>
              {busy ? "Joining…" : existing ? "Log in and join" : `Join ${info.workspace.name}`}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
