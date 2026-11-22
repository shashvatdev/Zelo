import { and, asc, eq } from "drizzle-orm";
import { currentSession, requireMember, requireUser, type Role } from "./auth";
import { db, schema } from "./db";

/** The signed-in user plus every workspace they belong to, and which one is active. */
export async function me() {
  const u = await currentSession();
  if (!u) return null;
  const ws = await db
    .select({ id: schema.workspaces.id, name: schema.workspaces.name, role: schema.members.role, onboarded: schema.workspaces.onboarded, plan: schema.workspaces.plan, demo: schema.workspaces.demo, ownerId: schema.workspaces.ownerId })
    .from(schema.members)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.members.workspaceId))
    .where(eq(schema.members.userId, u.id))
    .orderBy(asc(schema.members.joinedAt));
  const active = ws.find((w) => w.id === u.workspaceId) ?? ws.find((w) => w.onboarded) ?? ws[0] ?? null;
  return {
    user: { id: u.id, name: u.name, email: u.email, hasPassword: u.hasPassword },
    workspaces: ws.map(({ ownerId, ...w }) => ({ ...w, isOwner: ownerId === u.id })),
    activeWorkspaceId: active?.id ?? null,
    sessionId: u.sessionId,
  };
}

/** Route helper: the signed-in user and their membership of the workspace in the URL. */
export async function wsAccess(workspaceId: string, min: Role = "viewer") {
  const user = await requireUser();
  const m = await requireMember(user.id, workspaceId, min);
  return { user, role: m.role, workspace: m.workspace };
}

export async function isMember(userId: string, workspaceId: string) {
  const r = await db.select({ u: schema.members.userId }).from(schema.members).where(and(eq(schema.members.userId, userId), eq(schema.members.workspaceId, workspaceId))).limit(1);
  return r.length > 0;
}
