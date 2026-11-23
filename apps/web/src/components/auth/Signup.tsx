"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { checkout, isEmail, nextPath, PLANS, signUp, useMe, useProviders, type PlanId } from "@/lib/account";
import { ApiError } from "@/lib/api";
import { Field, GoogleIcon } from "../ui";
import AuthShell, { SITE_URL } from "./AuthShell";

function strength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) s++;
  return s;
}
const STRENGTH = ["Too short", "Weak", "Okay", "Good", "Strong"];

export function GoogleButton({ next, label = "Continue with Google" }: { next: string; label?: string }) {
  const { data } = useProviders();
  if (!data?.google) return null;
  return (
    <>
      <a className="btn-google" href={`/api/auth/google?next=${encodeURIComponent(next)}`}>
        <GoogleIcon /> {label}
      </a>
      <div className="or">
        <span>or with email</span>
      </div>
    </>
  );
}

export default function Signup() {
  const router = useRouter();
  const params = useSearchParams();
  const { me } = useMe();
  const plan = (["free", "team", "business"].includes(params.get("plan") ?? "") ? params.get("plan") : "team") as PlanId;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [server, setServer] = useState<ApiError | null>(null);
  const st = strength(password);
  const errors = {
    name: !name.trim() ? "Tell us your name." : undefined,
    email: !isEmail(email) ? "Enter a valid work email." : undefined,
    password: password.length < 8 ? "Use at least 8 characters." : undefined,
    agree: !agree ? "Please accept the terms to continue." : undefined,
  };
  const ok = !Object.values(errors).some(Boolean);
  const taken = server?.status === 409;

  /** After a new account: Free goes straight to setup; paid plans go to payment. */
  const next = async () => {
    if (plan === "free") {
      await checkout({ plan: "free", seats: 5 });
      router.push("/onboarding");
    } else router.push(`/checkout?plan=${plan}`);
  };
  /** Already signed in: pick up where they left off (a plan still to choose → this plan's checkout). */
  const resume = () => {
    if (!me) return;
    const to = nextPath(me);
    if (to === "/checkout") void next().catch((err) => setServer(err instanceof ApiError ? err : new ApiError(0, "Something went wrong.")));
    else router.push(to);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setServer(null);
    if (!ok || busy) return;
    setBusy(true);
    try {
      await signUp(name, email, password);
      await next();
    } catch (err) {
      setServer(err instanceof ApiError ? err : new ApiError(0, "Something went wrong."));
      setBusy(false);
    }
  };

  return (
    <AuthShell step={0}>
      <p className="eyebrow">
        {PLANS[plan].name} plan{plan !== "free" ? ` · $${PLANS[plan].price} per user / month` : " · free forever"}
        <Link href={`${SITE_URL}/pricing`}>Change</Link>
      </p>
      <h1>Create your account</h1>
      <p className="lede">It takes about two minutes to get your team&apos;s product map running.</p>
      {me && (
        <button type="button" className="resume" onClick={resume}>
          <span className="resume-av">{me.user.name[0]}</span>
          <span>
            <strong>Continue as {me.user.name}</strong>
            <small>{me.user.email}</small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      )}

      <GoogleButton next={`/checkout?plan=${plan}`} />

      <form className="form" onSubmit={submit} noValidate>
        <Field label="Full name" error={tried ? errors.name : undefined}>
          <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bhumika Saxena" />
        </Field>
        <Field label="Work email" error={taken ? server?.message : tried ? errors.email : undefined} hint="Use your company email so teammates can find you.">
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (taken) setServer(null);
            }}
            placeholder="you@company.com"
          />
        </Field>
        {taken && (
          <p className="inline-alt">
            <Link href="/login">Log in instead →</Link>
          </p>
        )}
        <Field label="Password" error={tried ? errors.password : undefined}>
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        </Field>
        {password && (
          <div className={`strength s-${st}`} aria-live="polite">
            <span className="strength-bar">
              {[0, 1, 2, 3].map((i) => (
                <i key={i} className={i < st ? "on" : ""} />
              ))}
            </span>
            {STRENGTH[st]}
          </div>
        )}
        <label className={`check ${tried && errors.agree ? "has-error" : ""}`}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            I agree to the <a href={`${SITE_URL}/terms`}>Terms</a> and <a href={`${SITE_URL}/privacy`}>Privacy Policy</a>.
          </span>
        </label>
        {server && !taken && <p className="form-error">{server.message}</p>}
        <button type="submit" className="btn-ink wide big" disabled={busy}>
          {busy ? <span className="spin" aria-hidden="true" /> : null}
          {busy ? "Creating your account…" : plan === "free" ? "Create account" : "Continue to payment"}
        </button>
      </form>
      <p className="switch">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </AuthShell>
  );
}
