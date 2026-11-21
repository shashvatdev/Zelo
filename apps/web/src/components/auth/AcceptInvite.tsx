"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { acceptInvite, currentUser, findInvite, findUserByEmail, inviteExpired, logOut, nameFromEmail, nowIso, ROLE_HINT, ROLE_LABEL, uid, useDb, type User } from "@/lib/account";
import { DemoNote, Field, GoogleIcon } from "../ui";
import AuthShell from "./AuthShell";

/** What the invitee sees after clicking "Accept invitation" in the email. */
export default function AcceptInvite() {
  const db = useDb();
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [tried, setTried] = useState(false);

  if (!db) return <div className="boot" aria-busy="true" />;
  const found = findInvite(db, token);
  const signedIn = currentUser(db);
  const inviter = found ? db.users.find((u) => u.id === found.member.invitedBy) : undefined;

  const dead = !found ? "missing" : found.member.status === "revoked" ? "revoked" : found.member.status === "active" ? "used" : inviteExpired(found.member) ? "expired" : null;
  if (!found || dead) {
    const copy = {
      missing: ["This invite link doesn't work", "It may be mistyped, or it was replaced by a newer invite. Ask your teammate to send it again."],
      revoked: ["This invite was cancelled", "The person who invited you withdrew it. Ask them if you should still join."],
      used: ["This invite was already accepted", "Log in with the email it was sent to."],
      expired: ["This invite has expired", "Invites last 7 days. Ask your teammate to resend it from Members."],
    }[dead ?? "missing"];
    return (
      <AuthShell>
        <div className="dead">
          <span className="dead-ico">✉</span>
          <h1>{copy[0]}</h1>
          <p className="lede">{copy[1]}</p>
          <Link href="/login" className="btn-ink wide big">
            Go to log in
          </Link>
        </div>
      </AuthShell>
    );
  }

  const { workspace: ws, member } = found;
  const existing = findUserByEmail(db, member.email);
  const wrongUser = signedIn && signedIn.email !== member.email;

  const join = (user: User) => {
    acceptInvite(token, user);
    try {
      sessionStorage.setItem("zelo-welcome", `You joined ${ws.name} as ${ROLE_LABEL[member.role].toLowerCase()}`);
    } catch {
      // ignore
    }
    router.push("/app");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (existing) {
      if (!password) return;
      return join(existing);
    }
    if (!name.trim() || password.length < 8) return;
    join({ id: uid("u"), name: name.trim(), email: member.email, createdAt: nowIso(), via: "email" });
  };

  return (
    <AuthShell
      aside={
        <div className="inv-aside">
          <p className="inv-from">
            <span className="inv-av">{inviter?.name?.[0] ?? "Z"}</span>
            <span>
              <b>{inviter?.name ?? "A teammate"}</b> invited you
            </span>
          </p>
          <h2>Join {ws.name} on Zelo</h2>
          <p>See every version, feature and ticket of your product as one connected tree, with your team.</p>
          <ul className="inv-facts">
            <li>
              <span>Workspace</span>
              <b>{ws.name}</b>
            </li>
            <li>
              <span>Your role</span>
              <b>{ROLE_LABEL[member.role]}</b> · {ROLE_HINT[member.role].toLowerCase()}
            </li>
            <li>
              <span>Team</span>
              <b>{(() => { const n = ws.members.filter((m) => m.status === "active").length; return `${n} ${n === 1 ? "person" : "people"}`; })()}</b>
            </li>
          </ul>
        </div>
      }
    >
      <p className="eyebrow">Invitation for {member.email}</p>
      <h1>{existing ? "Log in to accept" : "Create your account to join"}</h1>
      <p className="lede">
        {existing ? `You already have a Zelo account. Log in and you're in ${ws.name}.` : `You'll join ${ws.name} as ${member.role === "admin" ? "an" : "a"} ${ROLE_LABEL[member.role].toLowerCase()}.`}
      </p>

      {wrongUser ? (
        <div className="warn-box">
          <p>
            You&apos;re signed in as <b>{signedIn.email}</b>, but this invite is for <b>{member.email}</b>.
          </p>
          <button type="button" className="btn-ghost" onClick={() => logOut()}>
            Log out and continue
          </button>
        </div>
      ) : signedIn && signedIn.email === member.email ? (
        <button type="button" className="btn-ink wide big" onClick={() => join(signedIn)}>
          Accept and join {ws.name}
        </button>
      ) : (
        <>
          <button type="button" className="btn-google" onClick={() => join(existing ?? { id: uid("u"), name: nameFromEmail(member.email), email: member.email, createdAt: nowIso(), via: "google" })}>
            <GoogleIcon /> Continue with Google as {member.email}
          </button>
          <div className="or">
            <span>or</span>
          </div>
          <form className="form" onSubmit={submit} noValidate>
            <Field label="Email" hint="The invite only works for this address.">
              <input value={member.email} readOnly className="locked" />
            </Field>
            {!existing && (
              <Field label="Your name" error={tried && !name.trim() ? "Tell your team who you are." : undefined}>
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={nameFromEmail(member.email)} />
              </Field>
            )}
            <Field label={existing ? "Password" : "Create a password"} error={tried && (existing ? !password : password.length < 8) ? (existing ? "Enter your password." : "At least 8 characters.") : undefined}>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={existing ? "Your password" : "At least 8 characters"} autoComplete={existing ? "current-password" : "new-password"} />
            </Field>
            <button type="submit" className="btn-ink wide big">
              {existing ? "Log in and join" : `Join ${ws.name}`}
            </button>
          </form>
        </>
      )}
      <DemoNote>Opened from the invite email preview. In the real product this link comes from the email.</DemoNote>
    </AuthShell>
  );
}
