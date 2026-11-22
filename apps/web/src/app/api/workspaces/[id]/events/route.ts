import { productOf } from "@/server/graph";
import { shuttingDown, subscribe, trackStream, type ZeloEvent } from "@/server/realtime";
import { HttpError, route } from "@/server/http";
import { wsAccess } from "@/server/session";

/**
 * Live updates as Server-Sent Events. Each message only says *what* changed (board version or
 * team); the browser then fetches the data through the normal, access-checked endpoints.
 * A heartbeat every 25s keeps proxies from closing the stream; browsers reconnect on their own.
 */
export const GET = route(async (req, ctx: RouteContext<"/api/workspaces/[id]/events">) => {
  const { id } = await ctx.params;
  await wsAccess(id);
  if (shuttingDown()) throw new HttpError(503, "Restarting, try again in a moment.", "unavailable");
  const product = await productOf(id);
  const enc = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };
      const unsubscribe = await subscribe(id, (e: ZeloEvent) => send(e.t, e));
      const beat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 25_000);
      let untrack = () => {};
      cleanup = () => {
        clearInterval(beat);
        unsubscribe();
        untrack();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener("abort", () => cleanup());
      untrack = trackStream(() => {
        try {
          controller.enqueue(enc.encode(`event: bye\ndata: {}\n\n`)); // "server restarting, reconnect"
        } catch {
          // already closed
        }
        cleanup();
      });
      // Tell the client where we are, so it can catch up on anything it missed while disconnected.
      controller.enqueue(enc.encode(`retry: 3000\n\n`));
      send("ready", { w: id, v: product?.version ?? 0 });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
