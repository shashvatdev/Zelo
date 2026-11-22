import { eq } from "drizzle-orm";
import { config } from "@/server/config";
import { db, schema } from "@/server/db";
import { notFound, route } from "@/server/http";

export const GET = route(async (_req, ctx: RouteContext<"/api/dev/mailbox/[emailId]">) => {
  if (!config.devMailbox) throw notFound();
  const { emailId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(emailId)) throw notFound();
  const [e] = await db.select().from(schema.emails).where(eq(schema.emails.id, emailId));
  if (!e) throw notFound();
  return new Response(e.html, { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:", "Cache-Control": "no-store" } });
});
