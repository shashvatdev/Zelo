"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createWorkspace, findUserByEmail, isEmail, PLANS, signUp, useDb, type PlanId } from "@/lib/account";
import { DemoNote, Field, GoogleIcon, Modal } from "../ui";
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

/** Google sign-in stand-in: asks for the name and email Google would hand back. */
export function GoogleDemo({ onDone, onClose }: { onDone: (name: string, email: string) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <Modal title="Continue with Google" sub="Demo: Google sign-in needs the backend. Enter the account it would return." onClose={onClose} width={400}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (isEmail(email)) onDone(name, email);
        }}
      >
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </Field>
        <Field label="Google email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </Field>
        <button type="submit" className="btn-ink wide" disabled={!isEmail(email)}>
          <GoogleIcon /> Continue
        </button>
      </form>
    </Modal>
  );
}

export default function Signup() {
  const db = useDb();
  const router = useRouter();
  const params = useSearchParams();
  const plan = (["free", "team", "business"].includes(params.get("plan") ?? "") ? params.get("plan") : "team") as PlanId;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [tried, setTried] = useState(false);
  const [google, setGoogle] = useState(false);
  const exists = db && isEmail(email) ? findUserByEmail(db, email) : undefined;
  const st = strength(password);
  const errors = {
    name: !name.trim() ? "Tell us your name." : undefined,
    email: !isEmail(email) ? "Enter a valid work email." : exists ? "There is already an account with this email." : undefined,
    password: password.length < 8 ? "Use at least 8 characters." : undefined,
    agree: !agree ? "Please accept the terms to continue." : undefined,
  };
  const ok = !Object.values(errors).some(Boolean);

  const next = (userId: string) => {
    if (plan === "free") {
      createWorkspace(userId, "free", 5);
      router.push("/onboarding");
    } else router.push(`/checkout?plan=${plan}`);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!ok) return;
    next(signUp(name, email).id);
  };

  return (
    <AuthShell step={0}>
      <p className="eyebrow">
        {PLANS[plan].name} plan{plan !== "free" ? ` · $${PLANS[plan].price} per user / month` : " · free forever"}
        <Link href={`${SITE_URL}/pricing`}>Change</Link>
      </p>
      <h1>Create your account</h1>
      <p className="lede">It takes about two minutes to get your team&apos;s product map running.</p>

      <button type="button" className="btn-google" onClick={() => setGoogle(true)}>
        <GoogleIcon /> Continue with Google
      </button>
      <div className="or">
        <span>or with email</span>
      </div>

      <form className="form" onSubmit={submit} noValidate>
        <Field label="Full name" error={tried ? errors.name : undefined}>
          <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bhumika Saxena" />
        </Field>
        <Field
          label="Work email"
          error={(tried || exists) && errors.email ? errors.email : undefined}
          hint="Use your company email so teammates can find you."
        >
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </Field>
        {exists && (
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
        <button type="submit" className="btn-ink wide big">
          {plan === "free" ? "Create account" : "Continue to payment"}
        </button>
      </form>
      <p className="switch">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
      <DemoNote>Accounts are saved in this browser only. Passwords are never stored.</DemoNote>
      {google && (
        <GoogleDemo
          onClose={() => setGoogle(false)}
          onDone={(n, e) => {
            setGoogle(false);
            const u = signUp(n, e, "google");
            if (db && findUserByEmail(db, e)) router.push("/app");
            else next(u.id);
          }}
        />
      )}
    </AuthShell>
  );
}
