import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { createSession } from "@/server/auth";
import { config } from "@/server/config";
import { db, schema } from "@/server/db";
import { route } from "@/server/http";

const back = (path: string) => Response.redirect(`${config.appUrl}${path}`, 302);

export const GET = route(async (req) => {
  if (!config.google) return back("/login?error=google");
  const url = new URL(req.url);
  const jar = await cookies();
  const saved = JSON.parse(jar.get("zelo_oauth")?.value ?? "{}") as { state?: string; next?: string };
  jar.delete("zelo_oauth");
  if (!saved.state || saved.state !== url.searchParams.get("state") || !url.searchParams.get("code")) return back("/login?error=google");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code: url.searchParams.get("code")!, client_id: config.google.id, client_secret: config.google.secret, redirect_uri: `${config.appUrl}/api/auth/google/callback`, grant_type: "authorization_code" }),
    signal: AbortSignal.timeout(10_000),
  });
  const tok = (await tokenRes.json()) as { access_token?: string };
  if (!tok.access_token) return back("/login?error=google");
  const info = (await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tok.access_token}` }, signal: AbortSignal.timeout(10_000) })).json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string };
  if (!info.sub || !info.email || !info.email_verified) return back("/login?error=google");
  const email = info.email.toLowerCase();
  const [bySub] = await db.select().from(schema.users).where(eq(schema.users.googleSub, info.sub)).limit(1);
  const [byEmail] = bySub ? [bySub] : await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  let userId = byEmail?.id;
  if (byEmail && !byEmail.googleSub) await db.update(schema.users).set({ googleSub: info.sub }).where(eq(schema.users.id, byEmail.id));
  if (!userId) [{ id: userId }] = await db.insert(schema.users).values({ email, name: info.name || email.split("@")[0], googleSub: info.sub }).returning({ id: schema.users.id });
  await createSession(userId!);
  return back(saved.next ?? "/app");
});
