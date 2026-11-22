import { Client } from "pg";

/**
 * One LISTEN connection per server process, fanned out to that process's open event streams.
 * Postgres delivers each NOTIFY to every listening process, so this works across many instances
 * with no extra infrastructure. Reconnects with backoff if the connection drops.
 */

export type ZeloEvent = { w: string; t: "board" | "team"; v?: number };
type Sub = (e: ZeloEvent) => void;

type Hub = { subs: Map<string, Set<Sub>>; client: Client | null; connecting: Promise<void> | null; retry: number; streams: Set<() => void>; closing: boolean };
const g = globalThis as unknown as { __zeloHub?: Hub };
const hub: Hub = g.__zeloHub ?? (g.__zeloHub = { subs: new Map(), client: null, connecting: null, retry: 0, streams: new Set(), closing: false });

/**
 * On shutdown (deploys, restarts) close every open stream right away. Otherwise a graceful
 * shutdown waits forever on these never-ending responses, and browsers stay on the old server.
 * Browsers reconnect by themselves to whichever instance is up.
 */
function closeAllStreams() {
  hub.closing = true;
  for (const close of [...hub.streams]) close();
  void hub.client?.end().catch(() => {});
}
const gp = globalThis as unknown as { __zeloShutdownHook?: boolean };
if (!gp.__zeloShutdownHook && typeof process !== "undefined" && process.once) {
  gp.__zeloShutdownHook = true;
  process.once("SIGTERM", closeAllStreams);
  process.once("SIGINT", closeAllStreams);
}

/** Track an open stream so shutdown can close it. Returns the untrack function. */
export function trackStream(close: () => void) {
  hub.streams.add(close);
  return () => hub.streams.delete(close);
}
export const shuttingDown = () => hub.closing;

function dispatch(payload: string) {
  let e: ZeloEvent;
  try {
    e = JSON.parse(payload) as ZeloEvent;
  } catch {
    return;
  }
  hub.subs.get(e.w)?.forEach((fn) => {
    try {
      fn(e);
    } catch {
      // a broken stream must not stop the others
    }
  });
}

async function connect() {
  if (hub.client || hub.connecting) return hub.connecting ?? undefined;
  hub.connecting = (async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL, application_name: "zelo-realtime" });
    client.on("notification", (n) => n.channel === "zelo_events" && n.payload && dispatch(n.payload));
    const reconnect = () => {
      if (hub.client !== client || hub.closing) return;
      hub.client = null;
      const wait = Math.min(30_000, 500 * 2 ** hub.retry++);
      setTimeout(() => void connect().catch(() => {}), wait);
    };
    client.on("error", (err) => {
      console.error("[realtime] listener error", err.message);
      reconnect();
    });
    client.on("end", reconnect);
    await client.connect();
    await client.query("LISTEN zelo_events");
    hub.client = client;
    hub.retry = 0;
  })().finally(() => {
    hub.connecting = null;
  });
  return hub.connecting;
}

/** Subscribe to one workspace's events. Returns the unsubscribe function. */
export async function subscribe(workspaceId: string, fn: Sub) {
  await connect();
  const set = hub.subs.get(workspaceId) ?? new Set<Sub>();
  set.add(fn);
  hub.subs.set(workspaceId, set);
  return () => {
    set.delete(fn);
    if (!set.size) hub.subs.delete(workspaceId);
  };
}

export const listening = () => !!hub.client;
