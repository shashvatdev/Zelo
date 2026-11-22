import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { body, json, route } from "@/server/http";
import { wsAccess } from "@/server/session";

type Ctx = RouteContext<"/api/workspaces/[id]/notifications">;
const week = () => new Date(Date.now() - 7 * 86400000);

export const GET = route(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { user } = await wsAccess(id);
  const [s] = await db.select().from(schema.notificationState).where(and(eq(schema.notificationState.userId, user.id), eq(schema.notificationState.workspaceId, id)));
  return json({ readBefore: (s?.readBefore ?? week()).toISOString(), readIds: s?.readIds ?? [] });
});

/** Mark some notifications read, or everything up to now ("Mark all read"). */
export const PUT = route(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { user } = await wsAccess(id);
  const b = await body(req, z.object({ readIds: z.array(z.string().max(80)).max(500).optional(), all: z.boolean().optional() }));
  const [s] = await db.select().from(schema.notificationState).where(and(eq(schema.notificationState.userId, user.id), eq(schema.notificationState.workspaceId, id)));
  const readBefore = b.all ? new Date() : (s?.readBefore ?? week());
  const readIds = b.all ? [] : [...new Set([...(s?.readIds ?? []), ...(b.readIds ?? [])])].slice(-500);
  await db
    .insert(schema.notificationState)
    .values({ userId: user.id, workspaceId: id, readBefore, readIds })
    .onConflictDoUpdate({ target: [schema.notificationState.userId, schema.notificationState.workspaceId], set: { readBefore, readIds } });
  return json({ readBefore: readBefore.toISOString(), readIds });
});
