import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { createSession, hashPassword, sha256 } from "@/server/auth";
import { db, schema } from "@/server/db";
import { body, HttpError, json, route, zPassword } from "@/server/http";

export const POST = route(async (req) => {
  const { token, password } = await body(req, z.object({ token: z.string().min(10).max(200), password: zPassword }));
  const hash = await hashPassword(password);
  const userId = await db.transaction(async (tx) => {
    const [r] = await tx
      .update(schema.passwordResets)
      .set({ usedAt: new Date() })
      .where(and(eq(schema.passwordResets.tokenHash, sha256(token)), isNull(schema.passwordResets.usedAt), gt(schema.passwordResets.expiresAt, new Date())))
      .returning({ userId: schema.passwordResets.userId });
    if (!r) throw new HttpError(410, "This reset link has expired or was already used. Ask for a new one.", "expired");
    await tx.update(schema.users).set({ passwordHash: hash }).where(eq(schema.users.id, r.userId));
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, r.userId)); // sign out everywhere
    return r.userId;
  });
  await createSession(userId);
  return json({ ok: true });
});
