import { loadGraph, productOf } from "@/server/graph";
import { json, notFound, route } from "@/server/http";
import { wsAccess } from "@/server/session";

/**
 * The whole board. Clients poll with If-None-Match: a cheap version check answers 304
 * when nothing changed, so idle boards cost one indexed lookup per poll.
 */
export const GET = route(async (req, ctx: RouteContext<"/api/workspaces/[id]/graph">) => {
  const { id } = await ctx.params;
  await wsAccess(id);
  const product = await productOf(id);
  if (!product) throw notFound("This workspace has no product yet.");
  const etag = `"p${product.id.slice(0, 8)}-v${product.version}"`;
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": "no-store" } });
  const { graph, version } = await loadGraph(id, product.id);
  return json({ graph, version }, { headers: { ETag: `"p${product.id.slice(0, 8)}-v${version}"` } });
});
