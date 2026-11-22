import { forbidden, json, route } from "@/server/http";
import { wsAccess } from "@/server/session";
import { resetDemo } from "@/server/workspaces";

/** Restores the sample workspace to its original data. */
export const POST = route(async (_req, ctx: RouteContext<"/api/workspaces/[id]/reset">) => {
  const { id } = await ctx.params;
  const { workspace } = await wsAccess(id, "member");
  if (!workspace.demo) throw forbidden("Only the sample workspace can be reset.");
  await resetDemo(id);
  return json({ ok: true });
});
