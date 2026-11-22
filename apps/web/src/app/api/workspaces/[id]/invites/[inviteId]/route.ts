import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { json, notFound, route } from "@/server/http";
import { wsAccess } from "@/server/session";

export const DELETE = route(async (_req, ctx: RouteContext<"/api/workspaces/[id]/invites/[inviteId]">) => {
  const { id, inviteId } = await ctx.params;
  await wsAccess(id, "admin");
  const r = await db
    .update(schema.invites)
    .set({ status: "revoked" })
    .where(and(eq(schema.invites.id, inviteId), eq(schema.invites.workspaceId, id), eq(schema.invites.status, "pending")))
    .returning({ id: schema.invites.id });
  if (!r.length) throw notFound("That invite is no longer pending.");
  return json({ ok: true });
});
