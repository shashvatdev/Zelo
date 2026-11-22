import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { bad, body, json, route } from "@/server/http";
import { wsAccess } from "@/server/session";
import { seatsUsed, workspaceDetail } from "@/server/workspaces";

/** Change seat count on a paid plan (proration is the payment provider's job). */
export const PATCH = route(async (req, ctx: RouteContext<"/api/workspaces/[id]/seats">) => {
  const { id } = await ctx.params;
  const { role, workspace } = await wsAccess(id, "owner");
  const { seats } = await body(req, z.object({ seats: z.number().int().min(1).max(500) }));
  if (workspace.plan === "free") throw bad("The Free plan has a fixed 5 people. Upgrade to choose seats.");
  if (seats < (await seatsUsed(db, id))) throw bad("You have more people than that. Remove someone first.", "seats");
  await db.update(schema.workspaces).set({ seats }).where(eq(schema.workspaces.id, id));
  return json(await workspaceDetail(id, role));
});
