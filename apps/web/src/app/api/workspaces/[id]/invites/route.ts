import { z } from "zod";
import { body, json, route, zEmail } from "@/server/http";
import { wsAccess } from "@/server/session";
import { createInvites } from "@/server/workspaces";

export const POST = route(async (req, ctx: RouteContext<"/api/workspaces/[id]/invites">) => {
  const { id } = await ctx.params;
  const { user } = await wsAccess(id, "admin");
  const b = await body(req, z.object({ emails: z.array(zEmail).min(1, "Add at least one email.").max(50), role: z.enum(["admin", "member", "viewer"]) }));
  const sent = await createInvites(id, b.emails, b.role, { id: user.id, name: user.name });
  return json({ invites: sent }, { status: 201 });
});
