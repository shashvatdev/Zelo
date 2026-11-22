import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { body, conflict, json, route } from "@/server/http";
import { wsAccess } from "@/server/session";
import { createFreshProduct, createSampleProduct, workspaceDetail } from "@/server/workspaces";

const Body = z.object({
  name: z.string().trim().min(1, "Give your workspace a name.").max(60),
  slug: z.string().trim().toLowerCase().min(2, "The URL needs at least 2 characters.").max(32).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Letters, numbers and dashes only."),
  teamSize: z.string().max(20).optional(),
  title: z.string().trim().max(40).optional(),
  productName: z.string().trim().min(1, "Name your product.").max(80),
  mode: z.enum(["empty", "sample"]),
  modules: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  release: z.object({ version: z.string().trim().min(1).max(30), name: z.string().trim().max(80).default(""), date: z.iso.date() }).optional(),
});

/** Finishes setup in one transaction: names the workspace and creates its product. */
export const POST = route(async (req, ctx: RouteContext<"/api/workspaces/[id]/onboard">) => {
  const { id } = await ctx.params;
  const { user, role } = await wsAccess(id, "owner");
  const b = await body(req, Body);
  if (b.mode === "empty" && (!b.modules.length || !b.release)) throw conflict("Pick at least one module and your first version.", "modules");
  const taken = await db.select({ id: schema.workspaces.id }).from(schema.workspaces).where(and(eq(schema.workspaces.slug, b.slug), ne(schema.workspaces.id, id)));
  if (taken.length) throw conflict("That workspace URL is taken. Try another.", "slug");

  await db.transaction(async (tx) => {
    const [ws] = await tx.select().from(schema.workspaces).where(eq(schema.workspaces.id, id)).for("update");
    // Inside the transaction, every query must use `tx` (a second pool connection here can deadlock under load).
    const [existing] = await tx.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.workspaceId, id)).limit(1);
    if (!ws.onboarded && !existing) {
      if (b.mode === "sample") await createSampleProduct(tx, id, { "p-bhumika": user.id, "p-shashvat": user.id }, b.productName);
      else await createFreshProduct(tx, id, { productName: b.productName, modules: b.modules, release: b.release! });
    }
    await tx.update(schema.workspaces).set({ name: b.name, slug: b.slug, teamSize: b.teamSize, onboarded: true }).where(eq(schema.workspaces.id, id));
    if (b.title) await tx.update(schema.members).set({ title: b.title }).where(and(eq(schema.members.workspaceId, id), eq(schema.members.userId, user.id)));
  });
  return json(await workspaceDetail(id, role));
});
