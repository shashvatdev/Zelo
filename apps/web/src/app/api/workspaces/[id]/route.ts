import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { body, conflict, json, route } from "@/server/http";
import { wsAccess } from "@/server/session";
import { workspaceDetail } from "@/server/workspaces";

type Ctx = RouteContext<"/api/workspaces/[id]">;
const slug = z.string().trim().toLowerCase().min(2, "At least 2 characters.").max(32).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Letters, numbers and dashes only.");

export const GET = route(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { role } = await wsAccess(id);
  return json(await workspaceDetail(id, role));
});

export const PATCH = route(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { role } = await wsAccess(id, "admin");
  const b = await body(req, z.object({ name: z.string().trim().min(1, "Give it a name.").max(60).optional(), slug: slug.optional(), teamSize: z.string().max(20).optional() }));
  if (b.slug) {
    const taken = await db.select({ id: schema.workspaces.id }).from(schema.workspaces).where(and(eq(schema.workspaces.slug, b.slug), ne(schema.workspaces.id, id)));
    if (taken.length) throw conflict("That URL is taken. Try another.", "slug");
  }
  await db.update(schema.workspaces).set(b).where(eq(schema.workspaces.id, id));
  return json(await workspaceDetail(id, role));
});
