import { asc, eq, sql, type SQL } from "drizzle-orm";
import { db, schema } from "../db";

/**
 * Ask Zelo's view of a board, built to stay fast on very large products.
 *
 * Small tables (releases, modules, members) are loaded whole per question. Everything that grows
 * without bound (tickets, bugs, features, comments, activity) is only ever read through indexed,
 * filtered, LIMITed SQL. The board summary for the prompt is a handful of aggregates, cached per
 * product version, so an unchanged board costs one version lookup.
 */

export type Rel = { id: string; version: string; name: string; date: string; state: "shipped" | "current" | "planned" };
export type Mod = { id: string; name: string; misc: boolean; prefix: string };
export type Person = { id: string; name: string; role: string };
export type Dims = {
  product: { id: string; name: string; version: number };
  releases: Rel[];
  modules: Mod[];
  people: Person[];
  /** Every key prefix on this board (PAY, AUTH…), for spotting made-up keys. */
  prefixes: Set<string>;
};

const ROLE_LABEL = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" } as const;

export async function loadDims(workspaceId: string, productId: string): Promise<Dims> {
  const [[product], releases, modules, people] = await Promise.all([
    db.select({ id: schema.products.id, name: schema.products.name, version: schema.products.version }).from(schema.products).where(eq(schema.products.id, productId)),
    db.select().from(schema.releases).where(eq(schema.releases.productId, productId)).orderBy(asc(schema.releases.targetDate)),
    db.select().from(schema.modules).where(eq(schema.modules.productId, productId)).orderBy(asc(schema.modules.isMisc), asc(schema.modules.position)),
    db
      .select({ id: schema.users.id, name: schema.users.name, title: schema.members.title, role: schema.members.role })
      .from(schema.members)
      .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
      .where(eq(schema.members.workspaceId, workspaceId))
      .orderBy(asc(schema.members.joinedAt)),
  ]);
  if (!product) throw new Error("product missing");
  const mods = modules.map((m) => ({ id: m.id, name: m.name, misc: m.isMisc, prefix: m.keyPrefix }));
  return {
    product,
    releases: releases.map((r) => ({ id: r.id, version: r.version, name: r.name, date: r.targetDate, state: r.state })),
    modules: mods,
    people: people.map((p) => ({ id: p.id, name: p.name, role: p.title || ROLE_LABEL[p.role] })),
    prefixes: new Set(mods.map((m) => m.prefix.toUpperCase())),
  };
}

/* ---------- raw SQL helpers ---------- */

export async function rows<T>(q: SQL): Promise<T[]> {
  return (await db.execute(q)).rows as T[];
}
export const and_ = (parts: (SQL | false | null | undefined | "" | 0)[]) => {
  const p = parts.filter(Boolean) as SQL[];
  return p.length ? sql.join(p, sql` and `) : sql`true`;
};
/** A timestamp as "YYYY-MM-DD HH:MM" (UTC), straight from Postgres. */
export const stampOf = (col: SQL) => sql`to_char(${col} at time zone 'UTC', 'YYYY-MM-DD HH24:MI')`;

/* ---------- board summary (cached per product version) ---------- */

export type Summary = {
  totals: { features: number; tickets: number; openTickets: number; openUnassigned: number; bugs: number; openBugs: number };
  releases: Record<string, { features: number; tickets: number; done: number; openBugs: number; critical: number }>;
  modules: Record<string, { features: number; openBugs: number }>;
  openByPerson: Record<string, number>;
};

const cache = new Map<string, { at: number; s: Summary }>();
const CACHE_MAX = 300;

export async function summary(productId: string, version: number): Promise<Summary> {
  const key = `${productId}:${version}`;
  const hit = cache.get(key);
  if (hit) return hit.s;
  const P = productId;
  const [totals, rel, relBugs, mod, people] = await Promise.all([
    rows<Summary["totals"]>(sql`
      select
        (select count(*)::int from features where product_id = ${P}) as features,
        (select count(*)::int from tickets where product_id = ${P}) as tickets,
        (select count(*)::int from tickets where product_id = ${P} and status <> 'done') as "openTickets",
        (select count(*)::int from tickets where product_id = ${P} and status <> 'done' and assignee_id is null) as "openUnassigned",
        (select count(*)::int from bugs where product_id = ${P}) as bugs,
        (select count(*)::int from bugs where product_id = ${P} and status <> 'done') as "openBugs"`),
    rows<{ id: string; features: number; tickets: number; done: number }>(sql`
      select f.release_id as id, count(distinct f.id)::int as features, count(t.id)::int as tickets,
             count(t.id) filter (where t.status = 'done')::int as done
      from features f left join tickets t on t.feature_id = f.id
      where f.product_id = ${P} group by f.release_id`),
    rows<{ id: string; open: number; critical: number }>(sql`
      select release_id as id, count(*)::int as open, count(*) filter (where severity = 'critical')::int as critical
      from bugs where product_id = ${P} and status <> 'done' group by release_id`),
    rows<{ id: string; features: number; open: number }>(sql`
      select m.id, (select count(*)::int from features f where f.module_id = m.id) as features,
             (select count(*)::int from bugs b where b.module_id = m.id and b.status <> 'done') as open
      from modules m where m.product_id = ${P}`),
    rows<{ id: string; n: number }>(sql`
      select assignee_id as id, count(*)::int as n from tickets
      where product_id = ${P} and status <> 'done' and assignee_id is not null group by assignee_id`),
  ]);
  const s: Summary = {
    totals: totals[0],
    releases: {},
    modules: Object.fromEntries(mod.map((m) => [m.id, { features: m.features, openBugs: m.open }])),
    openByPerson: Object.fromEntries(people.map((p) => [p.id, p.n])),
  };
  for (const r of rel) s.releases[r.id] = { features: r.features, tickets: r.tickets, done: r.done, openBugs: 0, critical: 0 };
  for (const b of relBugs) {
    s.releases[b.id] ??= { features: 0, tickets: 0, done: 0, openBugs: 0, critical: 0 };
    s.releases[b.id].openBugs = b.open;
    s.releases[b.id].critical = b.critical;
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), s });
  return s;
}

/* ---------- items ---------- */

export type TicketRow = {
  id: string;
  key: string;
  title: string;
  status: "todo" | "dev" | "qa" | "done";
  points: number;
  assigneeId: string | null;
  createdAt: string;
  createdBy: string | null;
  featureId: string;
  featureKey: string;
  featureName: string;
  moduleId: string;
  releaseId: string;
};
export type BugRow = {
  id: string;
  key: string;
  title: string;
  status: "todo" | "dev" | "qa" | "done";
  severity: "critical" | "high" | "medium" | "low";
  assigneeId: string | null;
  moduleId: string;
  releaseId: string;
  introducedIn: string | null;
  createdAt: string;
  createdBy: string | null;
};
export type FeatureRow = {
  id: string;
  key: string;
  name: string;
  moduleId: string;
  releaseId: string;
  ownerId: string | null;
  extendsId: string | null;
  spec: string;
  createdAt: string;
  createdBy: string | null;
  done: number;
  total: number;
  extendsKey: string | null;
};

export const TICKET_COLS = sql`t.id, t.key, t.title, t.status, t.points, t.assignee_id as "assigneeId", ${stampOf(sql`t.created_at`)} as "createdAt",
  t.created_by as "createdBy", f.id as "featureId", f.key as "featureKey", f.name as "featureName", f.module_id as "moduleId", f.release_id as "releaseId"`;
export const BUG_COLS = sql`b.id, b.key, b.title, b.status, b.severity, b.assignee_id as "assigneeId", b.module_id as "moduleId", b.release_id as "releaseId",
  b.introduced_in as "introducedIn", ${stampOf(sql`b.created_at`)} as "createdAt", b.created_by as "createdBy"`;
/** `spec` is cut to 3,000 characters in SQL so a huge spec never crosses the wire. */
export const FEATURE_COLS = sql`f.id, f.key, f.name, f.module_id as "moduleId", f.release_id as "releaseId", f.owner_id as "ownerId", f.extends_id as "extendsId",
  left(f.spec, 3000) as spec, ${stampOf(sql`f.created_at`)} as "createdAt", f.created_by as "createdBy",
  (select count(*)::int from tickets x where x.feature_id = f.id and x.status = 'done') as done,
  (select count(*)::int from tickets x where x.feature_id = f.id) as total,
  (select p.key from features p where p.id = f.extends_id) as "extendsKey"`;

export type Item = { kind: "ticket"; v: TicketRow } | { kind: "bug"; v: BugRow } | { kind: "feature"; v: FeatureRow };

/** Items by exact key (case-insensitive), in one round trip per kind. */
export async function itemsByKeys(productId: string, keys: string[]): Promise<Map<string, Item>> {
  // Keys are only letters, digits and hyphens; anything else can't be a key (and can't break the array literal).
  const K = [...new Set(keys.map((k) => k.trim().toUpperCase()))].filter((k) => /^[A-Z0-9][A-Z0-9-]{0,30}$/.test(k)).slice(0, 200);
  const out = new Map<string, Item>();
  if (!K.length) return out;
  const arr = sql`${`{${K.join(",")}}`}::text[]`;
  const [ts, bs, fs] = await Promise.all([
    rows<TicketRow>(sql`select ${TICKET_COLS} from tickets t join features f on f.id = t.feature_id where t.product_id = ${productId} and upper(t.key) = any(${arr})`),
    rows<BugRow>(sql`select ${BUG_COLS} from bugs b where b.product_id = ${productId} and upper(b.key) = any(${arr})`),
    rows<FeatureRow>(sql`select ${FEATURE_COLS} from features f where f.product_id = ${productId} and upper(f.key) = any(${arr})`),
  ]);
  for (const v of ts) out.set(v.key.toUpperCase(), { kind: "ticket", v });
  for (const v of bs) out.set(v.key.toUpperCase(), { kind: "bug", v });
  for (const v of fs) out.set(v.key.toUpperCase(), { kind: "feature", v });
  return out;
}

/** Items whose title/name equals the text exactly (case-insensitive). At most 6 per kind. */
export async function itemsByTitle(productId: string, text: string, kinds: Item["kind"][]): Promise<Item[]> {
  const t = text.trim().toLowerCase();
  const [ts, bs, fs] = await Promise.all([
    kinds.includes("ticket") ? rows<TicketRow>(sql`select ${TICKET_COLS} from tickets t join features f on f.id = t.feature_id where t.product_id = ${productId} and lower(t.title) = ${t} limit 6`) : [],
    kinds.includes("bug") ? rows<BugRow>(sql`select ${BUG_COLS} from bugs b where b.product_id = ${productId} and lower(b.title) = ${t} limit 6`) : [],
    kinds.includes("feature") ? rows<FeatureRow>(sql`select ${FEATURE_COLS} from features f where f.product_id = ${productId} and lower(f.name) = ${t} limit 6`) : [],
  ]);
  return [...ts.map((v) => ({ kind: "ticket" as const, v })), ...bs.map((v) => ({ kind: "bug" as const, v })), ...fs.map((v) => ({ kind: "feature" as const, v }))];
}

/** Item by id (for the "currently open" item in the prompt). */
export async function itemById(productId: string, kind: string, id: string): Promise<Item | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (kind === "ticket") {
    const [v] = await rows<TicketRow>(sql`select ${TICKET_COLS} from tickets t join features f on f.id = t.feature_id where t.product_id = ${productId} and t.id = ${id}`);
    return v ? { kind, v } : null;
  }
  if (kind === "bug") {
    const [v] = await rows<BugRow>(sql`select ${BUG_COLS} from bugs b where b.product_id = ${productId} and b.id = ${id}`);
    return v ? { kind, v } : null;
  }
  if (kind === "feature") {
    const [v] = await rows<FeatureRow>(sql`select ${FEATURE_COLS} from features f where f.product_id = ${productId} and f.id = ${id}`);
    return v ? { kind, v } : null;
  }
  return null;
}

/* ---------- search ---------- */

export type Hit = { kind: "ticket" | "bug" | "feature" | "comment"; key: string; title: string; where: string; rank: number };

/** Words → a prefix tsquery ("refu pay" → refu:* & pay:*). Only letters/digits survive, so input can't break the query. */
function tsq(query: string, op: "&" | "|") {
  const words = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1)
    .slice(0, 8);
  return words.length ? words.map((w) => `${w}:*`).join(` ${op} `) : null;
}

export async function searchBoard(productId: string, query: string, kinds: Hit["kind"][], limit = 15): Promise<Hit[]> {
  const run = async (q: string) => {
    const tq = sql`to_tsquery('simple', ${q})`;
    const parts: SQL[] = [];
    if (kinds.includes("ticket")) parts.push(sql`(select 'ticket' as kind, t.key, t.title, 'title' as "where", ts_rank(t.search, ${tq}) as rank from tickets t where t.product_id = ${productId} and t.search @@ ${tq} order by rank desc limit ${limit})`);
    if (kinds.includes("bug")) parts.push(sql`(select 'bug' as kind, b.key, b.title, 'title' as "where", ts_rank(b.search, ${tq}) as rank from bugs b where b.product_id = ${productId} and b.search @@ ${tq} order by rank desc limit ${limit})`);
    if (kinds.includes("feature")) parts.push(sql`(select 'feature' as kind, f.key, f.name as title, 'name or spec' as "where", ts_rank(f.search, ${tq}) + 0.05 as rank from features f where f.product_id = ${productId} and f.search @@ ${tq} order by rank desc limit ${limit})`);
    if (kinds.includes("comment"))
      parts.push(sql`(select 'comment' as kind, coalesce(t.key, b.key, f.key) as key, left(c.body, 140) as title, 'comment by ' || coalesce(u.name, 'someone') || ' on ' || to_char(c.created_at, 'YYYY-MM-DD') as "where", ts_rank(c.search, ${tq}) - 0.01 as rank
        from comments c
        left join tickets t on c.target_kind = 'ticket' and t.id = c.target_id
        left join bugs b on c.target_kind = 'bug' and b.id = c.target_id
        left join features f on c.target_kind = 'feature' and f.id = c.target_id
        left join users u on u.id = c.author_id
        where c.product_id = ${productId} and c.search @@ ${tq} order by rank desc limit ${limit})`);
    if (!parts.length) return [];
    return rows<Hit>(sql`select * from (${sql.join(parts, sql` union all `)}) h order by rank desc limit ${limit}`);
  };
  const all = tsq(query, "&");
  if (!all) return [];
  const strict = await run(all);
  if (strict.length >= 3) return strict.filter((h) => h.key);
  // Few exact hits: widen to any word, keep the strict ones first.
  const any = await run(tsq(query, "|")!);
  const seen = new Set(strict.map((h) => `${h.kind}${h.key}${h.title}`));
  return [...strict, ...any.filter((h) => !seen.has(`${h.kind}${h.key}${h.title}`))].filter((h) => h.key).slice(0, limit);
}
