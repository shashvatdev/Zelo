import { and, count, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { json, route } from "@/server/http";
import { currentSession } from "@/server/auth";
import { findInviteByToken } from "@/server/workspaces";

/** Public: what the accept page shows. Reveals nothing beyond the invite itself. */
export const GET = route(async (_req, ctx: RouteContext<"/api/invites/[token]">) => {
  const { token } = await ctx.params;
  const row = token.length > 10 && token.length < 200 ? await findInviteByToken(token) : null;
  if (!row) return json({ status: "missing" });
  const { invite, workspace, inviterName } = row;
  const status = invite.status === "revoked" ? "revoked" : invite.status === "accepted" ? "used" : invite.expiresAt < new Date() ? "expired" : "valid";
  if (status !== "valid") return json({ status, workspace: { name: workspace.name } });
  const [[{ n }], existing, session] = await Promise.all([
    db.select({ n: count() }).from(schema.members).where(eq(schema.members.workspaceId, workspace.id)),
    db.select({ id: schema.users.id, hasPassword: schema.users.passwordHash }).from(schema.users).where(and(eq(schema.users.email, invite.email))).limit(1),
    currentSession(),
  ]);
  return json({
    status,
    email: invite.email,
    role: invite.role,
    inviterName,
    workspace: { id: workspace.id, name: workspace.name },
    teamCount: n,
    existingAccount: existing.length > 0,
    accountHasPassword: !!existing[0]?.hasPassword,
    signedInAs: session ? { email: session.email, name: session.name } : null,
  });
});
