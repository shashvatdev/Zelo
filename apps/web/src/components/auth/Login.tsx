"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { currentUser, enterDemo, findUserByEmail, isEmail, logIn, useDb } from "@/lib/account";
import { DemoNote, Field, GoogleIcon, Modal } from "../ui";
import AuthShell, { SITE_URL } from "./AuthShell";

export default function Login() {
  const db = useDb();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [google, setGoogle] = useState(false);
  const [forgot, setForgot] = useState(false);
  const signedIn = db ? currentUser(db) : undefined;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!db) return;
    if (!isEmail(email)) return setError("Enter the email you signed up with.");
    const u = findUserByEmail(db, email);
    if (!u) return setError("No account with this email. Check for an invite email, or create an account.");
    if (!password) return setError("Enter your password.");
    logIn(u.id);
    router.push("/app");
  };

  return (
    <AuthShell>
      <h1>Welcome back</h1>
      <p className="lede">Log in to your product map.</p>
      {signedIn && (
        <button type="button" className="resume" onClick={() => router.push("/app")}>
          <span className="resume-av">{signedIn.name[0]}</span>
          <span>
            <strong>Continue as {signedIn.name}</strong>
            <small>{signedIn.email}</small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      )}
      <button type="button" className="btn-google" onClick={() => setGoogle(true)}>
        <GoogleIcon /> Continue with Google
      </button>
      <div className="or">
        <span>or</span>
      </div>
      <form className="form" onSubmit={submit} noValidate>
        <Field label="Email">
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </Field>
        <Field label="Password">
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
        </Field>
        <div className="row-between">
          <span />
          <button type="button" className="link-btn" onClick={() => setForgot(true)}>
            Forgot password?
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn-ink wide big">
          Log in
        </button>
      </form>
      <p className="switch">
        New to Zelo? <a href={`${SITE_URL}/pricing`}>See plans</a> or <Link href="/signup?plan=free">start free</Link>
      </p>
      <button
        type="button"
        className="demo-cta"
        onClick={() => {
          enterDemo();
          router.push("/app");
        }}
      >
        <span>✦</span>
        <span>
          <strong>Open the sample workspace</strong>
          <small>Acme Store with 5 versions, signed in as Bhumika</small>
        </span>
        <span aria-hidden="true">→</span>
      </button>
      <DemoNote>Accounts live in this browser. Any password works for an existing account.</DemoNote>

      {google && db && (
        <Modal title="Choose an account" sub="Demo: accounts saved in this browser" onClose={() => setGoogle(false)} width={400}>
          {db.users.length ? (
            <ul className="acct-list">
              {db.users.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => {
                      logIn(u.id);
                      router.push("/app");
                    }}
                  >
                    <span className="acct-av">{u.name[0]}</span>
                    <span>
                      <strong>{u.name}</strong>
                      <small>{u.email}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="lede">No accounts in this browser yet. Create one first.</p>
          )}
          <div className="form-actions">
            <Link className="btn-ghost" href="/signup?plan=free">
              Use another account
            </Link>
          </div>
        </Modal>
      )}
      {forgot && (
        <Modal title="Reset your password" sub="We'll email you a link to set a new one." onClose={() => setForgot(false)} width={400}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              setForgot(false);
              setError("");
            }}
          >
            <Field label="Email">
              <input type="email" defaultValue={email} placeholder="you@company.com" />
            </Field>
            <button type="submit" className="btn-ink wide">
              Send reset link
            </button>
            <DemoNote>No email is sent in the demo.</DemoNote>
          </form>
        </Modal>
      )}
    </AuthShell>
  );
}
