/**
 * The start flow's routing rules, in one pure module (no React), used by every page and tested
 * directly: signup → plan & payment → workspace setup → the product map.
 */

type FlowMe = { workspaces: { id: string; onboarded: boolean; isOwner: boolean }[]; activeWorkspaceId: string | null };

/**
 * Where someone belongs right now:
 *  - the active workspace is theirs and not set up yet → onboarding (they're mid-setup)
 *  - any finished workspace → the product map
 *  - a workspace they own that isn't set up yet (plan already chosen) → onboarding
 *  - nothing yet → choose a plan
 */
export function nextPath(me: FlowMe): "/app" | "/onboarding" | "/checkout" {
  const active = me.workspaces.find((w) => w.id === me.activeWorkspaceId);
  if (active && !active.onboarded && active.isOwner) return "/onboarding";
  if (me.workspaces.some((w) => w.onboarded)) return "/app";
  if (me.workspaces.some((w) => w.isOwner && !w.onboarded)) return "/onboarding";
  return "/checkout";
}

/** A same-site path from a `next` query param, or null (never an external URL). */
export function safeNext(v: string | null | undefined) {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : null;
}
