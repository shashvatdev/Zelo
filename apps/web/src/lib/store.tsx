"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import type { Activity, Attachment, CommentTarget, Graph, Status, Ticket } from "@/data/model";
import { api, ApiError, revalidate } from "./api";

/**
 * Board state: the product graph (from the server) plus what the user is looking at.
 *
 * Changes are optimistic: the reducer applies them at once, the same change is sent to the
 * server, and the server's board replaces the local one when the queue drains. On any error
 * the board is reloaded from the server, so the screen never drifts from the database.
 * Other people's changes arrive by polling a cheap version check (ETag / 304).
 */

export type Scope = "all" | string; // "all" or a release id
export type Selected = { kind: "product" | "module" | "release" | "feature" | "ticket" | "bug" | "person"; id: string } | null;

export type State = {
  graph: Graph;
  version: number;
  scope: Scope;
  personId: string | null;
  selected: Selected;
  /** Bumps whenever the view changes, so the canvas replays its build animation. */
  viewKey: number;
  sideOpen: boolean;
  meId: string;
  askOpen: boolean;
  notif: { readBefore: string; readIds: string[] } | null;
};

export type Action =
  | { type: "hydrate"; graph: Graph; version: number }
  | { type: "scope"; scope: Scope }
  | { type: "person"; personId: string | null }
  | { type: "select"; selected: Selected }
  | { type: "goto"; scope: Scope; selected: Selected }
  | { type: "ticketStatus"; id: string; status: Status }
  | { type: "ticketAssignee"; id: string; assigneeId: string | null }
  | { type: "addTicket"; featureId: string; title: string; id?: string }
  | { type: "addMiscTicket"; releaseId: string; title: string; id?: string }
  | { type: "bugStatus"; id: string; status: Status }
  | { type: "addComment"; target: CommentTarget; body: string; attachments: Attachment[]; id?: string }
  | { type: "deleteComment"; id: string }
  | { type: "me"; id: string }
  | { type: "ask"; open?: boolean }
  | { type: "notif"; value: { readBefore: string; readIds: string[] } }
  | { type: "notifRead"; ids: string[] }
  | { type: "notifReadAll" }
  | { type: "reset" }
  | { type: "side"; open?: boolean }
  | { type: "addFeature"; releaseId: string; name: string; moduleId: string; ownerId: string | null; spec: string; id?: string }
  | { type: "addRelease"; version: string; name: string; date: string; state: "current" | "planned" | "shipped"; id?: string }
  | { type: "addModule"; name: string; id?: string };

const SIDE_KEY = "zelo-sidebar";
const ASK_KEY = "zelo-ask";
const POLL_LIVE_MS = 60_000; // safety net while the live stream is up
const POLL_OFFLINE_MS = 10_000; // when it is down

const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();
/** Kept for older imports: timestamps are ISO (UTC) everywhere now. */
export const nowLocal = nowIso;
export const defaultBefore = () => new Date(Date.now() - 7 * 86400000).toISOString();

/** Temporary key shown until the server assigns the real one (PAY-104…). */
function tempKey(g: Graph, prefix: string) {
  const max = Math.max(100, ...[...g.tickets, ...g.features, ...g.bugs].map((x) => x.key).filter((k) => k.startsWith(prefix + "-")).map((k) => Number(k.split("-")[1]) || 0));
  return `${prefix}-${max + 1}`;
}

function logged(g: Graph, e: Omit<Activity, "id" | "at">): Graph {
  return { ...g, activity: [...g.activity, { id: newId(), at: nowIso(), ...e }] };
}

function addTicketTo(s: State, featureId: string, title: string, id: string, g = s.graph): State {
  const f = g.features.find((x) => x.id === featureId);
  if (!f || !title.trim()) return s;
  const ticket: Ticket = { id, key: tempKey(g, f.key.split("-")[0]), title: title.trim(), featureId: f.id, assigneeId: s.personId ?? s.meId, status: "todo", points: 2, createdAt: nowIso(), createdBy: s.meId };
  let next: Graph = { ...g, tickets: [...g.tickets, ticket] };
  next = logged(next, { target: { kind: "ticket", id }, actorId: s.meId, kind: "created" });
  if (ticket.assigneeId && ticket.assigneeId !== s.meId) next = logged(next, { target: { kind: "ticket", id }, actorId: s.meId, kind: "assignee", from: null, to: ticket.assigneeId });
  return { ...s, graph: next, viewKey: s.viewKey + 1 };
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "hydrate": {
      // Keep the view valid if the version on screen was removed by someone else.
      const scope = s.scope === "all" || a.graph.releases.some((r) => r.id === s.scope) ? s.scope : (a.graph.releases.find((r) => r.state === "current") ?? a.graph.releases[0])?.id ?? "all";
      return { ...s, graph: a.graph, version: a.version, scope, viewKey: scope !== s.scope ? s.viewKey + 1 : s.viewKey };
    }
    case "scope":
      return { ...s, scope: a.scope, selected: null, viewKey: s.viewKey + 1 };
    case "person":
      return { ...s, personId: a.personId, selected: null, viewKey: s.viewKey + 1 };
    case "select":
      return { ...s, selected: a.selected };
    case "goto":
      if (a.scope === s.scope && !s.personId) return { ...s, selected: a.selected };
      return { ...s, scope: a.scope, personId: null, selected: a.selected, viewKey: s.viewKey + 1 };
    case "ticketStatus": {
      const t = s.graph.tickets.find((x) => x.id === a.id);
      if (!t || t.status === a.status) return s;
      const g = { ...s.graph, tickets: s.graph.tickets.map((x) => (x.id === a.id ? { ...x, status: a.status } : x)) };
      return { ...s, graph: logged(g, { target: { kind: "ticket", id: t.id }, actorId: s.meId, kind: "status", from: t.status, to: a.status }) };
    }
    case "ticketAssignee": {
      const t = s.graph.tickets.find((x) => x.id === a.id);
      if (!t || t.assigneeId === a.assigneeId) return s;
      const g = { ...s.graph, tickets: s.graph.tickets.map((x) => (x.id === a.id ? { ...x, assigneeId: a.assigneeId } : x)) };
      return {
        ...s,
        graph: logged(g, { target: { kind: "ticket", id: t.id }, actorId: s.meId, kind: "assignee", from: t.assigneeId, to: a.assigneeId }),
        viewKey: s.personId ? s.viewKey + 1 : s.viewKey,
      };
    }
    case "addTicket":
      return addTicketTo(s, a.featureId, a.title, a.id ?? newId());
    case "addMiscTicket": {
      const misc = s.graph.modules.find((m) => m.misc);
      if (!misc || !a.title.trim()) return s;
      let g = s.graph;
      let bucket = g.features.find((f) => f.moduleId === misc.id && f.releaseId === a.releaseId);
      if (!bucket) {
        bucket = { id: newId(), key: tempKey(g, "MISC"), name: "Housekeeping", moduleId: misc.id, releaseId: a.releaseId, ownerId: s.meId, spec: "Work that doesn't belong to a feature.", createdAt: nowIso(), createdBy: s.meId };
        g = { ...g, features: [...g.features, bucket] };
      }
      return addTicketTo(s, bucket.id, a.title, a.id ?? newId(), g);
    }
    case "bugStatus": {
      const b = s.graph.bugs.find((x) => x.id === a.id);
      if (!b || b.status === a.status) return s;
      const g = { ...s.graph, bugs: s.graph.bugs.map((x) => (x.id === a.id ? { ...x, status: a.status } : x)) };
      return { ...s, graph: logged(g, { target: { kind: "bug", id: b.id }, actorId: s.meId, kind: "status", from: b.status, to: a.status }) };
    }
    case "addComment": {
      if (!a.body.trim() && !a.attachments.length) return s;
      const c = { id: a.id ?? newId(), target: a.target, authorId: s.meId, body: a.body.trim(), createdAt: nowIso(), attachments: a.attachments };
      return { ...s, graph: { ...s.graph, comments: [...s.graph.comments, c] } };
    }
    case "deleteComment":
      return { ...s, graph: { ...s.graph, comments: s.graph.comments.filter((c) => c.id !== a.id) } };
    case "me":
      return { ...s, meId: a.id };
    case "ask":
      return { ...s, askOpen: a.open ?? !s.askOpen };
    case "notif":
      return { ...s, notif: a.value };
    case "notifRead": {
      const cur = s.notif ?? { readBefore: defaultBefore(), readIds: [] };
      return { ...s, notif: { ...cur, readIds: [...new Set([...cur.readIds, ...a.ids])] } };
    }
    case "notifReadAll":
      return { ...s, notif: { readBefore: nowIso(), readIds: [] } };
    case "reset":
      return { ...s, selected: null, viewKey: s.viewKey + 1 };
    case "side":
      return { ...s, sideOpen: a.open ?? !s.sideOpen };
    case "addFeature": {
      if (!a.name.trim()) return s;
      const mod = s.graph.modules.find((m) => m.id === a.moduleId);
      const prefix = s.graph.features.find((f) => f.moduleId === a.moduleId)?.key.split("-")[0] ?? (mod?.name ?? "F").replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase();
      const f = { id: a.id ?? newId(), key: tempKey(s.graph, prefix), name: a.name.trim(), moduleId: a.moduleId, releaseId: a.releaseId, ownerId: a.ownerId, spec: a.spec.trim() || "No spec yet.", createdAt: nowIso(), createdBy: s.meId };
      const g = logged({ ...s.graph, features: [...s.graph.features, f] }, { target: { kind: "feature", id: f.id }, actorId: s.meId, kind: "created" });
      return { ...s, graph: g, selected: { kind: "feature", id: f.id }, viewKey: s.viewKey + 1 };
    }
    case "addRelease": {
      if (!a.version.trim()) return s;
      const r = { id: a.id ?? newId(), version: a.version.trim(), name: a.name.trim() || "Untitled", date: a.date, state: a.state };
      const releases = [...s.graph.releases.map((x) => (a.state === "current" && x.state === "current" ? { ...x, state: "shipped" as const } : x)), r];
      return { ...s, graph: { ...s.graph, releases }, scope: r.id, personId: null, selected: null, viewKey: s.viewKey + 1 };
    }
    case "addModule": {
      const name = a.name.trim();
      if (!name || s.graph.modules.some((m) => m.name.toLowerCase() === name.toLowerCase())) return s;
      const colors = ["#e5582b", "#3866c9", "#2f8f46", "#d48a1c", "#1f8a8a", "#b5401b", "#5a6fd6", "#8a6a3a"];
      const real = s.graph.modules.filter((m) => !m.misc);
      const m = { id: a.id ?? newId(), name, color: colors[real.length % colors.length] };
      return { ...s, graph: { ...s.graph, modules: [...real, m, ...s.graph.modules.filter((x) => x.misc)] }, viewKey: s.viewKey + 1 };
    }
  }
}

/** What the server needs for each board change (ids are shared so the optimistic row is the real row). */
function toServer(a: Action, s: State): Record<string, unknown> | null {
  switch (a.type) {
    case "ticketStatus":
    case "bugStatus":
      return { type: a.type, id: a.id, status: a.status };
    case "ticketAssignee":
      return { type: a.type, id: a.id, assigneeId: a.assigneeId };
    case "addTicket":
      return { type: a.type, id: a.id, featureId: a.featureId, title: a.title, assigneeId: s.personId ?? s.meId };
    case "addMiscTicket":
      return { type: a.type, id: a.id, releaseId: a.releaseId, title: a.title };
    case "addComment":
      return { type: a.type, id: a.id, target: a.target, body: a.body, attachmentIds: a.attachments.map((x) => x.id) };
    case "deleteComment":
      return { type: a.type, id: a.id };
    case "addFeature":
      return { type: a.type, id: a.id, releaseId: a.releaseId, moduleId: a.moduleId, name: a.name, ownerId: a.ownerId, spec: a.spec };
    case "addRelease":
      return { type: a.type, id: a.id, version: a.version, name: a.name, date: a.date, state: a.state };
    case "addModule":
      return { type: a.type, id: a.id, name: a.name };
    default:
      return null;
  }
}

const CREATES = new Set(["addTicket", "addMiscTicket", "addComment", "addFeature", "addRelease", "addModule"]);

type Ctx = { state: State; dispatch: (a: Action) => void; error: string | null; clearError: () => void; saving: boolean; savedAt: number | null; live: boolean; workspaceId: string; refresh: () => Promise<void> };
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children, workspaceId, initial, version, meId }: { children: ReactNode; workspaceId: string; initial: Graph; version: number; meId: string }) {
  const [state, raw] = useReducer(reducer, {
    graph: initial,
    version,
    scope: initial.releases.find((r) => r.state === "current")?.id ?? initial.releases[0]?.id ?? "all",
    personId: null,
    selected: null,
    viewKey: 0,
    sideOpen: true,
    meId,
    askOpen: false,
    notif: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [live, setLive] = useState(false);
  const missed = useRef(false);
  const queue = useRef(Promise.resolve());
  const inflight = useRef(0);
  const latest = useRef<{ graph: Graph; version: number } | null>(null);
  const failed = useRef(false);
  const etag = useRef<string | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const base = `/api/workspaces/${workspaceId}`;

  /** Reload the board if it changed on the server (cheap 304 when it didn't). */
  const refresh = useCallback(async () => {
    // Our own save is in flight: catch up right after it lands instead of fighting it.
    if (inflight.current) {
      missed.current = true;
      return;
    }
    const res = await fetch(`${base}/graph`, { headers: etag.current ? { "If-None-Match": etag.current } : {}, cache: "no-store" }).catch(() => null);
    if (!res || res.status === 304 || !res.ok || inflight.current) return;
    etag.current = res.headers.get("ETag");
    const data = (await res.json()) as { graph: Graph; version: number };
    raw({ type: "hydrate", graph: data.graph, version: data.version });
  }, [base]);

  const dispatch = useCallback(
    (a0: Action) => {
      const a = CREATES.has(a0.type) && !("id" in a0 && a0.id) ? ({ ...a0, id: newId() } as Action) : a0;
      const payload = toServer(a, stateRef.current);
      raw(a);
      if (a.type === "notifRead" || a.type === "notifReadAll") {
        void api(`${base}/notifications`, { method: "PUT", body: a.type === "notifReadAll" ? { all: true } : { readIds: a.ids } }).catch(() => {});
        return;
      }
      if (a.type === "reset") {
        void api(`${base}/reset`, { method: "POST" }).then(() => {
          etag.current = null;
          return refresh();
        });
        return;
      }
      if (!payload) return;
      inflight.current++;
      setSaving(true);
      queue.current = queue.current.then(async () => {
        try {
          latest.current = await api<{ graph: Graph; version: number }>(`${base}/actions`, { body: payload, keepalive: JSON.stringify(payload).length < 60_000 });
        } catch (e) {
          failed.current = true;
          setError(e instanceof ApiError ? e.message : "Couldn't save that change.");
        } finally {
          inflight.current--;
          if (inflight.current === 0) {
            setSaving(false);
            const done = latest.current;
            latest.current = null;
            etag.current = null;
            if (failed.current || !done || missed.current) {
              if (!failed.current && done) raw({ type: "hydrate", graph: done.graph, version: done.version });
              failed.current = false;
              missed.current = false;
              await refresh();
            } else {
              raw({ type: "hydrate", graph: done.graph, version: done.version });
              setSavedAt(Date.now());
            }
          }
        }
      });
    },
    [base, refresh],
  );

  // Don't let someone close or reload the tab while a change is still on its way.
  useEffect(() => {
    if (!saving) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saving]);

  // UI preferences (per device), notification read state (per person, from the server).
  useEffect(() => {
    try {
      if (localStorage.getItem(SIDE_KEY) === "closed") raw({ type: "side", open: false });
      if (localStorage.getItem(ASK_KEY) === "open" && window.innerWidth >= 1100) raw({ type: "ask", open: true });
    } catch {
      // storage blocked
    }
    void api<{ readBefore: string; readIds: string[] }>(`${base}/notifications`)
      .then((v) => raw({ type: "notif", value: v }))
      .catch(() => {});
  }, [base]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDE_KEY, state.sideOpen ? "open" : "closed");
      localStorage.setItem(ASK_KEY, state.askOpen ? "open" : "closed");
    } catch {
      // not saved
    }
  }, [state.sideOpen, state.askOpen]);

  useEffect(() => {
    raw({ type: "me", id: meId });
  }, [meId]);

  // Live updates: a server-sent event stream says what changed; we fetch it right away.
  // We manage reconnects ourselves: after drops, server restarts or HTTP errors.
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let reopen: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 80); // fold bursts of changes into one fetch
    };
    const open = () => {
      if (stopped) return;
      es = new EventSource(`${base}/events`);
      es.addEventListener("ready", (e) => {
        attempt = 0;
        setLive(true);
        const v = Number(JSON.parse((e as MessageEvent).data).v);
        if (v > stateRef.current.version) soon(); // missed something while disconnected
      });
      es.addEventListener("board", (e) => {
        const v = Number(JSON.parse((e as MessageEvent).data).v);
        if (v > stateRef.current.version) soon();
      });
      es.addEventListener("team", () => {
        void revalidate(`/api/workspaces/${workspaceId}`);
        void revalidate("/api/auth/me");
      });
      // Any drop: close and reopen on our own schedule (the browser's built-in retry backs off unpredictably).
      const down = () => {
        setLive(false);
        es?.close();
        es = null;
        clearTimeout(reopen);
        reopen = setTimeout(open, Math.min(5_000, 1000 * (1 + attempt++))); // 1s, 2s, 3s… capped at 5s
      };
      es.addEventListener("error", down);
      es.addEventListener("bye", () => {
        // the server is restarting: reconnect (to whichever instance is up) after a short pause
        es?.close();
        es = null;
        setLive(false);
        clearTimeout(reopen);
        reopen = setTimeout(open, 500);
      });
    };
    open();
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(reopen);
      es?.close();
      setLive(false);
    };
  }, [base, refresh, workspaceId]);

  // Safety net: poll (cheap 304s) — slowly while live, faster if the stream is down; and on tab focus.
  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && void refresh();
    const id = setInterval(tick, live ? POLL_LIVE_MS : POLL_OFFLINE_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [refresh, live]);

  const value = useMemo(() => ({ state, dispatch, error, clearError: () => setError(null), saving, savedAt, live, workspaceId, refresh }), [state, dispatch, error, saving, savedAt, live, workspaceId, refresh]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const v = useContext(StoreCtx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}
