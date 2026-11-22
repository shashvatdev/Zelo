import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser, setSessionWorkspace } from "@/server/auth";
import { db, schema } from "@/server/db";
import { bad, body, HttpError, json, route } from "@/server/http";
import { receiptEmail, sendMail } from "@/server/mail";
import { charge, FREE_MAX_USERS, quote } from "@/server/payments";
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
 */
export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await body(req, Body);
  const seats = b.plan === "free" ? FREE_MAX_USERS : b.seats;
  const q = quote(b.plan, seats, b.country);

  let target = b.workspaceId
    ? (await db.select().from(schema.workspaces).where(and(eq(schema.workspaces.id, b.workspaceId), eq(schema.workspaces.ownerId, u.id))))[0]
    : (await db.select().from(schema.workspaces).where(and(eq(schema.workspaces.ownerId, u.id), eq(schema.workspaces.onboarded, false))))[0];
  if (b.workspaceId && !target) throw new HttpError(404, "Workspace not found.", "not_found");
  if (target && seats < (await seatsUsed(db, target.id))) throw bad("You have more people than that. Remove someone or pick more seats.", "seats");

  let card: { brand: string; last4: string; exp: string; ref: string } | null = null;
  if (b.plan !== "free") {
    if (!b.card) throw bad("Add a card to pay.", "card");
    const res = await charge(b.card, q.total);
    if (!res.ok) {
      if (target) await db.insert(schema.payments).values({ workspaceId: target.id, plan: b.plan, seats, amountCents: q.amount, taxCents: q.tax, provider: "test", status: "failed", failureReason: res.reason, country: b.country });
      throw new HttpError(402, res.reason, "card_declined", "card");
    }
    card = { brand: res.brand, last4: res.last4, exp: res.exp, ref: res.ref };
  }

  const ws = await db.transaction(async (tx) => {
    const billing = card ? { cardBrand: card.brand, cardLast4: card.last4, cardExp: card.exp, paidUntil: new Date(Date.now() + 365 * 86400000) } : {};
    if (target) {
      [target] = await tx.update(schema.workspaces).set({ plan: b.plan, seats, ...billing }).where(eq(schema.workspaces.id, target.id)).returning();
    } else {
      [target] = await tx.insert(schema.workspaces).values({ plan: b.plan, seats, ownerId: u.id, ...billing }).returning();
      await tx.insert(schema.members).values({ workspaceId: target.id, userId: u.id, role: "owner", color: PERSON_COLORS[0] });
    }
    if (card) {
      await tx.insert(schema.payments).values({ workspaceId: target.id, plan: b.plan, seats, amountCents: q.amount, taxCents: q.tax, provider: "test", providerRef: card.ref, status: "paid", cardBrand: card.brand, cardLast4: card.last4, gstin: b.gstin || null, country: b.country });
    }
    return target;
  });
  await setSessionWorkspace(u.sessionId, ws.id);
  if (card) await sendMail(receiptEmail({ to: u.email, workspace: ws.name, plan: b.plan[0].toUpperCase() + b.plan.slice(1), seats, total: `$${(q.total / 100).toFixed(2)}`, card: `${card.brand} ending ${card.last4}` }));
  return json({ workspaceId: ws.id, plan: b.plan, seats, totalCents: q.total, card: card ? { brand: card.brand, last4: card.last4 } : null, renews: ws.paidUntil?.toISOString() ?? null });
});
