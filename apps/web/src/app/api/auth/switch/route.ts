import { z } from "zod";
import { requireMember, requireUser, setSessionWorkspace } from "@/server/auth";
import { body, json, route, zUuid } from "@/server/http";

export const POST = route(async (req) => {
  const { workspaceId } = await body(req, z.object({ workspaceId: zUuid }));
  const u = await requireUser();
  await requireMember(u.id, workspaceId);
  await setSessionWorkspace(u.sessionId, workspaceId);
  return json({ ok: true });
});
