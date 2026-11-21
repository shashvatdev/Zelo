import type { CommentTarget, Graph } from "@/data/model";

/**
 * Notifications are derived from the log and the comments, so they can never drift from what
 * actually happened. For one person they are:
 *  - assigned: someone else assigned them a task
 *  - mention:  someone else tagged them with @ in a comment
 *  - comment:  someone else commented on a task assigned to them (and did not tag them)
 */

export type Notif = {
  id: string;
  kind: "assigned" | "mention" | "comment";
  actorId: string | null;
  at: string;
  target: CommentTarget;
  title: string;
  key: string;
  releaseId: string;
  preview?: string;
};

function describe(g: Graph, t: CommentTarget) {
  if (t.kind === "ticket") {
    const x = g.tickets.find((v) => v.id === t.id);
    const f = x && g.features.find((v) => v.id === x.featureId);
    return x && f
      ? {
          title: x.title,
          key: x.key,
          releaseId: f.releaseId,
          assigneeId: x.assigneeId,
        }
      : undefined;
  }
  if (t.kind === "bug") {
    const b = g.bugs.find((v) => v.id === t.id);
    return b
      ? {
          title: b.title,
          key: b.key,
          releaseId: b.releaseId,
          assigneeId: b.assigneeId,
        }
      : undefined;
  }
  const f = g.features.find((v) => v.id === t.id);
  return f
    ? {
        title: f.name,
        key: f.key,
        releaseId: f.releaseId,
        assigneeId: f.ownerId,
      }
    : undefined;
}

export function buildNotifications(g: Graph, meId: string): Notif[] {
  const me = g.people.find((p) => p.id === meId);
  if (!me) return [];
  const out: Notif[] = [];

  for (const a of g.activity) {
    if (a.kind !== "assignee" || a.to !== meId || a.actorId === meId) continue;
    const d = describe(g, a.target);
    if (d)
      out.push({
        id: `n-${a.id}`,
        kind: "assigned",
        actorId: a.actorId,
        at: a.at,
        target: a.target,
        title: d.title,
        key: d.key,
        releaseId: d.releaseId,
      });
  }

  for (const c of g.comments) {
    if (c.authorId === meId) continue;
    const d = describe(g, c.target);
    if (!d) continue;
    const mentioned = c.body.includes(`@${me.name}`);
    const mine = d.assigneeId === meId;
    if (!mentioned && !mine) continue;
    const preview =
      c.body ||
      (c.attachments.length
        ? `Attached ${c.attachments.length} file${c.attachments.length === 1 ? "" : "s"}`
        : "");
    out.push({
      id: `n-${c.id}`,
      kind: mentioned ? "mention" : "comment",
      actorId: c.authorId,
      at: c.createdAt,
      target: c.target,
      title: d.title,
      key: d.key,
      releaseId: d.releaseId,
      preview,
    });
  }

  return out.sort((x, y) => y.at.localeCompare(x.at));
}
