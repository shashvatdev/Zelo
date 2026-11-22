import { eq } from "drizzle-orm";
import { z } from "zod";
import { createSession } from "@/server/auth";
import { config } from "@/server/config";
import { db, schema } from "@/server/db";
import { body, HttpError, json, route } from "@/server/http";
import { DEMO_USERS, ensureDemo } from "@/server/workspaces";

/** Opens the shared sample workspace as one of its two sample people. */
export const POST = route(async (req) => {
  if (!config.demoEnabled) throw new HttpError(404, "The sample workspace is turned off.", "not_found");
  const { as } = await body(req, z.object({ as: z.enum(["bhumika", "shashvat"]).default("bhumika") }));
  const ws = await ensureDemo();
  const [u] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, DEMO_USERS[as].email));
  await createSession(u.id, ws.id);
  return json({ workspaceId: ws.id });
});
