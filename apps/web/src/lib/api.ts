"use client";

import { useEffect, useSyncExternalStore } from "react";

/** Error returned by the API: a message safe to show, plus status, code and the field it's about. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public field?: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData; headers?: Record<string, string>; keepalive?: boolean } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
      headers: opts.form ? opts.headers : { "Content-Type": "application/json", ...opts.headers },
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      credentials: "same-origin",
      cache: "no-store",
      // Lets a save finish even if the page is reloaded or closed mid-request (small JSON bodies only).
      keepalive: opts.keepalive,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.", "network");
  }
  if (res.status === 204 || res.status === 304) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string; field?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status}).`, data.code, data.field);
  return data as T;
}

/* ---------- a tiny cached query store (one fetch per key, shared by every component) ---------- */

type Entry<T> = { data?: T; error?: ApiError; loading: boolean; promise?: Promise<void> };
const cache = new Map<string, Entry<unknown>>();
const subs = new Map<string, Set<() => void>>();
const notify = (key: string) => subs.get(key)?.forEach((f) => f());

export function revalidate(key: string) {
  const e = cache.get(key);
  if (e) e.promise = undefined;
  return load(key, true);
}

export function setQueryData<T>(key: string, data: T) {
  cache.set(key, { data, loading: false });
  notify(key);
}

export function clearQueries() {
  cache.clear();
  for (const k of subs.keys()) notify(k);
}

function load(key: string, force = false): Promise<void> {
  const cur = (cache.get(key) ?? { loading: true }) as Entry<unknown>;
  if (cur.promise && !force) return cur.promise;
  const promise = api(key)
    .then((data) => {
      cache.set(key, { data, loading: false });
    })
    .catch((error: ApiError) => {
      cache.set(key, { data: undefined, error, loading: false });
    })
    .finally(() => notify(key));
  cache.set(key, { ...cur, loading: !cur.data, promise });
  notify(key);
  return promise;
}

const EMPTY: Entry<unknown> = { loading: true };

/** Data for a GET endpoint. `null` key = don't fetch yet. Returns undefined while on the server. */
export function useQuery<T>(key: string | null) {
  const snap = useSyncExternalStore(
    (cb) => {
      if (!key) return () => {};
      const set = subs.get(key) ?? new Set();
      set.add(cb);
      subs.set(key, set);
      return () => set.delete(cb);
    },
    () => (key ? (cache.get(key) ?? EMPTY) : EMPTY),
    () => EMPTY,
  ) as Entry<T>;
  useEffect(() => {
    if (key && !cache.get(key)?.promise) void load(key);
  }, [key]);
  return { data: snap.data, error: snap.error, loading: !!key && snap.loading && !snap.data && !snap.error, reload: () => (key ? revalidate(key) : Promise.resolve()) };
}
