import { eq } from "drizzle-orm";
import { conversationMessages, ownConversation } from "@/server/ai/agent";
import { db, schema } from "@/server/db";
import { json, route, zUuid } from "@/server/http";
import { wsAccess } from "@/server/session";

/** One chat with every message, its cards and the current state of each proposed change. */
export const GET = route(async (_req, ctx: RouteContext<"/api/workspaces/[id]/ask/[conversationId]">) => {
  const { id, conversationId } = await ctx.params;
  const { user } = await wsAccess(id);
  const c = await ownConversation(zUuid.parse(conversationId), user.id, id);
  return json({ conversation: { id: c.id, title: c.title }, messages: await conversationMessages(c.id) });
});

export const DELETE = route(async (_req, ctx: RouteContext<"/api/workspaces/[id]/ask/[conversationId]">) => {
  const { id, conversationId } = await ctx.params;
  const { user } = await wsAccess(id);
  const c = await ownConversation(zUuid.parse(conversationId), user.id, id);
  await db.delete(schema.aiConversations).where(eq(schema.aiConversations.id, c.id));
  return json({ ok: true });
});
