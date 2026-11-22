import { z } from "zod";
import { acquireSlot, checkLimits, listConversations, runAsk, type AskEvent } from "@/server/ai/agent";
import { body, HttpError, json, route } from "@/server/http";
import { wsAccess } from "@/server/session";

/** Your Ask Zelo chats in this workspace, newest first. */
export const GET = route(async (_req, ctx: RouteContext<"/api/workspaces/[id]/ask">) => {
  const { id } = await ctx.params;
  const { user } = await wsAccess(id);
  const list = await listConversations(user.id, id);
  return json({ conversations: list.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString() })) });
});

const Ask = z.object({
  conversationId: z.uuid().nullable().optional(),
  message: z.string().trim().min(1, "Ask something.").max(4000, "Keep it under 4,000 characters."),
  view: z
    .object({
      scope: z.string().max(64).default("all"),
      selected: z.object({ kind: z.string().max(20), id: z.string().max(64) }).nullable().default(null),
      personId: z.string().max(64).nullable().default(null),
    })
    .default({ scope: "all", selected: null, personId: null }),
});

/**
 * Ask a question. The answer streams back as Server-Sent Events:
 * meta (conversation id) → status (what it's looking up) → delta (answer text) → done (saved message).
 * `reset` means: clear the text streamed so far (a retry or a tool call followed).
 */
export const POST = route(async (req, ctx: RouteContext<"/api/workspaces/[id]/ask">) => {
  const { id } = await ctx.params;
  const { user, role, workspace } = await wsAccess(id);
  const input = await body(req, Ask);
  await checkLimits(user.id, id, workspace.plan);
  const release = acquireSlot(user.id);

  const enc = new TextEncoder();
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: string, data: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          open = false;
        }
      };
      try {
        await runAsk({
          workspaceId: id,
          plan: workspace.plan,
          user: { id: user.id, name: user.name, email: user.email },
          role,
          conversationId: input.conversationId,
          message: input.message,
          view: input.view,
          signal: abort.signal,
          emit: (e: AskEvent) => {
            const { type, ...data } = e;
            send(type, data);
          },
        });
      } catch (e) {
        if (!abort.signal.aborted) {
          if (!(e instanceof HttpError)) console.error("[ask]", e);
          // Only our own HttpErrors carry a message meant for people; never forward upstream/DB text.
          const msg = e instanceof HttpError ? e.message : "Something went wrong on our side. Please try again.";
          send("error", { message: msg });
        }
      } finally {
        release();
        open = false;
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
});
