import { json, route } from "@/server/http";
import { wsAccess } from "@/server/session";
import { latestPayments } from "@/server/workspaces";

export const GET = route(async (_req, ctx: RouteContext<"/api/workspaces/[id]/payments">) => {
  const { id } = await ctx.params;
  await wsAccess(id, "admin");
  const rows = await latestPayments(id);
  return json(rows.map((p) => ({ id: p.id, plan: p.plan, seats: p.seats, amountCents: p.amountCents, taxCents: p.taxCents, status: p.status, failureReason: p.failureReason, card: p.cardLast4 ? `${p.cardBrand} •••• ${p.cardLast4}` : null, createdAt: p.createdAt.toISOString() })));
});
