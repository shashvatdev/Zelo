import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { requireUser, setSessionWorkspace } from "@/server/auth";
import { config } from "@/server/config";
import { db, schema } from "@/server/db";
import { bad, body, HttpError, json, route } from "@/server/http";
import { receiptEmail, sendMail } from "@/server/mail";
import { charge, demoCharge, FREE_MAX_USERS, quote } from "@/server/payments";
import { PERSON_COLORS, seatsUsed } from "@/server/workspaces";

const Body = z.object({
  plan: z.enum(["free", "team", "business"]),
  seats: z.number().int().min(1).max(500),
  country: z.string().max(60).optional(),
  gstin: z.string().trim().max(15).optional(),
  card: z.object({ number: z.string().max(30), exp: z.string().max(7), cvc: z.string().max(4), name: z.string().trim().min(1, "Name as on the card.").max(80) }).optional(),
  /** Upgrading an existing workspace instead of creating one. */
  workspaceId: z.uuid().optional(),
});

/**
 * Pays (or chooses Free) and creates the workspace the owner then sets up in onboarding.
 * Re-running checkout before onboarding reuses the same unfinished workspace.
 *
 * Payments: with no gateway yet (PAYMENTS_MODE=demo, the default) paying without a card succeeds
 * at once and is recorded as a "demo" payment. A card, when sent, goes through the test provider.
 *
 * One person's checkouts run one at a time (a per-user advisory lock), so a double click can't
 * create two workspaces or record the same payment twice.
 */
export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await body(req, Body);
  const seats = b.plan === "free" ? FREE_MAX_USERS : b.seats;
  const q = quote(b.plan, seats, b.country);
  if (b.plan !== "free" && !b.card && config.paymentsMode !== "demo") throw bad("Add a card to pay.", "card");

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`checkout:${u.id}`}))`);
    let target = b.workspaceId
      ? (await tx.select().from(schema.workspaces).where(and(eq(schema.workspaces.id, b.workspaceId), eq(schema.workspaces.ownerId, u.id))))[0]
      : (await tx.select().from(schema.workspaces).where(and(eq(schema.workspaces.ownerId, u.id), eq(schema.workspaces.onboarded, false))).orderBy(desc(schema.workspaces.createdAt)).limit(1))[0];
    if (b.workspaceId && !target) throw new HttpError(404, "Workspace not found.", "not_found");
    if (target && seats < (await seatsUsed(tx, target.id))) throw bad("You have more people than that. Remove someone or pick more seats.", "seats");

    // The same purchase repeated within a minute (double click, retry after a dropped response): answer, don't charge again.
    if (target && b.plan !== "free" && target.plan === b.plan && target.seats === seats) {
      const [recent] = await tx
        .select()
        .from(schema.payments)
        .where(and(eq(schema.payments.workspaceId, target.id), eq(schema.payments.status, "paid"), eq(schema.payments.plan, b.plan), eq(schema.payments.seats, seats), gte(schema.payments.createdAt, new Date(Date.now() - 60_000))))
        .limit(1);
      if (recent) return { ws: target, card: recent.cardLast4 ? { brand: recent.cardBrand ?? "", last4: recent.cardLast4 } : null, paid: false, repeat: true };
    }

    let card: { brand: string; last4: string; exp: string; ref: string; provider: "test" | "demo" } | null = null;
    if (b.plan !== "free") {
      if (b.card) {
        const res = await charge(b.card, q.total);
        if (!res.ok) {
          if (target) await tx.insert(schema.payments).values({ workspaceId: target.id, plan: b.plan, seats, amountCents: q.amount, taxCents: q.tax, provider: "test", status: "failed", failureReason: res.reason, country: b.country });
          return { declined: res.reason };
        }
        card = { brand: res.brand, last4: res.last4, exp: res.exp, ref: res.ref, provider: "test" };
      } else {
        const res = demoCharge();
        card = { brand: "", last4: "", exp: "", ref: res.ref, provider: "demo" };
      }
    }

    const billing = card
      ? { cardBrand: card.brand || null, cardLast4: card.last4 || null, cardExp: card.exp || null, paidUntil: new Date(Date.now() + 365 * 86400000) }
      : { cardBrand: null, cardLast4: null, cardExp: null, paidUntil: null };
    if (target) {
      [target] = await tx.update(schema.workspaces).set({ plan: b.plan, seats, ...billing }).where(eq(schema.workspaces.id, target.id)).returning();
    } else {
      [target] = await tx.insert(schema.workspaces).values({ plan: b.plan, seats, ownerId: u.id, ...billing }).returning();
      await tx.insert(schema.members).values({ workspaceId: target.id, userId: u.id, role: "owner", color: PERSON_COLORS[0] });
    }
    if (card) {
      await tx.insert(schema.payments).values({
        workspaceId: target.id,
        plan: b.plan,
        seats,
        amountCents: q.amount,
        taxCents: q.tax,
        provider: card.provider,
        providerRef: card.ref,
        status: "paid",
        cardBrand: card.brand || null,
        cardLast4: card.last4 || null,
        gstin: b.gstin || null,
        country: b.country,
      });
    }
    return { ws: target, card: card?.last4 ? { brand: card.brand, last4: card.last4 } : null, paid: !!card, repeat: false };
  });

  // A declined card is recorded (above, committed) and then reported.
  if ("declined" in result) throw new HttpError(402, result.declined!, "card_declined", "card");
  const { ws, card, paid } = result;
  await setSessionWorkspace(u.sessionId, ws.id);
  if (paid) {
    await sendMail(
      receiptEmail({ to: u.email, workspace: ws.name, plan: b.plan[0].toUpperCase() + b.plan.slice(1), seats, total: `$${(q.total / 100).toFixed(2)}`, card: card ? `${card.brand} ending ${card.last4}` : null }),
    ).catch((e) => console.error("[checkout] receipt email failed", e));
  }
  return json({
    workspaceId: ws.id,
    plan: b.plan,
    seats,
    totalCents: b.plan === "free" ? 0 : q.total,
    taxCents: b.plan === "free" ? 0 : q.tax,
    card,
    demo: b.plan !== "free" && !card,
    renews: ws.paidUntil?.toISOString() ?? null,
  });
});
