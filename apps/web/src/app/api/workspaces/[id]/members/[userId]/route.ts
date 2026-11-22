import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { bumpVersion, productOf } from "@/server/graph";
import { bad, body, forbidden, HttpError, json, notFound, route } from "@/server/http";
import { wsAccess } from "@/server/session";
import { bumpWorkspace, seatLimit, seatsUsed, workspaceDetail } from "@/server/workspaces";

type Ctx = RouteContext<"/api/workspaces/[id]/members/[userId]">;

async function target(id: string, userId: string) {
  const [m] = await db.select().from(schema.members).where(and(eq(schema.members.workspaceId, id), eq(schema.members.userId, userId)));
  if (!m) throw notFound("That person isn't in this workspace.");
  return m;
}

export const PATCH = route(async (req, ctx: Ctx) => {
  const { id, userId } = await ctx.params;
  const { user, role, workspace } = await wsAccess(id, "admin");
  const { role: next } = await body(req, z.object({ role: z.enum(["admin", "member", "viewer"]) }));
  const m = await target(id, userId);
  if (m.role === "owner") throw forbidden("The owner's role can't be changed.");
  if (userId === user.id) throw bad("You can't change your own role.");
  if (m.role === "viewer" && next !== "viewer" && (await seatsUsed(db, id)) + 1 > seatLimit(workspace)) throw new HttpError(402, "No seats left for another editor. Add seats in billing.", "seats");
  await db.transaction(async (tx) => {
    await tx.update(schema.members).set({ role: next }).where(and(eq(schema.members.workspaceId, id), eq(schema.members.userId, userId)));
    await bumpWorkspace(tx, id);
  });
  return json(await workspaceDetail(id, role));
});

/** Removes someone. Their open tickets become unassigned; history keeps their name. */
export const DELETE = route(async (_req, ctx: Ctx) => {
  const { id, userId } = await ctx.params;
  const { user, role } = await wsAccess(id, "admin");
  const m = await target(id, userId);
  if (m.role === "owner") throw forbidden("The owner can't be removed.");
  if (userId === user.id) throw bad("You can't remove yourself.");
  const product = await productOf(id);
  await db.transaction(async (tx) => {
    await tx.delete(schema.members).where(and(eq(schema.members.workspaceId, id), eq(schema.members.userId, userId)));
    // Keep them signed in (they may belong to other workspaces); just drop this one as their active workspace.
    await tx.update(schema.sessions).set({ workspaceId: null }).where(and(eq(schema.sessions.userId, userId), eq(schema.sessions.workspaceId, id)));
    if (product) {
      await tx.update(schema.tickets).set({ assigneeId: null }).where(and(eq(schema.tickets.productId, product.id), eq(schema.tickets.assigneeId, userId), ne(schema.tickets.status, "done")));
      await tx.update(schema.bugs).set({ assigneeId: null }).where(and(eq(schema.bugs.productId, product.id), eq(schema.bugs.assigneeId, userId), ne(schema.bugs.status, "done")));
      await bumpVersion(tx, product.id);
    }
  });
  return json(await workspaceDetail(id, role));
});
