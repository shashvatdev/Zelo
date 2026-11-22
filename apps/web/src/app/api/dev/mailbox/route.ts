import { desc } from "drizzle-orm";
import { config } from "@/server/config";
import { db, schema } from "@/server/db";
import { json, notFound, route } from "@/server/http";

/** Development only: every email the app sent, newest first. */
export const GET = route(async () => {
  if (!config.devMailbox) throw notFound();
  const rows = await db
    .select({ id: schema.emails.id, to: schema.emails.to, subject: schema.emails.subject, kind: schema.emails.kind, provider: schema.emails.provider, error: schema.emails.error, createdAt: schema.emails.createdAt, text: schema.emails.text })
    .from(schema.emails)
    .orderBy(desc(schema.emails.createdAt))
    .limit(100);
  return json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});
