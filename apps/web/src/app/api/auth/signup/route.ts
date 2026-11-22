import { z } from "zod";
import { assertNotLimited, clientIp, createSession, hashPassword, IP_LIMIT_PER_HOUR, recordAttempt } from "@/server/auth";
import { db, schema } from "@/server/db";
import { body, conflict, json, route, zEmail, zName, zPassword } from "@/server/http";

const Body = z.object({ name: zName, email: zEmail, password: zPassword });

export const POST = route(async (req) => {
  const { name, email, password } = await body(req, Body);
  const ip = clientIp(req);
  const ipKey = ip && `signup:${ip}`;
  await assertNotLimited(ipKey, IP_LIMIT_PER_HOUR, 60);
  await recordAttempt(ipKey);
  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(schema.users).values({ name, email, passwordHash }).onConflictDoNothing({ target: schema.users.email }).returning({ id: schema.users.id });
  if (!user) throw conflict("There is already an account with this email. Log in instead.", "email");
  await createSession(user.id);
  return json({ user: { id: user.id, name, email } }, { status: 201 });
});
