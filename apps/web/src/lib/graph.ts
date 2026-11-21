import type { Bug, Feature, Graph, Release, Ticket } from "@/data/model";

/** Rollups: everything a parent shows is computed from its children, never stored by hand. */

export type Progress = {
  done: number;
  total: number;
  points: number;
  donePoints: number;
};

export const progressOf = (tickets: Ticket[]): Progress => ({
  done: tickets.filter((t) => t.status === "done").length,
  total: tickets.length,
  points: tickets.reduce((s, t) => s + t.points, 0),
  donePoints: tickets
    .filter((t) => t.status === "done")
    .reduce((s, t) => s + t.points, 0),
});

export const pct = (p: Progress) =>
  p.total ? Math.round((p.done / p.total) * 100) : 0;

export function ticketsOf(
  g: Graph,
  featureId: string,
  personId?: string | null,
) {
  return g.tickets.filter(
    (t) =>
      t.featureId === featureId && (!personId || t.assigneeId === personId),
  );
}

export function featuresIn(g: Graph, releaseId: string) {
  const order = g.modules.map((m) => m.id);
  return g.features
    .filter((f) => f.releaseId === releaseId)
    .sort((a, b) => order.indexOf(a.moduleId) - order.indexOf(b.moduleId));
}

export function bugsIn(g: Graph, releaseId: string, personId?: string | null) {
  return g.bugs.filter(
    (b) =>
      b.releaseId === releaseId && (!personId || b.assigneeId === personId),
  );
}

export function releaseTickets(
  g: Graph,
  releaseId: string,
  personId?: string | null,
) {
  const ids = new Set(featuresIn(g, releaseId).map((f) => f.id));
  return g.tickets.filter(
    (t) => ids.has(t.featureId) && (!personId || t.assigneeId === personId),
  );
}

export function releaseProgress(
  g: Graph,
  releaseId: string,
  personId?: string | null,
) {
  return progressOf(releaseTickets(g, releaseId, personId));
}

/** A person's work: tickets assigned to them, in one release or across all of them. */
export function personTickets(g: Graph, personId: string, releaseId?: string) {
  const inRelease = releaseId
    ? new Set(featuresIn(g, releaseId).map((f) => f.id))
    : null;
  return g.tickets.filter(
    (t) =>
      t.assigneeId === personId && (!inRelease || inRelease.has(t.featureId)),
  );
}

/** Features a person touches: they own it or have at least one ticket in it. */
export function featuresForPerson(
  g: Graph,
  personId: string,
  releaseId?: string,
) {
  const list = releaseId ? featuresIn(g, releaseId) : g.features;
  return list.filter(
    (f) =>
      f.ownerId === personId ||
      g.tickets.some((t) => t.featureId === f.id && t.assigneeId === personId),
  );
}

export const openBugs = (bugs: Bug[]) =>
  bugs.filter((b) => b.status !== "done");

export const byId = <T extends { id: string }>(
  list: T[],
  id: string | null | undefined,
) => (id ? list.find((x) => x.id === id) : undefined);

export const releaseLabel = (r: Release) => `${r.version} · ${r.name}`;

export const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** The chain of versions a feature belongs to: everything it extends, and everything that extends it. */
export function lineage(g: Graph, f: Feature): Feature[] {
  const back: Feature[] = [];
  let cur: Feature | undefined = f;
  while (cur?.extendsId) {
    cur = g.features.find((x) => x.id === cur!.extendsId);
    if (cur) back.unshift(cur);
  }
  const forward = g.features.filter((x) => x.extendsId === f.id);
  return [...back, f, ...forward];
}

/** Full date and time, e.g. "18 Nov 2026, 10:24". Dates matter here, so we never shorten them away. */
export const fmtStamp = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
};

/** "3 days ago" style hint, for tooltips next to a full date. */
export const fmtAgo = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  const days = Math.round(mins / 60 / 24);
  return days < 45
    ? `${days} day${days === 1 ? "" : "s"} ago`
    : `${Math.round(days / 30)} months ago`;
};
