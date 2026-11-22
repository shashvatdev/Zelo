import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Graph } from "@/data/model";
import { db, schema, type Tx } from "./db";

/** The product's whole board in the shape the canvas uses. Loaded with parallel indexed queries. */

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : new Date(0).toISOString());
const ROLE_LABEL = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" } as const;

export async function productOf(workspaceId: string) {
  const [p] = await db.select().from(schema.products).where(eq(schema.products.workspaceId, workspaceId)).orderBy(asc(schema.products.createdAt)).limit(1);
  return p ?? null;
}

export async function loadGraph(workspaceId: string, productId: string): Promise<{ graph: Graph; version: number }> {
  const P = productId;
  const [[product], people, modules, releases, features, tickets, bugs, comments, files, activity] = await Promise.all([
    db.select().from(schema.products).where(eq(schema.products.id, P)),
    db
      .select({ id: schema.users.id, name: schema.users.name, title: schema.members.title, role: schema.members.role, color: schema.members.color })
      .from(schema.members)
      .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
      .where(eq(schema.members.workspaceId, workspaceId))
      .orderBy(asc(schema.members.joinedAt), sql`case when ${schema.members.role} = 'owner' then 0 else 1 end`, asc(schema.users.name)),
    db.select().from(schema.modules).where(eq(schema.modules.productId, P)).orderBy(asc(schema.modules.isMisc), asc(schema.modules.position), asc(schema.modules.createdAt)),
    db.select().from(schema.releases).where(eq(schema.releases.productId, P)).orderBy(asc(schema.releases.targetDate)),
    db.select().from(schema.features).where(eq(schema.features.productId, P)).orderBy(asc(schema.features.createdAt)),
    db.select().from(schema.tickets).where(eq(schema.tickets.productId, P)).orderBy(asc(schema.tickets.createdAt)),
    db.select().from(schema.bugs).where(eq(schema.bugs.productId, P)).orderBy(asc(schema.bugs.createdAt)),
    db.select().from(schema.comments).where(eq(schema.comments.productId, P)).orderBy(asc(schema.comments.createdAt)),
    db
      .select({ id: schema.attachments.id, commentId: schema.attachments.commentId, name: schema.attachments.name, mime: schema.attachments.mime, size: schema.attachments.size })
      .from(schema.attachments)
      .innerJoin(schema.comments, eq(schema.comments.id, schema.attachments.commentId))
      .where(eq(schema.comments.productId, P)),
    db.select().from(schema.activity).where(eq(schema.activity.productId, P)).orderBy(asc(schema.activity.at)),
  ]);
  if (!product) throw new Error("product missing");

  const filesBy = new Map<string, { id: string; name: string; type: string; size: number }[]>();
  for (const f of files) {
    const list = filesBy.get(f.commentId!) ?? [];
    list.push({ id: f.id, name: f.name, type: f.mime, size: f.size });
    filesBy.set(f.commentId!, list);
  }

  const graph: Graph = {
    product: { id: product.id, name: product.name },
    people: people.map((p) => ({ id: p.id, name: p.name, role: p.title || ROLE_LABEL[p.role], color: p.color })),
    modules: modules.map((m) => ({ id: m.id, name: m.name, color: m.color, misc: m.isMisc || undefined })),
    releases: releases.map((r) => ({ id: r.id, version: r.version, name: r.name, date: r.targetDate, state: r.state })),
    features: features.map((f) => ({
      id: f.id,
      key: f.key,
      name: f.name,
      moduleId: f.moduleId,
      releaseId: f.releaseId,
      ownerId: f.ownerId,
      extendsId: f.extendsId ?? undefined,
      spec: f.spec,
      createdAt: iso(f.createdAt),
      createdBy: f.createdBy,
    })),
    tickets: tickets.map((t) => ({ id: t.id, key: t.key, title: t.title, featureId: t.featureId, assigneeId: t.assigneeId, status: t.status, points: t.points, createdAt: iso(t.createdAt), createdBy: t.createdBy })),
    bugs: bugs.map((b) => ({
      id: b.id,
      key: b.key,
      title: b.title,
      moduleId: b.moduleId,
      releaseId: b.releaseId,
      assigneeId: b.assigneeId,
      status: b.status,
      severity: b.severity,
      introducedIn: b.introducedIn ?? undefined,
      createdAt: iso(b.createdAt),
      createdBy: b.createdBy,
    })),
    comments: comments.map((c) => ({ id: c.id, target: { kind: c.targetKind, id: c.targetId }, authorId: c.authorId ?? "", body: c.body, createdAt: iso(c.createdAt), attachments: filesBy.get(c.id) ?? [] })),
    activity: activity.map((a) => ({ id: a.id, target: { kind: a.targetKind, id: a.targetId }, actorId: a.actorId, at: iso(a.at), kind: a.kind, from: a.fromValue, to: a.toValue })),
  };
  return { graph, version: product.version };
}

/** Atomically takes the next number for a key prefix: PAY-101, PAY-102… (safe under concurrency). */
export async function nextKey(tx: Tx, productId: string, prefix: string) {
  const res = await tx.execute<{ last: number }>(sql`
    insert into key_counters (product_id, prefix, last) values (${productId}, ${prefix}, 101)
    on conflict (product_id, prefix) do update set last = key_counters.last + 1
    returning last`);
  return `${prefix}-${res.rows[0].last}`;
}

export async function bumpVersion(tx: Tx, productId: string) {
  await tx.update(schema.products).set({ version: sql`${schema.products.version} + 1` }).where(eq(schema.products.id, productId));
}

/** A short, unique key prefix for a module name: Payments → PAY, Auth → AUTH, App UI → AUI. */
export async function prefixFor(tx: Tx, productId: string, name: string) {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  const first = words[0] ?? "MOD";
  let base = words.length > 1 ? words.map((w) => w[0]).join("").slice(0, 4) : first.length <= 4 ? first : first.slice(0, 3);
  if (base.length < 2) base = `${base}X`;
  const taken = new Set((await tx.select({ p: schema.modules.keyPrefix }).from(schema.modules).where(eq(schema.modules.productId, productId))).map((r) => r.p));
  let p = base;
  for (let i = 2; taken.has(p); i++) p = `${base}${i}`;
  return p;
}

export async function memberIds(workspaceId: string, ids: (string | null | undefined)[], tx: Tx | typeof db = db) {
  const want = [...new Set(ids.filter(Boolean) as string[])];
  if (!want.length) return new Set<string>();
  const rows = await tx
    .select({ id: schema.members.userId })
    .from(schema.members)
    .where(and(eq(schema.members.workspaceId, workspaceId), inArray(schema.members.userId, want)));
  return new Set(rows.map((r) => r.id));
}
