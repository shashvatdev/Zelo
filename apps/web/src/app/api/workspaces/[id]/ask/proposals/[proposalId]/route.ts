import { z } from "zod";
import { decideProposal } from "@/server/ai/proposals";
import { body, json, route, zUuid } from "@/server/http";
import { wsAccess } from "@/server/session";

/** Confirm (apply) or cancel a change Ask Zelo suggested. */
export const POST = route(async (req, ctx: RouteContext<"/api/workspaces/[id]/ask/proposals/[proposalId]">) => {
  const { id, proposalId } = await ctx.params;
  const { user, role } = await wsAccess(id);
  const { decision } = await body(req, z.object({ decision: z.enum(["apply", "cancel"]) }));
  const proposal = await decideProposal({ id: zUuid.parse(proposalId), workspaceId: id, userId: user.id, role, decision });
  return json({ proposal });
});
