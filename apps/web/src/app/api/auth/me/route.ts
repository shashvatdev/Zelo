import { json, route, unauthorized } from "@/server/http";
import { me } from "@/server/session";

export const GET = route(async () => {
  const m = await me();
  if (!m) throw unauthorized();
  return json({ user: m.user, workspaces: m.workspaces, activeWorkspaceId: m.activeWorkspaceId });
});
