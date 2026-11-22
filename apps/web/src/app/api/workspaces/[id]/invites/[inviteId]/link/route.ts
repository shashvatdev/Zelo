import { json, route } from "@/server/http";
import { wsAccess } from "@/server/session";
import { refreshInvite } from "@/server/workspaces";

/** Fresh copyable link (the previous link stops working; no email is sent). */
export const POST = route(async (_req, ctx: RouteContext<"/api/workspaces/[id]/invites/[inviteId]/link">) => {
  const { id, inviteId } = await ctx.params;
  const { user } = await wsAccess(id, "admin");
  return json(await refreshInvite(id, inviteId, { id: user.id, name: user.name }, false));
});
