import { randomUUID } from "node:crypto";

/**
 * Card payments behind one interface. The built-in "test" provider behaves like a real
 * gateway in test mode (Stripe-style test numbers), so checkout can be exercised end to end.
 * A Stripe or Razorpay adapter implements the same `charge` when keys are added.
 */
export type Card = { number: string; exp: string; cvc: string; name: string };
export type ChargeResult = { ok: true; ref: string; brand: string; last4: string; exp: string } | { ok: false; reason: string };

const digits = (s: string) => s.replace(/\D/g, "");

export function cardBrand(num: string) {
  const d = digits(num);
  if (/^4/.test(d)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "Mastercard";
  if (/^3[47]/.test(d)) return "Amex";
  if (/^(60|65|81|82|508)/.test(d)) return "RuPay";
  return "Card";
}

export function luhn(num: string) {
  const d = digits(num);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export function expValid(exp: string, now = new Date()) {
  const m = /^(\d{2})\/(\d{2})$/.exec(exp.trim());
  if (!m) return false;
  const month = Number(m[1]);
  if (month < 1 || month > 12) return false;
  return new Date(2000 + Number(m[2]), month, 1) > now;
}

/** Test numbers that fail, so the failure path can be tried (same idea as Stripe's). */
const DECLINES: Record<string, string> = {
  "4000000000000002": "Your card was declined.",
  "4000000000009995": "Your card has insufficient funds.",
};

export async function charge(card: Card, amountCents: number): Promise<ChargeResult> {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { ok: false, reason: "Nothing to charge." };
  const num = digits(card.number);
  if (!luhn(num)) return { ok: false, reason: "Check the card number." };
  if (!expValid(card.exp)) return { ok: false, reason: "The card has expired or the date is wrong." };
  const cvcLen = cardBrand(num) === "Amex" ? 4 : 3;
  if (digits(card.cvc).length !== cvcLen) return { ok: false, reason: "Check the security code." };
  if (DECLINES[num]) return { ok: false, reason: DECLINES[num] };
  return { ok: true, ref: `test_${randomUUID()}`, brand: cardBrand(num), last4: num.slice(-4), exp: card.exp };
}

/** No gateway yet: an instant, always-successful payment, clearly marked as a demo. */
export function demoCharge(): ChargeResult & { ok: true } {
  return { ok: true, ref: `demo_${randomUUID()}`, brand: "", last4: "", exp: "" };
}

export const PRICES = { free: 0, team: 10, business: 20 } as const;
export const FREE_MAX_USERS = 5;

/** Yearly price in cents, plus 18% GST for India. */
export function quote(plan: keyof typeof PRICES, seats: number, country?: string) {
  const amount = PRICES[plan] * seats * 12 * 100;
  const tax = country === "India" ? Math.round(amount * 0.18) : 0;
  return { amount, tax, total: amount + tax };
}
