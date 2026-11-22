"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { enterDemo, forgotPassword, isEmail, logIn, useMe, useProviders } from "@/lib/account";
import { ApiError } from "@/lib/api";
import { DemoNote, Field, Modal } from "../ui";
import AuthShell, { SITE_URL } from "./AuthShell";
import { GoogleButton } from "./Signup";

export default function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/app";
  const { me } = useMe();
  const { data: providers } = useProviders();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(params.get("error") === "google" ? "Google sign-in didn't finish. Try again." : "");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) return setError("Enter the email you signed up with.");
    if (!password) return setError("Enter your password.");
    setBusy(true);
    setError("");
    try {
      await logIn(email, password);
      router.push(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't log in.");
      setBusy(false);
    }
  };

  const demo = async () => {
    setBusy(true);
    try {
      await enterDemo();
      router.push("/app");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't open the sample workspace.");
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h1>Welcome back</h1>
      <p className="lede">Log in to your product map.</p>
      {me && (
        <button type="button" className="resume" onClick={() => router.push(next)}>
          <span className="resume-av">{me.user.name[0]}</span>
          <span>
            <strong>Continue as {me.user.name}</strong>
            <small>{me.user.email}</small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      )}
      <GoogleButton next={next} />
      <form className="form" onSubmit={submit} noValidate>
        <Field label="Email">
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </Field>
        <Field label="Password">
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
        </Field>
        <div className="row-between">
          <span />
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setForgotEmail(email);
              setForgotSent(false);
              setForgot(true);
            }}
          >
            Forgot password?
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn-ink wide big" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="switch">
        New to Zelo? <a href={`${SITE_URL}/pricing`}>See plans</a> or <Link href="/signup?plan=free">start free</Link>
      </p>
      {providers?.demo && (
        <button type="button" className="demo-cta" onClick={() => void demo()} disabled={busy}>
          <span>✦</span>
          <span>
            <strong>Open the sample workspace</strong>
            <small>Acme Store with 5 versions, as Bhumika</small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      )}

      {forgot && (
        <Modal title="Reset your password" sub="We'll email you a link to set a new one." onClose={() => setForgot(false)} width={420}>
          {forgotSent ? (
            <div className="form">
              <p className="lede">If an account exists for {forgotEmail}, a reset link is on its way. It works for one hour.</p>
              {providers?.devMailbox && <DemoNote>Development: open the email in the <a href="/dev/mailbox">dev mailbox</a>.</DemoNote>}
              <button type="button" className="btn-ink wide" onClick={() => setForgot(false)}>
                Done
              </button>
            </div>
          ) : (
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!isEmail(forgotEmail)) return;
                await forgotPassword(forgotEmail).catch(() => {});
                setForgotSent(true);
              }}
            >
              <Field label="Email">
                <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="you@company.com" />
              </Field>
              <button type="submit" className="btn-ink wide" disabled={!isEmail(forgotEmail)}>
                Send reset link
              </button>
            </form>
          )}
        </Modal>
      )}
    </AuthShell>
  );
}
