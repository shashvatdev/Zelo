import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { STATUS_LABEL, type Status } from "@/data/model";
import { Action } from "../actions";
import { atLeast, type Role } from "../auth";
import { db, schema } from "../db";
import type { AiCard } from "../db/schema";
import { and_, BUG_COLS, FEATURE_COLS, itemsByKeys, itemsByTitle, rows, searchBoard, stampOf, TICKET_COLS, type BugRow, type Dims, type FeatureRow, type Item, type TicketRow } from "./board";
import type { ToolDef } from "./groq";

/**
 * Everything Ask Zelo can see and do. The model never writes SQL: it calls these typed tools,
 * each scoped to one product/workspace and checked against the caller's role.
 *
 * Built for large boards: every read is an indexed, filtered, LIMITed query that returns exact
 * counts alongside a bounded list, so cost doesn't grow with the size of the board.
 *
 * Write tools never change anything: they resolve every name to a real row, validate the change
 * with the same schema the UI uses, and return a proposal that the person must confirm.
 *
 * Never reachable from here: sessions, password resets, auth attempts, emails, key counters,
 * password/token hashes and card numbers.
 */

export type Proposal = {
  id: string;
  action: Action;
  expect: { kind: "ticket" | "bug"; id: string; field: "status" | "assigneeId"; value: string | null } | null;
  title: string;
  lines: string[];
  card: AiCard | null;
};

export type ToolCtx = {
  dims: Dims;
  workspaceId: string;
  productId: string;
  user: { id: string; name: string; email: string };
  role: Role;
  plan: string;
  proposals: Proposal[];
  /** The release the person is looking at ("all" or a release id). */
  scope: string;
};

type Tool = { def: ToolDef; write?: boolean; viewerOk?: boolean; run: (args: unknown, c: ToolCtx) => Promise<unknown> | unknown };

/** A problem the model should read and act on (usually by asking the person). */
class ToolError extends Error {}
const fail = (msg: string): never => {
  throw new ToolError(msg);
};

/* ---------- names ---------- */

const lc = (s: string) => s.trim().toLowerCase();
const STATUS_WORD: Record<Status, string> = { todo: "To do", dev: "In dev", qa: "In QA", done: "Done" };
const SEV_ORDER = ["critical", "high", "medium", "low"] as const;
const SEV_SQL = (col: SQL) => sql`case ${col} when 'critical' then 0 when 'high' then 1 when 'medium' then 2 else 3 end`;
const STATUS_SQL = (col: SQL) => sql`case ${col} when 'dev' then 0 when 'qa' then 1 when 'todo' then 2 else 3 end`;
/** A validated enum list as a Postgres array literal (values come from zod enums only). */
const enumArr = (vals: readonly string[]) => sql`${`{${vals.join(",")}}`}::text[]`;

const personName = (c: ToolCtx, id: string | null | undefined) => (id ? (c.dims.people.find((p) => p.id === id)?.name ?? "Former member") : "Unassigned");
const relOf = (c: ToolCtx, id: string | null | undefined) => c.dims.releases.find((r) => r.id === id);
const modName = (c: ToolCtx, id: string) => c.dims.modules.find((m) => m.id === id)?.name ?? "?";

function findRelease(c: ToolCtx, ref: string | undefined) {
  const rels = c.dims.releases;
  if (!ref) {
    const r = (c.scope !== "all" && rels.find((x) => x.id === c.scope)) || rels.find((x) => x.state === "current");
    return r ?? fail("No release given and there is no current release.");
  }
  const q = lc(ref).replace(/^version\s+/, "");
  if (["current", "latest", "this release", "current release"].includes(q)) return rels.find((r) => r.state === "current") ?? fail("There is no current release.");
  const bare = (v: string) => lc(v).replace(/^v/, "");
  const hits = rels.filter((r) => bare(r.version) === bare(q) || lc(r.name) === q);
  if (hits.length === 1) return hits[0];
  const loose = rels.filter((r) => lc(r.name).includes(q));
  if (loose.length === 1) return loose[0];
  const list = rels.length > 40 ? `${rels.slice(-40).map((r) => r.version).join(", ")} (latest 40 of ${rels.length})` : rels.map((r) => `${r.version} (${r.name})`).join(", ");
  return fail(`No release matches "${ref}". Releases: ${list || "none"}.`);
}

function findModule(c: ToolCtx, ref: string) {
  const q = lc(ref);
  const mods = c.dims.modules;
  const exact = mods.filter((m) => lc(m.name) === q);
  if (exact.length === 1) return exact[0];
  const loose = mods.filter((m) => lc(m.name).includes(q));
  if (loose.length === 1) return loose[0];
  return fail(`${loose.length > 1 ? `"${ref}" matches several modules` : `No module matches "${ref}"`}. Modules: ${mods.map((m) => m.name).join(", ")}.`);
}

function findPerson(c: ToolCtx, ref: string) {
  const people = c.dims.people;
  const q = lc(ref);
  if (["me", "myself", "i", "mujhe", "main", "mera", "mere", "self"].includes(q)) return people.find((p) => p.id === c.user.id) ?? fail("You are not on this team's member list.");
  const exact = people.filter((p) => lc(p.name) === q);
  if (exact.length === 1) return exact[0];
  const first = people.filter((p) => lc(p.name).split(/\s+/)[0] === q);
  if (first.length === 1) return first[0];
  const loose = people.filter((p) => lc(p.name).includes(q));
  if (loose.length === 1) return loose[0];
  const many = first.length > 1 ? first : loose;
  if (many.length > 1) return fail(`"${ref}" could be ${many.slice(0, 8).map((p) => p.name).join(" or ")}. Ask which one.`);
  const team = people.length > 30 ? `${people.length} members; ask for the full name` : people.map((p) => p.name).join(", ");
  return fail(`Nobody called "${ref}" is on this team. Team: ${team}.`);
}

async function findItem(c: ToolCtx, ref: string, only: Item["kind"][] = ["ticket", "bug", "feature"]): Promise<Item> {
  const byKey = (await itemsByKeys(c.productId, [ref])).get(ref.trim().toUpperCase());
  if (byKey && only.includes(byKey.kind)) return byKey;
  const byTitle = await itemsByTitle(c.productId, ref, only);
  if (byTitle.length === 1) return byTitle[0];
  if (byTitle.length > 1) return fail(`"${ref}" matches several items: ${byTitle.map((i) => i.v.key).join(", ")}. Ask which one.`);
  const near = await searchBoard(c.productId, ref, only, 5);
  return fail(`No ${only.length === 3 ? "item" : only.join("/")} with key or exact title "${ref}".${near.length ? ` Closest: ${near.map((h) => `${h.key} "${h.title}"`).join(", ")}.` : ""} Use search, or ask the person which one they mean.`);
}

/* ---------- rows the model reads, and cards the person clicks ---------- */

const ticketRow = (c: ToolCtx, t: TicketRow) => ({
  key: t.key,
  title: t.title,
  status: STATUS_WORD[t.status],
  assignee: personName(c, t.assigneeId),
  points: t.points,
  feature: `${t.featureKey} ${t.featureName}`,
  module: modName(c, t.moduleId),
  release: relOf(c, t.releaseId)?.version,
});
const bugRow = (c: ToolCtx, b: BugRow) => ({
  key: b.key,
  title: b.title,
  severity: b.severity,
  status: STATUS_WORD[b.status],
  assignee: personName(c, b.assigneeId),
  module: modName(c, b.moduleId),
  release: relOf(c, b.releaseId)?.version,
  introducedIn: b.introducedIn ? relOf(c, b.introducedIn)?.version : undefined,
});
const featureRow = (c: ToolCtx, f: FeatureRow) => ({
  key: f.key,
  name: f.name,
  module: modName(c, f.moduleId),
  release: relOf(c, f.releaseId)?.version,
  owner: personName(c, f.ownerId),
  progress: `${f.done}/${f.total} tickets done (${f.total ? Math.round((f.done / f.total) * 100) : 0}%)`,
  buildsOn: f.extendsKey ?? undefined,
});

/* Compact one-line forms for lists: a fraction of the JSON size, so 60 rows stay well inside the budget. */
const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const TICKET_FMT = "key · title · status · assignee · feature · module · release";
const BUG_FMT = "key · title · severity · status · assignee · module · release";
const FEATURE_FMT = "key · name · module · release · owner · tickets done/total · builds on";
const ticketLine = (c: ToolCtx, t: TicketRow) => `${t.key} · ${cut(t.title, 90)} · ${STATUS_WORD[t.status]} · ${personName(c, t.assigneeId)} · ${t.featureKey} · ${modName(c, t.moduleId)} · ${relOf(c, t.releaseId)?.version ?? "?"}`;
const bugLine = (c: ToolCtx, b: BugRow) => `${b.key} · ${cut(b.title, 90)} · ${b.severity} · ${STATUS_WORD[b.status]} · ${personName(c, b.assigneeId)} · ${modName(c, b.moduleId)} · ${relOf(c, b.releaseId)?.version ?? "?"}`;
const featureLine = (c: ToolCtx, f: FeatureRow) => `${f.key} · ${cut(f.name, 80)} · ${modName(c, f.moduleId)} · ${relOf(c, f.releaseId)?.version ?? "?"} · ${personName(c, f.ownerId)} · ${f.done}/${f.total}${f.extendsKey ? ` · ${f.extendsKey}` : " · new"}`;

/** The clickable card for an item, built from its database row (never from model text). */
export function cardOf(dims: Dims, it: Item): AiCard {
  const first = (id: string | null) => (id ? (dims.people.find((p) => p.id === id)?.name.split(" ")[0] ?? "Former member") : "Unassigned");
  const rel = (id: string) => dims.releases.find((r) => r.id === id)?.version ?? "";
  if (it.kind === "ticket") {
    const t = it.v;
    return {
      label: t.title,
      sub: `${t.key} · ${t.featureName} · ${STATUS_LABEL[t.status]} · ${first(t.assigneeId)}`,
      tone: t.status === "done" ? "ok" : !t.assigneeId ? "bad" : t.status === "todo" ? "muted" : "warn",
      go: { scope: t.releaseId, selected: { kind: "ticket", id: t.id } },
    };
  }
  if (it.kind === "bug") {
    const b = it.v;
    return {
      label: b.title,
      sub: `${b.key} · ${dims.modules.find((m) => m.id === b.moduleId)?.name ?? ""} · ${b.severity} · ${STATUS_LABEL[b.status]}`,
      tone: b.status === "done" ? "ok" : b.severity === "critical" || b.severity === "high" ? "bad" : "warn",
      go: { scope: b.releaseId, selected: { kind: "bug", id: b.id } },
    };
  }
  const f = it.v;
  return {
    label: f.name,
    sub: `${f.key} · ${rel(f.releaseId)} · ${f.done}/${f.total} done`,
    tone: f.total && f.done === f.total ? "ok" : "muted",
    go: { scope: f.releaseId, selected: { kind: "feature", id: f.id } },
  };
}

/* ---------- shared queries ---------- */

type ActRow = { at: string; actorId: string | null; kind: "created" | "status" | "assignee"; from: string | null; to: string | null; key: string | null; title: string | null };

async function recentActivity(c: ToolCtx, f: { actor?: string; since?: string; until?: string; target?: { kind: string; id: string }; limit: number }) {
  const list = await rows<ActRow>(sql`
    select ${stampOf(sql`a.at`)} as at, a.actor_id as "actorId", a.kind, a.from_value as "from", a.to_value as "to",
           coalesce(t.key, b.key, f.key) as key, coalesce(t.title, b.title, f.name) as title
    from activity a
    left join tickets t on a.target_kind = 'ticket' and t.id = a.target_id
    left join bugs b on a.target_kind = 'bug' and b.id = a.target_id
    left join features f on a.target_kind = 'feature' and f.id = a.target_id
    where ${and_([
      sql`a.product_id = ${c.productId}`,
      f.actor && sql`a.actor_id = ${f.actor}`,
      f.target && sql`a.target_kind = ${f.target.kind} and a.target_id = ${f.target.id}`,
      f.since && sql`a.at >= ${f.since}::date`,
      f.until && sql`a.at < ${f.until}::date + 1`,
    ])}
    order by a.at desc limit ${f.limit}`);
  return list.map((x) => {
    const what = x.kind === "created" ? "created" : x.kind === "status" ? `moved to ${STATUS_WORD[x.to as Status] ?? x.to} (from ${STATUS_WORD[x.from as Status] ?? x.from})` : x.to ? `assigned to ${personName(c, x.to)}` : "unassigned";
    return `${x.at} · ${personName(c, x.actorId)} · ${x.key ? `${x.key} "${cut(x.title ?? "", 60)}"` : "a deleted item"} · ${what}`;
  });
}

const one = async (q: SQL) => (await rows<{ n: number }>(q))[0]?.n ?? 0;

/* ---------- tool definitions ---------- */

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: "string", description, ...extra });
const STATUS_ENUM = ["todo", "dev", "qa", "done"];

const parse = <T extends z.ZodType>(s: T, args: unknown): z.infer<T> => {
  const r = s.safeParse(args ?? {});
  if (!r.success) fail(`Bad arguments: ${r.error.issues.map((i) => `${i.path.join(".") || "args"}: ${i.message}`).join("; ")}`);
  return (r as { data: z.infer<T> }).data;
};
const optStr = z.string().trim().min(1).max(200).optional().nullable().transform((v) => v ?? undefined);
const isNobody = (s?: string) => !!s && ["nobody", "no one", "unassigned", "none", "unassign"].includes(lc(s));

const TOOLS: Record<string, Tool> = {
  /* ----- reading ----- */

  search: {
    viewerOk: true,
    def: {
      type: "function",
      function: {
        name: "search",
        description: "Search tickets, bugs, features (name+spec) and comments by words. Use to find the key of something described in words.",
        parameters: obj({ query: str("Words to look for"), kinds: { type: "array", items: { type: "string", enum: ["ticket", "bug", "feature", "comment"] }, description: "Limit to these kinds" } }, ["query"]),
      },
    },
    run: async (a, c) => {
      const { query, kinds } = parse(z.object({ query: z.string().min(1).max(200), kinds: z.array(z.enum(["ticket", "bug", "feature", "comment"])).optional().nullable() }), a);
      const hits = await searchBoard(c.productId, query, kinds?.length ? kinds : ["ticket", "bug", "feature", "comment"]);
      return { results: hits.map((h) => ({ kind: h.kind, key: h.key, title: h.title, where: h.where })), note: hits.length ? undefined : "Nothing matched. Try other words, or ask the person." };
    },
  },

  list_work: {
    viewerOk: true,
    def: {
      type: "function",
      function: {
        name: "list_work",
        description: "List tickets and/or bugs with filters. Returns exact counts plus up to `limit` rows.",
        parameters: obj({
          kind: { type: "string", enum: ["tickets", "bugs", "both"], description: "Default both" },
          status: { type: "array", items: { type: "string", enum: STATUS_ENUM }, description: "Omit for all. Open = todo, dev, qa" },
          assignee: str('A person\'s name, "me", or "unassigned"'),
          release: str('Release version or name, or "current"'),
          module: str("Module name"),
          feature: str("Feature key (tickets only)"),
          severity: { type: "array", items: { type: "string", enum: [...SEV_ORDER] }, description: "Bugs only" },
          limit: { type: "integer", description: "Max rows, default 25, max 60" },
        }),
      },
    },
    run: async (a, c) => {
      const f = parse(
        z.object({
          kind: z.enum(["tickets", "bugs", "both"]).optional().nullable(),
          status: z.array(z.enum(["todo", "dev", "qa", "done"])).max(4).optional().nullable(),
          assignee: optStr,
          release: optStr,
          module: optStr,
          feature: optStr,
          severity: z.array(z.enum(SEV_ORDER)).max(4).optional().nullable(),
          limit: z.number().int().min(1).max(60).optional().nullable(),
        }),
        a,
      );
      const kind = f.kind ?? "both";
      const unassigned = isNobody(f.assignee);
      const person = f.assignee && !unassigned ? findPerson(c, f.assignee) : undefined;
      const rel = f.release ? findRelease(c, f.release) : undefined;
      const mod = f.module ? findModule(c, f.module) : undefined;
      const feat = f.feature ? ((await findItem(c, f.feature, ["feature"])).v as FeatureRow) : undefined;
      const limit = f.limit ?? 25;
      const who = (col: SQL) => (unassigned ? sql`${col} is null` : person ? sql`${col} = ${person.id}` : null);
      const doTickets = kind !== "bugs" && !f.severity?.length;
      const doBugs = kind !== "tickets" && !feat;
      const tWhere = and_([
        sql`t.product_id = ${c.productId}`,
        f.status?.length && sql`t.status = any(${enumArr(f.status)})`,
        who(sql`t.assignee_id`),
        rel && sql`f.release_id = ${rel.id}`,
        mod && sql`f.module_id = ${mod.id}`,
        feat && sql`f.id = ${feat.id}`,
      ]);
      const bWhere = and_([
        sql`b.product_id = ${c.productId}`,
        f.status?.length && sql`b.status = any(${enumArr(f.status)})`,
        who(sql`b.assignee_id`),
        rel && sql`b.release_id = ${rel.id}`,
        mod && sql`b.module_id = ${mod.id}`,
        f.severity?.length && sql`b.severity = any(${enumArr(f.severity)})`,
      ]);
      const [tickets, ticketCount, bugs, bugCount] = await Promise.all([
        doTickets ? rows<TicketRow>(sql`select ${TICKET_COLS} from tickets t join features f on f.id = t.feature_id where ${tWhere} order by ${STATUS_SQL(sql`t.status`)}, t.created_at limit ${limit}`) : [],
        doTickets ? one(sql`select count(*)::int as n from tickets t join features f on f.id = t.feature_id where ${tWhere}`) : 0,
        doBugs ? rows<BugRow>(sql`select ${BUG_COLS} from bugs b where ${bWhere} order by ${SEV_SQL(sql`b.severity`)}, b.created_at limit ${limit}`) : [],
        doBugs ? one(sql`select count(*)::int as n from bugs b where ${bWhere}`) : 0,
      ]);
      return {
        filters: { assignee: person?.name ?? (unassigned ? "unassigned" : undefined), release: rel?.version, module: mod?.name, feature: feat?.key, status: f.status ?? undefined },
        ticketCount,
        bugCount,
        ticketFormat: TICKET_FMT,
        tickets: tickets.map((t) => ticketLine(c, t)),
        bugFormat: BUG_FMT,
        bugs: bugs.map((b) => bugLine(c, b)),
        truncated: ticketCount > limit || bugCount > limit ? `Showing up to ${limit} of each; the counts are exact. Narrow the filters to see others.` : undefined,
      };
    },
  },

  get_item: {
    viewerOk: true,
    def: {
      type: "function",
      function: {
        name: "get_item",
        description: "Full detail of one ticket, bug or feature: fields, parent feature/module/release, spec, child tickets, version chain, comments, and change history.",
        parameters: obj({ key: str("Item key like PAY-104, or its exact title") }, ["key"]),
      },
    },
    run: async (a, c) => {
      const { key } = parse(z.object({ key: z.string().min(1).max(200) }), a);
      const it = await findItem(c, key);
      const id = it.v.id;
      const [comments, commentCount, history] = await Promise.all([
        rows<{ authorId: string | null; at: string; body: string; files: string[] | null }>(sql`
          select c.author_id as "authorId", ${stampOf(sql`c.created_at`)} as at, left(c.body, 300) as body,
                 (select array_agg(a.name) from attachments a where a.comment_id = c.id) as files
          from comments c where c.product_id = ${c.productId} and c.target_kind = ${it.kind} and c.target_id = ${id}
          order by c.created_at desc limit 10`),
        one(sql`select count(*)::int as n from comments where product_id = ${c.productId} and target_kind = ${it.kind} and target_id = ${id}`),
        recentActivity(c, { target: { kind: it.kind, id }, limit: 15 }),
      ]);
      const shared = {
        commentCount,
        comments: comments.reverse().map((x) => ({ by: personName(c, x.authorId), at: x.at, text: x.body, files: x.files ?? [] })),
        history: history.reverse(),
      };
      if (it.kind === "ticket") return { kind: "ticket", ...ticketRow(c, it.v), createdAt: it.v.createdAt, createdBy: personName(c, it.v.createdBy), ...shared };
      if (it.kind === "bug") return { kind: "bug", ...bugRow(c, it.v), createdAt: it.v.createdAt, createdBy: personName(c, it.v.createdBy), ...shared };
      const f = it.v;
      const [chain, later, kids] = await Promise.all([
        rows<{ key: string; name: string; releaseId: string }>(sql`
          with recursive up(id, key, name, release_id, extends_id, depth) as (
            select id, key, name, release_id, extends_id, 0 from features where id = ${f.id}
            union all
            select p.id, p.key, p.name, p.release_id, p.extends_id, up.depth + 1 from features p join up on p.id = up.extends_id where up.depth < 12
          ) select key, name, release_id as "releaseId" from up order by depth desc`),
        rows<{ key: string; releaseId: string }>(sql`select key, release_id as "releaseId" from features where extends_id = ${f.id} limit 20`),
        rows<TicketRow>(sql`select ${TICKET_COLS} from tickets t join features f on f.id = t.feature_id where t.feature_id = ${f.id} order by ${STATUS_SQL(sql`t.status`)}, t.created_at limit 30`),
      ]);
      return {
        kind: "feature",
        ...featureRow(c, f),
        spec: f.spec.length > 2000 ? `${f.spec.slice(0, 2000)}… (cut)` : f.spec,
        createdAt: f.createdAt,
        createdBy: personName(c, f.createdBy),
        versionChain: chain.map((x) => `${relOf(c, x.releaseId)?.version} ${x.key} ${x.name}`),
        continuedIn: later.map((x) => `${relOf(c, x.releaseId)?.version} ${x.key}`),
        ticketCount: f.total,
        tickets: kids.map((t) => `${t.key} · ${cut(t.title, 70)} · ${STATUS_WORD[t.status]} · ${personName(c, t.assigneeId)}`),
        ...shared,
      };
    },
  },

  release_status: {
    viewerOk: true,
    def: {
      type: "function",
      function: {
        name: "release_status",
        description: "Release health: progress, tickets by status, blockers (open bugs, unassigned and to-do work), per-feature progress, per-person load, days left.",
        parameters: obj({ release: str('Version/name/"current"; omit for the one being viewed') }),
      },
    },
    run: async (a, c) => {
      const { release } = parse(z.object({ release: optStr }), a);
      const r = findRelease(c, release);
      const R = r.id;
      const inRel = sql`t.feature_id in (select id from features where release_id = ${R})`;
      const [byStatus, points, openBugs, openBugCount, unassigned, unassignedCount, todo, feats, featCount, perPerson] = await Promise.all([
        rows<{ status: Status; n: number }>(sql`select t.status, count(*)::int as n from tickets t where ${inRel} group by t.status`),
        rows<{ done: number; total: number }>(sql`select coalesce(sum(points) filter (where status = 'done'), 0)::int as done, coalesce(sum(points), 0)::int as total from tickets t where ${inRel}`),
        rows<BugRow>(sql`select ${BUG_COLS} from bugs b where b.release_id = ${R} and b.status <> 'done' order by ${SEV_SQL(sql`b.severity`)} limit 20`),
        one(sql`select count(*)::int as n from bugs where release_id = ${R} and status <> 'done'`),
        rows<TicketRow>(sql`select ${TICKET_COLS} from tickets t join features f on f.id = t.feature_id where f.release_id = ${R} and t.status <> 'done' and t.assignee_id is null order by t.created_at limit 15`),
        one(sql`select count(*)::int as n from tickets t where ${inRel} and t.status <> 'done' and t.assignee_id is null`),
        rows<TicketRow>(sql`select ${TICKET_COLS} from tickets t join features f on f.id = t.feature_id where f.release_id = ${R} and t.status = 'todo' order by t.created_at limit 15`),
        rows<FeatureRow>(sql`select ${FEATURE_COLS} from features f where f.release_id = ${R} order by f.created_at limit 30`),
        one(sql`select count(*)::int as n from features where release_id = ${R}`),
        rows<{ id: string | null; n: number }>(sql`select t.assignee_id as id, count(*)::int as n from tickets t where ${inRel} and t.status <> 'done' group by t.assignee_id order by n desc limit 25`),
      ]);
      const count = (s: Status) => byStatus.find((x) => x.status === s)?.n ?? 0;
      const total = byStatus.reduce((s, x) => s + x.n, 0);
      const daysLeft = Math.round((Date.parse(r.date) - Date.parse(new Date().toISOString().slice(0, 10))) / 86400000);
      return {
        release: `${r.version} · ${r.name}`,
        state: r.state,
        targetDate: r.date,
        daysLeft,
        progress: `${count("done")}/${total} tickets done (${total ? Math.round((count("done") / total) * 100) : 0}%)`,
        pointsDone: `${points[0].done}/${points[0].total}`,
        ticketsByStatus: Object.fromEntries((["todo", "dev", "qa", "done"] as Status[]).map((s) => [STATUS_WORD[s], count(s)])),
        openBugCount,
        bugFormat: BUG_FMT,
        openBugs: openBugs.map((b) => bugLine(c, b)),
        unassignedOpenCount: unassignedCount,
        unassignedOpenTickets: unassigned.map((t) => `${t.key} · ${cut(t.title, 70)}`),
        stillTodo: todo.map((t) => `${t.key} · ${cut(t.title, 70)} · ${personName(c, t.assigneeId)}`),
        featureCount: featCount,
        featureFormat: FEATURE_FMT,
        features: feats.map((f) => featureLine(c, f)),
        openTicketsPerPerson: Object.fromEntries(perPerson.map((p) => [personName(c, p.id), p.n])),
        note: featCount > 30 || openBugCount > 20 || unassignedCount > 15 ? "Lists are capped; counts are exact." : undefined,
      };
    },
  },

  compare_releases: {
    viewerOk: true,
    def: {
      type: "function",
      function: {
        name: "compare_releases",
        description: "Features delivered in each release after `from` up to `to`, and what each builds on.",
        parameters: obj({ from: str("Older version"), to: str("Newer version") }, ["from", "to"]),
      },
    },
    run: async (a, c) => {
      const { from, to } = parse(z.object({ from: z.string().min(1).max(60), to: z.string().min(1).max(60) }), a);
      let x = findRelease(c, from);
      let y = findRelease(c, to);
      if (x.date > y.date) [x, y] = [y, x];
      const between = c.dims.releases.filter((r) => r.date > x.date && r.date <= y.date).sort((p, q) => p.date.localeCompare(q.date)).slice(0, 30);
      const ids = between.map((r) => r.id);
      const idArr = sql`${`{${ids.join(",")}}`}::uuid[]`;
      const [feats, counts] = ids.length
        ? await Promise.all([
            rows<FeatureRow>(sql`select ${FEATURE_COLS} from features f join releases r on r.id = f.release_id where f.release_id = any(${idArr}) order by r.target_date, f.created_at limit 60`),
            rows<{ id: string; n: number }>(sql`select release_id as id, count(*)::int as n from features where release_id = any(${idArr}) group by release_id`),
          ])
        : [[], []];
      const total = counts.reduce((s2, x2) => s2 + x2.n, 0);
      return {
        from: x.version,
        to: y.version,
        featureCount: total,
        featureFormat: FEATURE_FMT,
        releases: between.map((r) => ({
          version: r.version,
          name: r.name,
          date: r.date,
          state: r.state,
          featureCount: counts.find((k) => k.id === r.id)?.n ?? 0,
          features: feats.filter((f) => f.releaseId === r.id).map((f) => featureLine(c, f)),
        })),
        note: total > 60 ? `Listing the first 60 of ${total} features; per-release counts are exact. Narrow the range for the rest.` : undefined,
      };
    },
  },

  person_workload: {
    viewerOk: true,
    def: {
      type: "function",
      function: {
        name: "person_workload",
        description: "One person's open/done tickets, open bugs, owned features and latest changes.",
        parameters: obj({ person: str('Name or "me"'), release: str("Limit to one release (optional)") }, ["person"]),
      },
    },
    run: async (a, c) => {
      const { person, release } = parse(z.object({ person: z.string().min(1).max(120), release: optStr }), a);
      const p = findPerson(c, person);
      const r = release ? findRelease(c, release) : undefined;
      const relT = r ? sql`and f.release_id = ${r.id}` : sql``;
      const relB = r ? sql`and b.release_id = ${r.id}` : sql``;
      const [open, counts, bugs, bugCount, owns, recent] = await Promise.all([
        rows<TicketRow>(sql`select ${TICKET_COLS} from tickets t join features f on f.id = t.feature_id where t.product_id = ${c.productId} and t.assignee_id = ${p.id} and t.status <> 'done' ${relT} order by ${STATUS_SQL(sql`t.status`)}, t.created_at limit 30`),
        rows<{ open: number; done: number; points: number }>(sql`
          select count(*) filter (where t.status <> 'done')::int as open, count(*) filter (where t.status = 'done')::int as done,
                 coalesce(sum(t.points) filter (where t.status <> 'done'), 0)::int as points
          from tickets t join features f on f.id = t.feature_id where t.product_id = ${c.productId} and t.assignee_id = ${p.id} ${relT}`),
        rows<BugRow>(sql`select ${BUG_COLS} from bugs b where b.product_id = ${c.productId} and b.assignee_id = ${p.id} and b.status <> 'done' ${relB} order by ${SEV_SQL(sql`b.severity`)} limit 20`),
        one(sql`select count(*)::int as n from bugs b where b.product_id = ${c.productId} and b.assignee_id = ${p.id} and b.status <> 'done' ${relB}`),
        rows<{ key: string; name: string }>(sql`select f.key, f.name from features f where f.product_id = ${c.productId} and f.owner_id = ${p.id} ${r ? sql`and f.release_id = ${r.id}` : sql``} order by f.created_at desc limit 20`),
        recentActivity(c, { actor: p.id, limit: 10 }),
      ]);
      return {
        person: p.name,
        role: p.role,
        release: r?.version ?? "all releases",
        openTicketCount: counts[0].open,
        ticketFormat: TICKET_FMT,
        openTickets: open.map((t) => ticketLine(c, t)),
        doneTickets: counts[0].done,
        openPoints: counts[0].points,
        openBugCount: bugCount,
        bugFormat: BUG_FMT,
        openBugs: bugs.map((b) => bugLine(c, b)),
        ownsFeatures: owns.map((f) => `${f.key} ${f.name}`),
        recentChanges: recent,
        note: counts[0].open > 30 ? "Open tickets list is capped at 30; the count is exact." : undefined,
      };
    },
  },

  activity: {
    viewerOk: true,
    def: {
      type: "function",
      function: {
        name: "activity",
        description: "Change log (created, status, reassignment), newest first, filterable by person and dates.",
        parameters: obj({ person: str("Only this person's changes (optional)"), since: str("ISO date YYYY-MM-DD (inclusive)"), until: str("ISO date YYYY-MM-DD (inclusive)"), limit: { type: "integer", description: "Default 20, max 50" } }),
      },
    },
    run: async (a, c) => {
      const f = parse(z.object({ person: optStr, since: optStr, until: optStr, limit: z.number().int().min(1).max(50).optional().nullable() }), a);
      const p = f.person ? findPerson(c, f.person) : undefined;
      for (const d of [f.since, f.until]) if (d && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d)))) fail(`Dates must be YYYY-MM-DD, got "${d}".`);
      const limit = f.limit ?? 20;
      const list = await recentActivity(c, { actor: p?.id, since: f.since, until: f.until, limit });
      return { person: p?.name, since: f.since, until: f.until, shown: list.length, changes: list, note: list.length === limit ? `Showing the latest ${limit}; there may be more in this range.` : undefined };
    },
  },

  module_history: {
    viewerOk: true,
    def: {
      type: "function",
      function: {
        name: "module_history",
        description: "A module's features across releases (oldest first) and its bugs.",
        parameters: obj({ module: str("Module name") }, ["module"]),
      },
    },
    run: async (a, c) => {
      const { module } = parse(z.object({ module: z.string().min(1).max(120) }), a);
      const m = findModule(c, module);
      const [feats, featCount, open, bugTotal, openCount] = await Promise.all([
        rows<FeatureRow>(sql`select ${FEATURE_COLS} from features f join releases r on r.id = f.release_id where f.module_id = ${m.id} order by r.target_date desc, f.created_at desc limit 60`),
        one(sql`select count(*)::int as n from features where module_id = ${m.id}`),
        rows<BugRow>(sql`select ${BUG_COLS} from bugs b where b.module_id = ${m.id} and b.status <> 'done' order by ${SEV_SQL(sql`b.severity`)} limit 25`),
        one(sql`select count(*)::int as n from bugs where module_id = ${m.id}`),
        one(sql`select count(*)::int as n from bugs where module_id = ${m.id} and status <> 'done'`),
      ]);
      return {
        module: m.name,
        featureCount: featCount,
        featureFormat: FEATURE_FMT,
        features: feats.reverse().map((f) => featureLine(c, f)),
        bugFormat: BUG_FMT,
        bugs: { total: bugTotal, openCount, open: open.map((b) => bugLine(c, b)) },
        note: featCount > 60 ? "Showing the latest 60 features; the count is exact." : undefined,
      };
    },
  },

  team: {
    viewerOk: true,
    def: {
      type: "function",
      function: { name: "team", description: "Members with access role, title, join date; admins also see emails and pending invites.", parameters: obj({}) },
    },
    run: async (_a, c) => {
      const admin = atLeast(c.role, "admin");
      const list = await db
        .select({ name: schema.users.name, email: schema.users.email, role: schema.members.role, title: schema.members.title, joinedAt: schema.members.joinedAt })
        .from(schema.members)
        .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
        .where(eq(schema.members.workspaceId, c.workspaceId))
        .orderBy(asc(schema.members.joinedAt))
        .limit(100);
      const invites = admin
        ? await db
            .select({ email: schema.invites.email, role: schema.invites.role, expiresAt: schema.invites.expiresAt })
            .from(schema.invites)
            .where(and(eq(schema.invites.workspaceId, c.workspaceId), eq(schema.invites.status, "pending")))
            .limit(100)
        : [];
      return {
        memberCount: c.dims.people.length,
        memberFormat: admin ? "name · access · title · joined · email" : "name · access · title · joined",
        members: list.map((r) => [r.name, r.role, r.title ?? "-", r.joinedAt.toISOString().slice(0, 10), ...(admin ? [r.email] : [])].join(" · ")),
        note: c.dims.people.length > 100 ? `Showing the first 100 of ${c.dims.people.length} members.` : undefined,
        pendingInvites: admin ? invites.map((i) => ({ email: i.email, role: i.role, expires: i.expiresAt.toISOString().slice(0, 10), expired: i.expiresAt < new Date() })) : "Only admins can see invites.",
      };
    },
  },

  billing: {
    viewerOk: true,
    def: {
      type: "function",
      function: { name: "billing", description: "Plan, seats, paid-until, card brand/last 4, recent payments. Admins only.", parameters: obj({}) },
    },
    run: async (_a, c) => {
      if (!atLeast(c.role, "admin")) fail("Only owners and admins can see billing. Tell the person to ask an admin.");
      const [w] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, c.workspaceId));
      const pays = await db.select().from(schema.payments).where(eq(schema.payments.workspaceId, c.workspaceId)).orderBy(desc(schema.payments.createdAt)).limit(10);
      return {
        plan: w.plan,
        seats: w.seats,
        seatsUsed: c.dims.people.length,
        paidUntil: w.paidUntil ? w.paidUntil.toISOString().slice(0, 10) : null,
        card: w.cardLast4 ? `${w.cardBrand} ending ${w.cardLast4}, expires ${w.cardExp}` : null,
        payments: pays.map((p) => ({ date: p.createdAt.toISOString().slice(0, 10), plan: p.plan, seats: p.seats, amount: `${(p.amountCents / 100).toFixed(2)} ${p.currency.toUpperCase()}`, tax: `${(p.taxCents / 100).toFixed(2)}`, status: p.status, reason: p.failureReason ?? undefined })),
      };
    },
  },

  /* ----- proposing changes (nothing is written until the person confirms) ----- */

  set_status: {
    write: true,
    def: {
      type: "function",
      function: {
        name: "set_status",
        description: "Propose a new status for a ticket or bug (needs the person's Confirm).",
        parameters: obj({ item: str("Ticket or bug key, e.g. PAY-104"), status: { type: "string", enum: STATUS_ENUM, description: "todo = To do, dev = In dev, qa = In QA, done = Done" } }, ["item", "status"]),
      },
    },
    run: async (a, c) => {
      const { item, status } = parse(z.object({ item: z.string().min(1).max(200), status: z.enum(["todo", "dev", "qa", "done"]) }), a);
      const it = await findItem(c, item, ["ticket", "bug"]);
      const v = it.v as TicketRow | BugRow;
      if (v.status === status) fail(`${v.key} is already ${STATUS_WORD[status]}. Nothing to change.`);
      return propose(c, {
        action: it.kind === "ticket" ? { type: "ticketStatus", id: v.id, status } : { type: "bugStatus", id: v.id, status },
        expect: { kind: it.kind as "ticket" | "bug", id: v.id, field: "status", value: v.status },
        title: `Move ${v.key} to ${STATUS_WORD[status]}`,
        lines: [`"${v.title}"`, `Status: ${STATUS_WORD[v.status]} → ${STATUS_WORD[status]}`],
        item: it,
      });
    },
  },

  assign_ticket: {
    write: true,
    def: {
      type: "function",
      function: {
        name: "assign_ticket",
        description: 'Propose a ticket assignee, or "nobody" to unassign (needs Confirm).',
        parameters: obj({ ticket: str("Ticket key"), person: str('Name, "me", or "nobody"') }, ["ticket", "person"]),
      },
    },
    run: async (a, c) => {
      const { ticket, person } = parse(z.object({ ticket: z.string().min(1).max(200), person: z.string().min(1).max(120) }), a);
      if ((await itemsByKeys(c.productId, [ticket])).get(ticket.trim().toUpperCase())?.kind === "bug") fail("Bugs can't be reassigned from Ask Zelo yet. Tell the person to open the bug and change it there.");
      const it = await findItem(c, ticket, ["ticket"]);
      const t = it.v as TicketRow;
      const p = isNobody(person) ? null : findPerson(c, person);
      if ((p?.id ?? null) === t.assigneeId) fail(`${t.key} is already ${p ? `assigned to ${p.name}` : "unassigned"}.`);
      return propose(c, {
        action: { type: "ticketAssignee", id: t.id, assigneeId: p?.id ?? null },
        expect: { kind: "ticket", id: t.id, field: "assigneeId", value: t.assigneeId },
        title: p ? `Assign ${t.key} to ${p.name}` : `Unassign ${t.key}`,
        lines: [`"${t.title}"`, `Assignee: ${personName(c, t.assigneeId)} → ${p?.name ?? "Unassigned"}`],
        item: it,
      });
    },
  },

  create_ticket: {
    write: true,
    def: {
      type: "function",
      function: {
        name: "create_ticket",
        description: "Propose a ticket under a feature, with the title the person gave (needs Confirm).",
        parameters: obj({ feature: str("Feature key, e.g. PAY-101"), title: str("Ticket title"), assignee: str('Name, "me" or "nobody". Omit to assign the person asking.') }, ["feature", "title"]),
      },
    },
    run: async (a, c) => {
      const f0 = parse(z.object({ feature: z.string().min(1).max(200), title: z.string().trim().min(3).max(200), assignee: optStr }), a);
      const it = await findItem(c, f0.feature, ["feature"]);
      const f = it.v as FeatureRow;
      const p = isNobody(f0.assignee) ? null : f0.assignee ? findPerson(c, f0.assignee) : (c.dims.people.find((x) => x.id === c.user.id) ?? null);
      const [dup] = await rows<{ key: string }>(sql`select key from tickets where feature_id = ${f.id} and lower(title) = ${lc(f0.title)} limit 1`);
      if (dup) fail(`${f.key} already has a ticket with that title: ${dup.key}. Ask if they still want a second one.`);
      return propose(c, {
        action: { type: "addTicket", id: randomUUID(), featureId: f.id, title: f0.title, assigneeId: p?.id ?? null },
        expect: null,
        title: "Create a ticket",
        lines: [`"${f0.title}"`, `Feature: ${f.key} ${f.name} (${relOf(c, f.releaseId)?.version})`, `Assignee: ${p?.name ?? "Unassigned"}`],
        item: it,
      });
    },
  },

  create_chore: {
    write: true,
    def: {
      type: "function",
      function: {
        name: "create_chore",
        description: "Propose a chore ticket (no feature) in a release's Housekeeping bucket, assigned to the asker (needs Confirm).",
        parameters: obj({ release: str('Version or "current"'), title: str("Ticket title") }, ["release", "title"]),
      },
    },
    run: (a, c) => {
      const f0 = parse(z.object({ release: z.string().min(1).max(60), title: z.string().trim().min(3).max(200) }), a);
      const r = findRelease(c, f0.release);
      return propose(c, {
        action: { type: "addMiscTicket", id: randomUUID(), releaseId: r.id, title: f0.title },
        expect: null,
        title: "Create a chore",
        lines: [`"${f0.title}"`, `Release: ${r.version} · Housekeeping`, `Assignee: ${c.user.name}`],
        item: null,
      });
    },
  },

  create_feature: {
    write: true,
    def: {
      type: "function",
      function: {
        name: "create_feature",
        description: "Propose a feature in a release and module (needs Confirm).",
        parameters: obj({ release: str("Version or name"), module: str("Module name"), name: str("Feature name"), owner: str('Name, "me" or "nobody". Omit for nobody.'), spec: str("Spec text the person gave (optional)") }, ["release", "module", "name"]),
      },
    },
    run: async (a, c) => {
      const f0 = parse(z.object({ release: z.string().min(1).max(60), module: z.string().min(1).max(120), name: z.string().trim().min(2).max(120), owner: optStr, spec: z.string().max(20_000).optional().nullable() }), a);
      const r = findRelease(c, f0.release);
      const m = findModule(c, f0.module);
      if (m.misc) fail("Features can't go in the Miscellaneous module. Use create_chore for chores.");
      const p = !f0.owner || isNobody(f0.owner) ? null : findPerson(c, f0.owner);
      const [dup] = await rows<{ key: string; name: string }>(sql`select key, name from features where release_id = ${r.id} and module_id = ${m.id} and lower(name) = ${lc(f0.name)} limit 1`);
      if (dup) fail(`${r.version} already has "${dup.name}" in ${m.name}: ${dup.key}.`);
      return propose(c, {
        action: { type: "addFeature", id: randomUUID(), releaseId: r.id, moduleId: m.id, name: f0.name, ownerId: p?.id ?? null, spec: f0.spec ?? "" },
        expect: null,
        title: "Create a feature",
        lines: [`"${f0.name}"`, `${r.version} · ${m.name}`, `Owner: ${p?.name ?? "Nobody"}`, ...(f0.spec ? [`Spec: ${f0.spec.slice(0, 120)}${f0.spec.length > 120 ? "…" : ""}`] : [])],
        item: null,
      });
    },
  },

  create_release: {
    write: true,
    def: {
      type: "function",
      function: {
        name: "create_release",
        description: "Propose a release; ask for any missing version/date/state. 'current' marks the old current one shipped (needs Confirm).",
        parameters: obj({ version: str("e.g. v2.4"), name: str("Short name (optional)"), date: str("Target date YYYY-MM-DD"), state: { type: "string", enum: ["planned", "current", "shipped"] } }, ["version", "date", "state"]),
      },
    },
    run: (a, c) => {
      const f0 = parse(z.object({ version: z.string().trim().min(1).max(30), name: z.string().trim().max(80).optional().nullable(), date: z.iso.date("Use YYYY-MM-DD."), state: z.enum(["planned", "current", "shipped"]) }), a);
      const bare = (v: string) => lc(v).replace(/^v/, "");
      const dup = c.dims.releases.find((r) => bare(r.version) === bare(f0.version));
      if (dup) fail(`Release ${dup.version} already exists.`);
      const cur = c.dims.releases.find((r) => r.state === "current");
      return propose(c, {
        action: { type: "addRelease", id: randomUUID(), version: f0.version, name: f0.name ?? "", date: f0.date, state: f0.state },
        expect: null,
        title: `Create release ${f0.version}`,
        lines: [`${f0.version}${f0.name ? ` · ${f0.name}` : ""}`, `Target: ${f0.date} · ${f0.state}`, ...(f0.state === "current" && cur ? [`${cur.version} will be marked shipped`] : [])],
        item: null,
      });
    },
  },

  create_module: {
    write: true,
    def: {
      type: "function",
      function: { name: "create_module", description: "Propose a module, a permanent product area like Payments (needs Confirm).", parameters: obj({ name: str("Module name") }, ["name"]) },
    },
    run: (a, c) => {
      const { name } = parse(z.object({ name: z.string().trim().min(2).max(60) }), a);
      const dup = c.dims.modules.find((m) => lc(m.name) === lc(name));
      if (dup) fail(`A module called ${dup.name} already exists.`);
      return propose(c, { action: { type: "addModule", id: randomUUID(), name }, expect: null, title: `Create module ${name}`, lines: [`Module: ${name}`], item: null });
    },
  },

  add_comment: {
    write: true,
    viewerOk: true,
    def: {
      type: "function",
      function: {
        name: "add_comment",
        description: "Propose a comment as the asker on an item, in their words (needs Confirm).",
        parameters: obj({ item: str("Item key"), text: str("Comment text") }, ["item", "text"]),
      },
    },
    run: async (a, c) => {
      const { item, text } = parse(z.object({ item: z.string().min(1).max(200), text: z.string().trim().min(1).max(5000) }), a);
      const it = await findItem(c, item);
      return propose(c, {
        action: { type: "addComment", id: randomUUID(), target: { kind: it.kind, id: it.v.id }, body: text, attachmentIds: [] },
        expect: null,
        title: `Comment on ${it.v.key}`,
        lines: [`"${text.length > 200 ? `${text.slice(0, 200)}…` : text}"`, `Posted as ${c.user.name}`],
        item: it,
      });
    },
  },
};

function propose(c: ToolCtx, p: { action: unknown; expect: Proposal["expect"]; title: string; lines: string[]; item: Item | null }) {
  if (c.proposals.length >= 8) fail("That's already 8 changes in one go. Ask the person to confirm these first.");
  const action = Action.parse(p.action); // the exact schema the UI's own changes go through
  c.proposals.push({ id: randomUUID(), action, expect: p.expect, title: p.title, lines: p.lines, card: p.item ? cardOf(c.dims, p.item) : null });
  return { status: "waiting_for_confirmation", change: p.title, details: p.lines, note: "Not done yet: the person must press Confirm on the card. Don't say it's done." };
}

/* ---------- running ---------- */

export function toolsFor(role: Role): ToolDef[] {
  const member = atLeast(role, "member");
  return Object.values(TOOLS)
    .filter((t) => !t.write || member || t.viewerOk)
    .map((t) => t.def);
}

/** Runs one tool call. Problems come back as `{ error }` for the model to read, never as a crash. */
export async function runTool(name: string, rawArgs: string, c: ToolCtx): Promise<{ ok: boolean; result: unknown; args: unknown }> {
  const tool = Object.hasOwn(TOOLS, name) ? TOOLS[name] : undefined;
  let args: unknown = {};
  try {
    args = rawArgs?.trim() ? JSON.parse(rawArgs) : {};
  } catch {
    return { ok: false, args: rawArgs, result: { error: "Arguments were not valid JSON. Call the tool again with valid JSON." } };
  }
  if (!tool) return { ok: false, args, result: { error: `There is no tool called ${String(name).slice(0, 60)}.` } };
  if (tool.write && !tool.viewerOk && !atLeast(c.role, "member")) return { ok: false, args, result: { error: "This person is a viewer: they can comment but can't change work." } };
  try {
    return { ok: true, args, result: await tool.run(args, c) };
  } catch (e) {
    if (e instanceof ToolError) return { ok: false, args, result: { error: e.message } };
    if (e instanceof z.ZodError) return { ok: false, args, result: { error: e.issues.map((i) => i.message).join("; ") } };
    console.error("[ai] tool", name, e);
    return { ok: false, args, result: { error: "That lookup failed on the server. Say you couldn't fetch it; don't guess." } };
  }
}

/** A short "what I'm doing" line for the UI while a tool runs. */
export function toolStatus(name: string, rawArgs: string): string {
  let a: Record<string, unknown> = {};
  try {
    a = JSON.parse(rawArgs || "{}");
  } catch {
    // ignore
  }
  const s = (k: string) => (typeof a[k] === "string" ? (a[k] as string).slice(0, 40) : "");
  switch (name) {
    case "search":
      return `Searching for "${s("query")}"`;
    case "list_work":
      return "Going through tickets and bugs";
    case "get_item":
      return `Opening ${s("key")}`;
    case "release_status":
      return `Checking ${s("release") || "the release"}`;
    case "compare_releases":
      return `Comparing ${s("from")} and ${s("to")}`;
    case "person_workload":
      return ["me", "myself", "i"].includes(s("person").toLowerCase()) ? "Looking at your work" : `Looking at ${s("person")}'s work`;
    case "activity":
      return "Reading the change log";
    case "module_history":
      return `Tracing ${s("module")}`;
    case "team":
      return "Checking the team";
    case "billing":
      return "Checking billing";
    default:
      return "Preparing a change for you to confirm";
  }
}
