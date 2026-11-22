import { and, eq, isNull } from "drizzle-orm";
import { requireUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { HttpError, json, notFound, route } from "@/server/http";
import { isMember } from "@/server/session";
import { deleteObject, getObject } from "@/server/storage";

type Ctx = RouteContext<"/api/files/[fileId]">;

async function load(fileId: string) {
  if (!/^[0-9a-f-]{36}$/.test(fileId)) throw notFound();
  const [f] = await db.select().from(schema.attachments).where(eq(schema.attachments.id, fileId));
  if (!f) throw notFound("File not found.");
  return f;
}

/** Streams a file to members of its workspace only. Images inline, everything else as a download. */
export const GET = route(async (req, ctx: Ctx) => {
  const { fileId } = await ctx.params;
  const user = await requireUser();
  const f = await load(fileId);
  if (!(await isMember(user.id, f.workspaceId))) throw notFound("File not found.");
  if (!f.commentId && f.uploaderId !== user.id) throw notFound("File not found.");
  const bytes = await getObject(f.storageKey).catch(() => {
    throw new HttpError(410, "The file is no longer stored.", "gone");
  });
  const inline = f.mime.startsWith("image/") && new URL(req.url).searchParams.get("download") !== "1";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": f.mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
});

/** Removes an upload that hasn't been posted yet (the composer's ×). */
export const DELETE = route(async (_req, ctx: Ctx) => {
  const { fileId } = await ctx.params;
  const user = await requireUser();
  const f = await load(fileId);
  const r = await db.delete(schema.attachments).where(and(eq(schema.attachments.id, f.id), eq(schema.attachments.uploaderId, user.id), isNull(schema.attachments.commentId))).returning();
  if (!r.length) throw notFound("Only your unposted uploads can be removed here.");
  await deleteObject(f.storageKey);
  return json({ ok: true });
});
