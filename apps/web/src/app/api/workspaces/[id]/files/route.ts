import { config } from "@/server/config";
import { db, schema } from "@/server/db";
import { bad, HttpError, json, route } from "@/server/http";
import { wsAccess } from "@/server/session";
import { allowedMime, putObject } from "@/server/storage";

/** Upload one file for a comment. It stays "pending" until a comment claims it. */
export const POST = route(async (req, ctx: RouteContext<"/api/workspaces/[id]/files">) => {
  const { id } = await ctx.params;
  const { user } = await wsAccess(id);
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > config.maxUploadBytes + 64 * 1024) throw new HttpError(413, "Files can be up to 10 MB.", "too_large");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw bad("Send the file as multipart form data.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw bad("No file in the upload.");
  if (file.size === 0) throw bad("That file is empty.");
  if (file.size > config.maxUploadBytes) throw new HttpError(413, "Files can be up to 10 MB.", "too_large");
  const mime = file.type || "application/octet-stream";
  if (!allowedMime(mime)) throw new HttpError(415, "That file type isn't allowed. Use images, PDFs, Office files, text or zip.", "bad_type");
  const name = (file.name || "file").replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 160);
  const key = await putObject(Buffer.from(await file.arrayBuffer()));
  const [row] = await db.insert(schema.attachments).values({ workspaceId: id, uploaderId: user.id, name, mime, size: file.size, storageKey: key }).returning();
  return json({ id: row.id, name: row.name, type: row.mime, size: row.size }, { status: 201 });
});
