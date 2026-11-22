import { eq } from "drizzle-orm";
import { z } from "zod";
import { assertNotLimited, clientIp, createSession, currentSession, hashPassword, IP_LIMIT_PER_HOUR, recordAttempt, setSessionWorkspace, verifyPassword } from "@/server/auth";
import { db, schema } from "@/server/db";
import { body, HttpError, json, route, zName, zPassword } from "@/server/http";
import { findInviteByToken, joinFromInvite } from "@/server/workspaces";

const Body = z.object({ name: zName.optional(), password: z.string().max(200).optional() });

/**
 * Accept an invite:
 *  - signed in as the invited email → join
 *  - account exists → check its password, sign in, join
 *  - no account → create it (name + password), sign in, join
 */
export const POST = route(async (req, ctx: RouteContext<"/api/invites/[token]/accept">) => {
  const { token } = await ctx.params;
  const b = await body(req, Body);
  const row = await findInviteByToken(token);
  if (!row) throw new HttpError(404, "This invite link doesn't work.", "not_found");
  const email = row.invite.email;
  // Check the invite before touching accounts, so a dead link never creates a stray user.
  if (row.invite.status === "revoked") throw new HttpError(410, "This invite was cancelled.", "revoked");
  if (row.invite.status === "accepted") throw new HttpError(410, "This invite was already used. Log in instead.", "used");
  if (row.invite.expiresAt < new Date()) throw new HttpError(410, "This invite has expired. Ask for a new one.", "expired");
  const session = await currentSession();

  let userId: string;
  if (session && session.email === email) {
    userId = session.id;
  } else {
    if (session && session.email !== email) throw new HttpError(403, `You're signed in as ${session.email}, but this invite is for ${email}. Log out first.`, "wrong_user");
    const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (existing) {
      const key = `login:${email}`;
      await assertNotLimited(key, 8, 15);
      if (!b.password || !(await verifyPassword(b.password, existing.passwordHash))) {
        await recordAttempt(key);
        throw new HttpError(401, "That password isn't right.", "bad_credentials", "password");
      }
      userId = existing.id;
    } else {
      const name = zName.parse(b.name ?? "");
      const password = zPassword.parse(b.password ?? "");
      const ip = clientIp(req);
      await assertNotLimited(ip && `signup:${ip}`, IP_LIMIT_PER_HOUR, 60);
      const [u] = await db.insert(schema.users).values({ email, name, passwordHash: await hashPassword(password) }).onConflictDoNothing({ target: schema.users.email }).returning({ id: schema.users.id });
      if (!u) throw new HttpError(409, "An account was just created for this email. Log in to accept.", "conflict");
      userId = u.id;
    }
  }
  const workspaceId = await joinFromInvite(token, { id: userId, email });
  if (session && session.id === userId) await setSessionWorkspace(session.sessionId, workspaceId);
  else await createSession(userId, workspaceId);
  return json({ workspaceId, role: row.invite.role, workspaceName: row.workspace.name });
});
