import { Action, runAction } from "@/server/actions";
import { loadGraph, productOf } from "@/server/graph";
import { body, json, notFound, route } from "@/server/http";
import { wsAccess } from "@/server/session";

/** Apply one change to the board, then return the fresh board so the client can reconcile. */
export const POST = route(async (req, ctx: RouteContext<"/api/workspaces/[id]/actions">) => {
  const { id } = await ctx.params;
  const { user, role } = await wsAccess(id);
  const action = await body(req, Action);
  const product = await productOf(id);
  if (!product) throw notFound("This workspace has no product yet.");
  await runAction(id, product.id, user.id, role, action);
  const { graph, version } = await loadGraph(id, product.id);
  return json({ graph, version }, { headers: { ETag: `"p${product.id.slice(0, 8)}-v${version}"` } });
});
