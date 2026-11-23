"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { checkout, PLANS, useMe, type CheckoutResult, type PlanId } from "@/lib/account";
import { ApiError } from "@/lib/api";
import { Picker } from "../Picker";
import { DemoNote, Field } from "../ui";
import AuthShell from "./AuthShell";

const COUNTRIES = ["India", "United States", "United Kingdom", "Germany", "Singapore", "Other"];
const digits = (s: string) => s.replace(/\D/g, "");
const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const dateLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const asPlan = (v: string | null): PlanId | null => (v === "free" || v === "team" || v === "business" ? v : null);
/** Long enough to read "Confirming payment…", short enough not to annoy. */
const MIN_PAY_MS = 900;

/**
 * Step 2 of the start flow: choose a plan and pay.
 * No payment gateway yet: pressing Pay succeeds at once (a demo payment, clearly labelled).
 * Handles every way someone can land here: fresh after signup, coming back after paying
 * (no second charge), adding another workspace, and upgrading from Plan & billing.
 */
export default function Checkout() {
  const router = useRouter();
  const params = useSearchParams();
  const { me } = useMe();
  const user = me?.user;
  const wantUpgrade = params.get("upgrade") === "1";
  const active = me?.workspaces.find((w) => w.id === me.activeWorkspaceId);
  // Upgrading from Plan & billing pays for the current workspace instead of creating one.
  const upgradeWs = wantUpgrade && active?.isOwner && active.onboarded ? active : null;
  // A workspace whose plan is already chosen but isn't set up yet: offer to carry on instead of paying again.
  const pending = !wantUpgrade ? me?.workspaces.find((w) => w.isOwner && !w.onboarded) : undefined;
  const finished = me?.workspaces.find((w) => w.onboarded);

  const [plan, setPlan] = useState<PlanId>(() => asPlan(params.get("plan")) ?? "team");
  const [seats, setSeats] = useState(5);
  const [country, setCountry] = useState("India");
  const [gstin, setGstin] = useState("");
  const [changing, setChanging] = useState(false);
  const [phase, setPhase] = useState<"form" | "paying" | "done">("form");
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (me === null) router.replace(`/signup?plan=${asPlan(params.get("plan")) ?? "team"}`);
  }, [me, router, params]);

  if (!user || !me) return <div className="boot" aria-busy="true" />;

  if (wantUpgrade && !upgradeWs)
    return (
      <AuthShell>
        <h1>Only the owner can change the plan</h1>
        <p className="lede">Ask the workspace owner to upgrade from Plan &amp; billing.</p>
        <Link className="btn-ink wide big" href="/app">
          Back to the map
        </Link>
      </AuthShell>
    );

  const P = PLANS[plan];
  const paidSeats = plan === "free" ? PLANS.free.maxUsers! : seats;
  const yearly = P.price * paidSeats * 12;
  const tax = plan !== "free" && country === "India" ? Math.round(yearly * 0.18 * 100) / 100 : 0;
  const total = yearly + tax;
  const after = upgradeWs ? "/settings?tab=billing" : "/onboarding";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPayError(null);
    if (phase === "paying") return;
    setPhase("paying");
    const started = Date.now();
    try {
      const r = await checkout({ plan, seats: paidSeats, country: plan === "free" ? undefined : country, gstin: plan !== "free" && gstin ? gstin : undefined, workspaceId: upgradeWs?.id });
      await new Promise((ok) => setTimeout(ok, Math.max(0, MIN_PAY_MS - (Date.now() - started))));
      setResult(r);
      setPhase("done");
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : "Payment didn't go through. Try again.");
      setPhase("form");
    }
  };

  /* ---------- paid ---------- */
  if (phase === "done" && result)
    return (
      <AuthShell step={upgradeWs ? undefined : 2}>
        <div className="paid">
          <span className="paid-check" aria-hidden="true">
            <svg viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="24" />
              <path d="M15 27l7 7 15-16" />
            </svg>
          </span>
          <h1>{result.plan === "free" ? "You're on the Free plan" : upgradeWs ? `Upgraded to ${PLANS[result.plan].name}` : "Payment successful"}</h1>
          <p className="lede">
            {result.plan === "free"
              ? "No payment needed. Upgrade any time from Plan & billing."
              : `${PLANS[result.plan].name} plan for ${result.seats} ${result.seats === 1 ? "person" : "people"}, billed yearly. A receipt is on its way to ${user.email}.`}
          </p>
          {result.plan !== "free" && (
            <dl className="receipt">
              <dt>Plan</dt>
              <dd>
                {PLANS[result.plan].name} · {result.seats} seats
              </dd>
              <dt>Paid</dt>
              <dd>
                {usd(result.totalCents / 100)}
                {result.taxCents ? ` (incl. ${usd(result.taxCents / 100)} GST)` : ""}
              </dd>
              <dt>Payment</dt>
              <dd>{result.card ? `${result.card.brand} ending ${result.card.last4}` : "Demo payment, no card charged"}</dd>
              {result.renews && (
                <>
                  <dt>Renews</dt>
                  <dd>{dateLabel(result.renews)}</dd>
                </>
              )}
            </dl>
          )}
          <button type="button" className="btn-ink wide big" onClick={() => router.push(after)}>
            {upgradeWs ? "Back to billing →" : "Set up your workspace →"}
          </button>
        </div>
      </AuthShell>
    );

  /* ---------- plan already chosen: carry on, don't pay twice ---------- */
  if (pending && !changing)
    return (
      <AuthShell step={1}>
        <div className="paid">
          <span className="paid-check" aria-hidden="true">
            <svg viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="24" />
              <path d="M15 27l7 7 15-16" />
            </svg>
          </span>
          <h1>Your plan is all set</h1>
          <p className="lede">
            You chose the <b>{PLANS[pending.plan].name}</b> plan. Next, set up your workspace: it takes about a minute.
          </p>
          <button type="button" className="btn-ink wide big" onClick={() => router.push("/onboarding")}>
            Continue setup →
          </button>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setPlan(asPlan(params.get("plan")) ?? pending.plan);
              setChanging(true);
            }}
          >
            Choose a different plan
          </button>
        </div>
      </AuthShell>
    );

  /* ---------- choose and pay ---------- */
  return (
    <AuthShell step={upgradeWs ? undefined : 1}>
      <h1>{upgradeWs ? `Upgrade ${upgradeWs.name || "your workspace"}` : "Choose your plan"}</h1>
      <p className="lede">Billed yearly. Change seats or plan any time.</p>
      {!upgradeWs && !pending && finished && (
        <p className="inline-note">
          You already have <b>{finished.name || "a workspace"}</b>. Paying here creates a new, separate workspace. <Link href="/app">Go to {finished.name || "your workspace"} →</Link>
        </p>
      )}
      <div className="plans" role="radiogroup" aria-label="Plan">
        {(Object.keys(PLANS) as PlanId[])
          .filter((id) => !upgradeWs || PLANS[id].price > PLANS[upgradeWs.plan].price)
          .map((id) => (
            <button key={id} type="button" role="radio" aria-checked={plan === id} className={`plan-card ${plan === id ? "on" : ""}`} onClick={() => setPlan(id)}>
              <span className="plan-top">
                <strong>{PLANS[id].name}</strong>
                {id === "team" && <span className="plan-tag">Most teams</span>}
              </span>
              <span className="plan-price">
                {PLANS[id].price ? (
                  <>
                    <b>${PLANS[id].price}</b> / user / month
                  </>
                ) : (
                  <>
                    <b>$0</b> up to 5 users
                  </>
                )}
              </span>
              <span className="plan-blurb">{PLANS[id].blurb}</span>
            </button>
          ))}
      </div>

      <form className="form" onSubmit={submit} noValidate>
        {plan !== "free" && (
          <>
            <div className="seats">
              <div>
                <strong>Seats</strong>
                <small>Everyone who edits work. Viewers are free.</small>
              </div>
              <div className="stepper">
                <button type="button" onClick={() => setSeats((s) => Math.max(1, s - 1))} aria-label="Fewer seats">
                  −
                </button>
                <input aria-label="Seats" inputMode="numeric" value={seats} onChange={(e) => setSeats(Math.max(1, Math.min(500, Number(digits(e.target.value)) || 1)))} />
                <button type="button" onClick={() => setSeats((s) => Math.min(500, s + 1))} aria-label="More seats">
                  +
                </button>
              </div>
            </div>
            <div className="form-row">
              <Field label="Billing country">
                <Picker label="Country" value={country} onChange={setCountry} className="pk-field" options={COUNTRIES.map((c) => ({ value: c, label: c }))} trigger={<span className="pk-value">{country}</span>} />
              </Field>
              {country === "India" && (
                <Field label="GSTIN" hint="Optional, for your invoice.">
                  <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15))} placeholder="22AAAAA0000A1Z5" />
                </Field>
              )}
            </div>
          </>
        )}

        <div className="summary">
          <div>
            <span>
              {P.name}
              {plan !== "free" && ` · ${paidSeats} × $${P.price} × 12 months`}
            </span>
            <span>{usd(yearly)}</span>
          </div>
          {tax > 0 && (
            <div>
              <span>GST 18%</span>
              <span>{usd(tax)}</span>
            </div>
          )}
          <div className="sum-total">
            <span>Due today</span>
            <span>{usd(total)}</span>
          </div>
        </div>

        {payError && (
          <p className="form-error" role="alert">
            {payError}
          </p>
        )}
        <button type="submit" className="btn-ink wide big" disabled={phase === "paying"}>
          {phase === "paying" ? (
            <>
              <span className="spin" aria-hidden="true" /> {plan === "free" ? "Setting up…" : "Confirming payment…"}
            </>
          ) : plan === "free" ? (
            "Continue with Free"
          ) : (
            `Pay ${usd(total)}`
          )}
        </button>
        {pending && changing && (
          <button type="button" className="link-btn" onClick={() => setChanging(false)}>
            Keep my {PLANS[pending.plan].name} plan
          </button>
        )}
      </form>
      {plan !== "free" && <DemoNote>Demo mode: there&apos;s no payment gateway yet, so pressing Pay succeeds straight away and no card is charged.</DemoNote>}
    </AuthShell>
  );
}
