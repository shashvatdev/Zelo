import { eq } from "drizzle-orm";
import { z } from "zod";
import { assertNotLimited, burnPasswordCheck, clearAttempts, clientIp, createSession, recordAttempt, verifyPassword } from "@/server/auth";
import { db, schema } from "@/server/db";
import { body, HttpError, json, route, zEmail } from "@/server/http";

const Body = z.object({ email: zEmail, password: z.string().min(1, "Enter your password.").max(200) });

export const POST = route(async (req) => {
  const { email, password } = await body(req, Body);
  const key = `login:${email}`;
  const ip = clientIp(req);
  const ipKey = ip && `login-ip:${ip}`;
  await assertNotLimited(key, 8, 15);
  await assertNotLimited(ipKey, 40, 15);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  const ok = user ? await verifyPassword(password, user.passwordHash) : await burnPasswordCheck(password);
  if (!user || !ok) {
    await Promise.all([recordAttempt(key), recordAttempt(ipKey)]);
    if (user && !user.passwordHash) throw new HttpError(400, "This account uses Google sign-in, or was never given a password. Use “Forgot password” to set one.", "no_password");
    throw new HttpError(401, "That email and password don't match.", "bad_credentials");
  }
  await clearAttempts(key);
  await createSession(user.id);
  return json({ user: { id: user.id, name: user.name, email: user.email } });
});
