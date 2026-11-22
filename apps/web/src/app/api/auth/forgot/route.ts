import { eq } from "drizzle-orm";
import { z } from "zod";
import { assertNotLimited, clientIp, newToken, recordAttempt, sha256 } from "@/server/auth";
import { config } from "@/server/config";
import { db, schema } from "@/server/db";
import { body, json, route, zEmail } from "@/server/http";
import { resetEmail, sendMail } from "@/server/mail";

/** Always answers the same way, so it can't be used to find out who has an account. */
export const POST = route(async (req) => {
  const { email } = await body(req, z.object({ email: zEmail }));
  const ip = clientIp(req);
  await assertNotLimited(ip && `forgot:${ip}`, 10, 60);
  await recordAttempt(ip && `forgot:${ip}`);
  // and per address, so one inbox can't be flooded
  await assertNotLimited(`forgot-email:${email}`, 5, 60);
  await recordAttempt(`forgot-email:${email}`);
  const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (user) {
    const token = newToken();
    await db.insert(schema.passwordResets).values({ tokenHash: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + 3600_000) });
    await sendMail(resetEmail({ to: email, url: `${config.appUrl}/reset?token=${encodeURIComponent(token)}` }));
  }
  return json({ ok: true });
});
