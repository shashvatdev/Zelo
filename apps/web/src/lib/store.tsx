"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from "react";
import type {
  Activity,
  Attachment,
  CommentTarget,
  Graph,
  Status,
  Ticket,
} from "@/data/model";

/**
 * App state: the work graph plus what the user is looking at.
 * The graph is saved in the browser for this demo; swap the load/save effects for an API to go live.
 */

export type Scope = "all" | string; // "all" or a release id
export type Selected = {
  kind:
    "product" | "module" | "release" | "feature" | "ticket" | "bug" | "person";
  id: string;
} | null;

export type State = {
  graph: Graph;
  scope: Scope;
  personId: string | null;
  selected: Selected;
  /** Bumps whenever the view changes, so the canvas replays its build animation. */
  viewKey: number;
  sideOpen: boolean;
  /** Who is using the app. Demo only: there is no sign-in yet. */
  meId: string;
  askOpen: boolean;
  /** Per person: notifications they opened, and "everything before this time is read". */
  notifRead: Record<string, { ids: string[]; before: string }>;
  /** Set once in the browser: default cut-off for "unread" (never read the clock during prerender). */
  unreadSince: string | null;
  /** What "Reset" goes back to: the sample data, or the freshly onboarded product. */
  initial: Graph;
};

export type Action =
  | { type: "hydrate"; graph: Graph }
  | { type: "scope"; scope: Scope }
  | { type: "person"; personId: string | null }
  | { type: "select"; selected: Selected }
  | { type: "goto"; scope: Scope; selected: Selected }
  | { type: "ticketStatus"; id: string; status: Status }
  | { type: "ticketAssignee"; id: string; assigneeId: string | null }
  | { type: "addTicket"; featureId: string; title: string }
  | { type: "addMiscTicket"; releaseId: string; title: string }
  | { type: "bugStatus"; id: string; status: Status }
  | {
      type: "addComment";
      target: CommentTarget;
      body: string;
      attachments: Attachment[];
    }
  | { type: "deleteComment"; id: string }
  | { type: "me"; id: string }
  | { type: "ask"; open?: boolean }
  | { type: "notifRead"; ids: string[] }
  | { type: "notifReadAll" }
  | { type: "notifHydrate"; value: State["notifRead"] }
  | { type: "unreadSince"; at: string }
  | { type: "reset" }
  | { type: "side"; open?: boolean }
  | { type: "addFeature"; releaseId: string; name: string; moduleId: string; ownerId: string | null; spec: string }
  | { type: "addRelease"; version: string; name: string; date: string; state: "current" | "planned" | "shipped" }
  | { type: "addModule"; name: string }
  | { type: "syncPeople"; people: Graph["people"] };

const SIDE_KEY = "zelo-sidebar";
const ASK_KEY = "zelo-ask";
const NOTIF_KEY = "zelo-notif-read";

const uid = (p: string) =>
  `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Next free number for a key prefix like PAY or MISC. */
function nextKey(g: Graph, prefix: string) {
  const max = Math.max(
    100,
    ...[
      ...g.tickets.map((t) => t.key),
      ...g.features.map((x) => x.key),
      ...g.bugs.map((b) => b.key),
    ]
      .filter((k) => k.startsWith(prefix + "-"))
      .map((k) => Number(k.split("-")[1]) || 0),
  );
  return `${prefix}-${max + 1}`;
}

/** Local wall-clock time as an ISO string without a zone, matching the stored dates. */
export function nowLocal() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19);
}

/** Appends an automatic log entry (shown in the task's thread). */
function logged(g: Graph, e: Omit<Activity, "id" | "at">): Graph {
  return {
    ...g,
    activity: [...g.activity, { id: uid("a"), at: nowLocal(), ...e }],
  };
}

function addTicketTo(
  s: State,
  featureId: string,
  title: string,
  g = s.graph,
): State {
  const f = g.features.find((x) => x.id === featureId);
  if (!f || !title.trim()) return s;
  const ticket: Ticket = {
    id: uid(f.id),
    key: nextKey(g, f.key.split("-")[0]),
    title: title.trim(),
    featureId: f.id,
    assigneeId: s.personId ?? s.meId,
    status: "todo",
    points: 2,
    createdAt: nowLocal(),
    createdBy: s.meId,
  };
  let next: Graph = { ...g, tickets: [...g.tickets, ticket] };
  next = logged(next, {
    target: { kind: "ticket", id: ticket.id },
    actorId: s.meId,
    kind: "created",
  });
  if (ticket.assigneeId && ticket.assigneeId !== s.meId)
    next = logged(next, {
      target: { kind: "ticket", id: ticket.id },
      actorId: s.meId,
      kind: "assignee",
      from: null,
      to: ticket.assigneeId,
    });
  return { ...s, graph: next, viewKey: s.viewKey + 1 };
}

/** Fresh users start with last week's notifications unread; older ones count as already seen. */
export function defaultBefore() {
  const d = new Date(Date.now() - 7 * 86400000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19);
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "hydrate": {
      // Keep anyone who joined since this board was saved (people sync can land before the load).
      const extra = s.graph.people.filter((p) => !a.graph.people.some((x) => x.id === p.id));
      return { ...s, graph: { ...a.graph, people: [...a.graph.people, ...extra] } };
    }
    case "scope":
      return { ...s, scope: a.scope, selected: null, viewKey: s.viewKey + 1 };
    case "person":
      return {
        ...s,
        personId: a.personId,
        selected: null,
        viewKey: s.viewKey + 1,
      };
    case "select":
      return { ...s, selected: a.selected };
    case "goto":
      // Same tree already on screen: just select (the camera flies there). Otherwise build the new view.
      if (a.scope === s.scope && !s.personId)
        return { ...s, selected: a.selected };
      return {
        ...s,
        scope: a.scope,
        personId: null,
        selected: a.selected,
        viewKey: s.viewKey + 1,
      };
    case "ticketStatus": {
      const t = s.graph.tickets.find((x) => x.id === a.id);
      if (!t || t.status === a.status) return s;
      const g = {
        ...s.graph,
        tickets: s.graph.tickets.map((x) =>
          x.id === a.id ? { ...x, status: a.status } : x,
        ),
      };
      return {
        ...s,
        graph: logged(g, {
          target: { kind: "ticket", id: t.id },
          actorId: s.meId,
          kind: "status",
          from: t.status,
          to: a.status,
        }),
      };
    }
    case "ticketAssignee": {
      const t = s.graph.tickets.find((x) => x.id === a.id);
      if (!t || t.assigneeId === a.assigneeId) return s;
      const g = {
        ...s.graph,
        tickets: s.graph.tickets.map((x) =>
          x.id === a.id ? { ...x, assigneeId: a.assigneeId } : x,
        ),
      };
      return {
        ...s,
        graph: logged(g, {
          target: { kind: "ticket", id: t.id },
          actorId: s.meId,
          kind: "assignee",
          from: t.assigneeId,
          to: a.assigneeId,
        }),
        viewKey: s.personId ? s.viewKey + 1 : s.viewKey,
      };
    }
    case "addTicket":
      return addTicketTo(s, a.featureId, a.title);
    case "addMiscTicket": {
      // Misc work goes into the release's catch-all bucket, created on first use.
      const misc = s.graph.modules.find((m) => m.misc);
      if (!misc || !a.title.trim()) return s;
      let g = s.graph;
      let bucket = g.features.find(
        (f) => f.moduleId === misc.id && f.releaseId === a.releaseId,
      );
      if (!bucket) {
        const prev = [...g.features]
          .filter((f) => f.moduleId === misc.id)
          .sort((x, y) => {
            const rx = g.releases.find((r) => r.id === x.releaseId)!.date;
            const ry = g.releases.find((r) => r.id === y.releaseId)!.date;
            return rx.localeCompare(ry);
          })
          .filter(
            (f) =>
              g.releases.find((r) => r.id === f.releaseId)!.date <
              g.releases.find((r) => r.id === a.releaseId)!.date,
          )
          .pop();
        bucket = {
          id: uid("f-misc"),
          key: nextKey(g, "MISC"),
          name: "Housekeeping",
          moduleId: misc.id,
          releaseId: a.releaseId,
          ownerId: s.meId,
          extendsId: prev?.id,
          spec: "Work that doesn't belong to a feature: ops, admin and chores for this release.",
          createdAt: nowLocal(),
          createdBy: s.meId,
        };
        g = { ...g, features: [...g.features, bucket] };
      }
      return addTicketTo(s, bucket.id, a.title, g);
    }
    case "bugStatus": {
      const b = s.graph.bugs.find((x) => x.id === a.id);
      if (!b || b.status === a.status) return s;
      const g = {
        ...s.graph,
        bugs: s.graph.bugs.map((x) =>
          x.id === a.id ? { ...x, status: a.status } : x,
        ),
      };
      return {
        ...s,
        graph: logged(g, {
          target: { kind: "bug", id: b.id },
          actorId: s.meId,
          kind: "status",
          from: b.status,
          to: a.status,
        }),
      };
    }
    case "addComment": {
      if (!a.body.trim() && !a.attachments.length) return s;
      const c = {
        id: uid("c"),
        target: a.target,
        authorId: s.meId,
        body: a.body.trim(),
        createdAt: nowLocal(),
        attachments: a.attachments,
      };
      return {
        ...s,
        graph: { ...s.graph, comments: [...s.graph.comments, c] },
      };
    }
    case "deleteComment":
      return {
        ...s,
        graph: {
          ...s.graph,
          comments: s.graph.comments.filter((c) => c.id !== a.id),
        },
      };
    case "me":
      return { ...s, meId: a.id };
    case "ask":
      return { ...s, askOpen: a.open ?? !s.askOpen };
    case "notifRead": {
      const cur = s.notifRead[s.meId] ?? { ids: [], before: defaultBefore() };
      return {
        ...s,
        notifRead: {
          ...s.notifRead,
          [s.meId]: { ...cur, ids: [...new Set([...cur.ids, ...a.ids])] },
        },
      };
    }
    case "notifReadAll":
      return {
        ...s,
        notifRead: {
          ...s.notifRead,
          [s.meId]: { ids: [], before: nowLocal() },
        },
      };
    case "notifHydrate":
      return { ...s, notifRead: a.value };
    case "unreadSince":
      return { ...s, unreadSince: a.at };
    case "reset":
      return { ...s, graph: s.initial, selected: null, viewKey: s.viewKey + 1 };
    case "addFeature": {
      if (!a.name.trim()) return s;
      const mod = s.graph.modules.find((m) => m.id === a.moduleId);
      const prefix = (mod?.name ?? "FEAT").replace(/[^a-z]/gi, "").slice(0, 4).toUpperCase() || "FEAT";
      // The newest earlier version of a same-named feature in this module is what it builds on.
      const rel = s.graph.releases.find((r) => r.id === a.releaseId);
      const prev = s.graph.features
        .filter((f) => f.moduleId === a.moduleId && f.name.toLowerCase() === a.name.trim().toLowerCase())
        .filter((f) => (s.graph.releases.find((r) => r.id === f.releaseId)?.date ?? "") < (rel?.date ?? ""))
        .pop();
      const f = {
        id: uid("f"),
        key: nextKey(s.graph, prefix),
        name: a.name.trim(),
        moduleId: a.moduleId,
        releaseId: a.releaseId,
        ownerId: a.ownerId,
        extendsId: prev?.id,
        spec: a.spec.trim() || "No spec yet.",
        createdAt: nowLocal(),
        createdBy: s.meId,
      };
      const g = logged({ ...s.graph, features: [...s.graph.features, f] }, { target: { kind: "feature", id: f.id }, actorId: s.meId, kind: "created" });
      return { ...s, graph: g, selected: { kind: "feature", id: f.id }, viewKey: s.viewKey + 1 };
    }
    case "addRelease": {
      if (!a.version.trim()) return s;
      const r = { id: uid("r"), version: a.version.trim(), name: a.name.trim() || "Untitled", date: a.date, state: a.state };
      const releases = [...s.graph.releases.map((x) => (a.state === "current" && x.state === "current" ? { ...x, state: "shipped" as const } : x)), r];
      return { ...s, graph: { ...s.graph, releases }, scope: r.id, personId: null, selected: null, viewKey: s.viewKey + 1 };
    }
    case "addModule": {
      const name = a.name.trim();
      if (!name || s.graph.modules.some((m) => m.name.toLowerCase() === name.toLowerCase())) return s;
      const colors = ["#e5582b", "#3866c9", "#2f8f46", "#d48a1c", "#1f8a8a", "#b5401b", "#5a6fd6", "#8a6a3a"];
      const real = s.graph.modules.filter((m) => !m.misc);
      const m = { id: uid("m"), name, color: colors[real.length % colors.length] };
      const misc = s.graph.modules.filter((x) => x.misc);
      return { ...s, graph: { ...s.graph, modules: [...real, m, ...misc] }, viewKey: s.viewKey + 1 };
    }
    case "syncPeople": {
      const cur = s.graph.people;
      const next = [...cur.map((p) => a.people.find((x) => x.id === p.id) ?? p), ...a.people.filter((p) => !cur.some((c) => c.id === p.id))];
      if (JSON.stringify(next) === JSON.stringify(cur)) return s;
      return { ...s, graph: { ...s.graph, people: next } };
    }
    case "side":
      return { ...s, sideOpen: a.open ?? !s.sideOpen };
  }
}

const Ctx = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(
  null,
);

export function StoreProvider({ children, storageKey, initial, meId }: { children: ReactNode; storageKey: string; initial: Graph; meId: string }) {
  const [state, dispatch] = useReducer(reducer, {
    graph: initial,
    scope: initial.releases.find((r) => r.state === "current")?.id ?? initial.releases[0]?.id ?? "all",
    personId: null,
    selected: null,
    viewKey: 0,
    sideOpen: true,
    meId,
    askOpen: false,
    notifRead: {},
    unreadSince: null,
    initial,
  });
  const loaded = useRef(false);

  // Load this workspace's saved board once, after the first render.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const g = JSON.parse(raw) as Graph;
        dispatch({ type: "hydrate", graph: { ...g, comments: g.comments ?? [], activity: g.activity ?? [] } });
      }
      if (localStorage.getItem(SIDE_KEY) === "closed") dispatch({ type: "side", open: false });
      if (localStorage.getItem(ASK_KEY) === "open" && window.innerWidth >= 1100) dispatch({ type: "ask", open: true });
      dispatch({ type: "unreadSince", at: defaultBefore() });
      const nr = localStorage.getItem(`${NOTIF_KEY}-${storageKey}`);
      if (nr) dispatch({ type: "notifHydrate", value: JSON.parse(nr) });
    } catch {
      // Storage blocked or bad data: keep the initial board.
    }
    loaded.current = true;
  }, [storageKey]);

  // The signed-in person is "me" (switching accounts re-renders with a new id).
  useEffect(() => {
    dispatch({ type: "me", id: meId });
  }, [meId]);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state.graph));
    } catch {
      // Storage full or blocked: changes stay in memory only.
    }
  }, [state.graph, storageKey]);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(SIDE_KEY, state.sideOpen ? "open" : "closed");
      localStorage.setItem(ASK_KEY, state.askOpen ? "open" : "closed");
      localStorage.setItem(`${NOTIF_KEY}-${storageKey}`, JSON.stringify(state.notifRead));
    } catch {
      // Not saved; defaults come back next time.
    }
  }, [state.sideOpen, state.askOpen, state.notifRead, storageKey]);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}
