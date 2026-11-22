"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { resetPassword } from "@/lib/account";
import { ApiError } from "@/lib/api";
import { Field } from "../ui";
import AuthShell from "./AuthShell";

export default function ResetPassword() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token, password);
      router.push("/app");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reset the password.");
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h1>Set a new password</h1>
      <p className="lede">You&apos;ll be signed out everywhere else and signed in here.</p>
      {!token ? (
        <p className="form-error">This reset link is incomplete. Ask for a new one from the log in page.</p>
      ) : (
        <form className="form" onSubmit={submit} noValidate>
          <Field label="New password">
            <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          </Field>
          <Field label="Type it again">
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-ink wide big" disabled={busy}>
            {busy ? "Saving…" : "Save and log in"}
          </button>
        </form>
      )}
      <p className="switch">
        <Link href="/login">Back to log in</Link>
      </p>
    </AuthShell>
  );
}
