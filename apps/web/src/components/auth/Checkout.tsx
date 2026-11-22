"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { checkout, PLANS, useMe, yearFromNowLabel, type PlanId } from "@/lib/account";
import { ApiError } from "@/lib/api";
import { Picker } from "../Picker";
import { DemoNote, Field } from "../ui";
import AuthShell from "./AuthShell";

const COUNTRIES = ["India", "United States", "United Kingdom", "Germany", "Singapore", "Other"];

const digits = (s: string) => s.replace(/\D/g, "");
function brandOf(num: string) {
  const d = digits(num);
  if (/^4/.test(d)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "Mastercard";
  if (/^3[47]/.test(d)) return "Amex";
  if (/^(60|65|81|82|508)/.test(d)) return "RuPay";
  return "";
}
function luhn(num: string) {
  const d = digits(num);
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return d.length >= 13 && sum % 10 === 0;
}
const fmtCard = (v: string) =>
  digits(v)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
const fmtExp = (v: string) => {
  const d = digits(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};
function expValid(v: string) {
  const [m, y] = v.split("/").map(Number);
  if (!m || m > 12 || y === undefined || Number.isNaN(y)) return false;
  const end = new Date(2000 + y, m, 1);
  return end > new Date();
}
const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export default function Checkout() {
  const router = useRouter();
  const params = useSearchParams();
  const { me } = useMe();
  const user = me?.user;
  // Upgrading from Plan & billing pays for the current workspace instead of creating one.
  const upgradeId = params.get("upgrade") === "1" ? (me?.workspaces.find((w) => w.id === me.activeWorkspaceId && w.isOwner)?.id ?? null) : null;
  const [plan, setPlan] = useState<PlanId>(() => (["team", "business", "free"].includes(params.get("plan") ?? "") ? (params.get("plan") as PlanId) : "team"));
  const [seats, setSeats] = useState(5);
  const [country, setCountry] = useState("India");
  const [gstin, setGstin] = useState("");
  const [card, setCard] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [holder, setHolder] = useState("");
  const [tried, setTried] = useState(false);
  const [phase, setPhase] = useState<"form" | "paying" | "done">("form");
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (me === null) router.replace("/signup");
  }, [me, router]);

  const P = PLANS[plan];
  const yearly = P.price * seats * 12;
  const tax = country === "India" ? Math.round(yearly * 0.18 * 100) / 100 : 0;
  const total = yearly + tax;
  const brand = brandOf(card);
  const errors = plan === "free" ? {} : {
    card: !luhn(card) ? "Check the card number." : undefined,
    exp: !expValid(exp) ? "Use a future date, MM/YY." : undefined,
    cvc: digits(cvc).length < (brand === "Amex" ? 4 : 3) ? "3 digits on the back." : undefined,
    holder: !holder.trim() ? "Name as on the card." : undefined,
  };
  const ok = !Object.values(errors).some(Boolean);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setPayError(null);
    if (!ok || !user || phase === "paying") return;
    setPhase("paying");
    try {
      await checkout({
        plan,
        seats: plan === "free" ? 5 : seats,
        country,
        gstin: gstin || undefined,
        card: plan === "free" ? undefined : { number: card, exp, cvc, name: holder },
        workspaceId: upgradeId ?? undefined,
      });
      setPhase("done");
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : "Payment didn't go through. Try again.");
      setPhase("form");
    }
  };

  if (!user) return <div className="boot" aria-busy="true" />;

  if (phase === "done")
    return (
      <AuthShell step={2}>
        <div className="paid">
          <span className="paid-check" aria-hidden="true">
            <svg viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="24" />
              <path d="M15 27l7 7 15-16" />
            </svg>
          </span>
          <h1>{plan === "free" ? "You're on the Free plan" : "Payment received"}</h1>
          <p className="lede">
            {plan === "free"
              ? "No card needed. Upgrade any time from Plan and billing."
              : `${P.name} plan for ${seats} ${seats === 1 ? "person" : "people"}, ${usd(total)} billed yearly. A receipt goes to ${user.email}.`}
          </p>
          {plan !== "free" && (
            <dl className="receipt">
              <dt>Plan</dt>
              <dd>
                {P.name} · {seats} seats
              </dd>
              <dt>Card</dt>
              <dd>
                {brand || "Card"} ending {digits(card).slice(-4)}
              </dd>
              <dt>Renews</dt>
              <dd>{yearFromNowLabel()}</dd>
            </dl>
          )}
          <button type="button" className="btn-ink wide big" onClick={() => router.push(upgradeId ? "/settings?tab=billing" : "/onboarding")}>
            {upgradeId ? "Back to billing →" : "Set up your workspace →"}
          </button>
        </div>
      </AuthShell>
    );

  return (
    <AuthShell step={1}>
      <h1>Choose your plan</h1>
      <p className="lede">Billed yearly. Change seats or plan any time.</p>
      <div className="plans" role="radiogroup" aria-label="Plan">
        {(Object.keys(PLANS) as PlanId[]).map((id) => (
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

            <div className="pay-box">
              <div className="pay-head">
                <strong>Card details</strong>
                <span className="cards-row" aria-hidden="true">
                  {["Visa", "Mastercard", "RuPay", "Amex"].map((b) => (
                    <span key={b} className={`cbrand ${brand === b ? "on" : ""}`}>
                      {b}
                    </span>
                  ))}
                </span>
              </div>
              <Field label="Card number" error={tried ? errors.card : undefined} hint="Test card: 4242 4242 4242 4242">
                <input inputMode="numeric" autoComplete="cc-number" value={card} onChange={(e) => setCard(fmtCard(e.target.value))} placeholder="1234 5678 9012 3456" />
              </Field>
              <div className="form-row three">
                <Field label="Expiry" error={tried ? errors.exp : undefined}>
                  <input inputMode="numeric" autoComplete="cc-exp" value={exp} onChange={(e) => setExp(fmtExp(e.target.value))} placeholder="MM/YY" />
                </Field>
                <Field label="CVC" error={tried ? errors.cvc : undefined}>
                  <input inputMode="numeric" autoComplete="cc-csc" value={cvc} onChange={(e) => setCvc(digits(e.target.value).slice(0, 4))} placeholder="123" />
                </Field>
                <Field label="Country">
                  <Picker label="Country" value={country} onChange={setCountry} className="pk-field" options={COUNTRIES.map((c) => ({ value: c, label: c }))} trigger={<span className="pk-value">{country}</span>} />
                </Field>
              </div>
              <Field label="Name on card" error={tried ? errors.holder : undefined}>
                <input autoComplete="cc-name" value={holder} onChange={(e) => setHolder(e.target.value)} placeholder={user.name} />
              </Field>
              {country === "India" && (
                <Field label="GSTIN" hint="Optional. Adds your GST number to the invoice.">
                  <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase().slice(0, 15))} placeholder="22AAAAA0000A1Z5" />
                </Field>
              )}
            </div>
          </>
        )}

        <div className="summary">
          <div>
            <span>
              {P.name}
              {plan !== "free" && ` · ${seats} × $${P.price} × 12 months`}
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
              <span className="spin" aria-hidden="true" /> Processing payment…
            </>
          ) : plan === "free" ? (
            "Continue with Free"
          ) : (
            `Pay ${usd(total)}`
          )}
        </button>
        <p className="secure">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <rect x="2" y="5" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M4 5V3.6a2 2 0 0 1 4 0V5" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          Payments are handled by the payment provider; Zelo never sees your full card number.
        </p>
      </form>
      <DemoNote>Test mode: no card is charged. 4242 4242 4242 4242 succeeds; 4000 0000 0000 0002 is declined. Only the brand and last 4 digits are stored.</DemoNote>
    </AuthShell>
  );
}
