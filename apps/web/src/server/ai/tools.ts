import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { STATUS_LABEL, type Bug, type Feature, type Graph, type Release, type Status, type Ticket } from "@/data/model";
import { Action } from "../actions";
import { atLeast, type Role } from "../auth";
import { db, schema } from "../db";
import type { AiCard } from "../db/schema";
import type { ToolDef } from "./groq";

/**
 * Everything Ask Zelo can see and do. The model never writes SQL: it calls these typed tools,
 * each scoped to one workspace and checked against the caller's role.
 *
 * Read tools answer from the board (loaded once per question) and a few workspace tables.
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
  g: Graph;
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

/* ---------- lookups ---------- */

const lc = (s: string) => s.trim().toLowerCase();
const STATUS_WORD: Record<Status, string> = { todo: "To do", dev: "In dev", qa: "In QA", done: "Done" };
const SEV_ORDER = ["critical", "high", "medium", "low"];
const day = (iso: string) => iso.slice(0, 10);
const stamp = (iso: string) => iso.slice(0, 16).replace("T", " ");

const personName = (g: Graph, id: string | null | undefined) => (id ? (g.people.find((p) => p.id === id)?.name ?? "Former member") : "Unassigned");
const featureOf = (g: Graph, t: Ticket) => g.features.find((f) => f.id === t.featureId)!;
const moduleName = (g: Graph, id: string) => g.modules.find((m) => m.id === id)?.name ?? "?";
const releaseOf = (g: Graph, id: string) => g.releases.find((r) => r.id === id)!;
const ticketsOf = (g: Graph, featureId: string) => g.tickets.filter((t) => t.featureId === featureId);
const progress = (ts: Ticket[]) => {
  const done = ts.filter((t) => t.status === "done").length;
  return { done, total: ts.length, pct: ts.length ? Math.round((done / ts.length) * 100) : 0 };
};

function findRelease(g: Graph, ref: string | undefined, c?: ToolCtx): Release {
  if (!ref) {
    const r = (c && c.scope !== "all" && g.releases.find((x) => x.id === c.scope)) || g.releases.find((x) => x.state === "current");
    return r ?? fail("No release given and there is no current release.");
  }
  const q = lc(ref).replace(/^version\s+/, "");
  if (["current", "latest", "this release", "current release"].includes(q)) return g.releases.find((r) => r.state === "current") ?? fail("There is no current release.");
  const bare = (v: string) => lc(v).replace(/^v/, "");
  const hits = g.releases.filter((r) => bare(r.version) === bare(q) || lc(r.name) === q);
  if (hits.length === 1) return hits[0];
  const loose = g.releases.filter((r) => lc(r.name).includes(q));
  if (loose.length === 1) return loose[0];
  return fail(`No release matches "${ref}". Releases: ${g.releases.map((r) => `${r.version} (${r.name})`).join(", ") || "none"}.`);
}

function findModule(g: Graph, ref: string) {
  const q = lc(ref);
  const exact = g.modules.filter((m) => lc(m.name) === q);
  if (exact.length === 1) return exact[0];
  const loose = g.modules.filter((m) => lc(m.name).startsWith(q) || lc(m.name).includes(q));
  if (loose.length === 1) return loose[0];
  return fail(`${loose.length > 1 ? `"${ref}" matches several modules` : `No module matches "${ref}"`}. Modules: ${g.modules.map((m) => m.name).join(", ")}.`);
}

function findPerson(c: ToolCtx, ref: string) {
  const g = c.g;
  const q = lc(ref);
  if (["me", "myself", "i", "mujhe", "main", "mera", "mere", "self"].includes(q)) return g.people.find((p) => p.id === c.user.id) ?? fail("You are not on this team's member list.");
  const exact = g.people.filter((p) => lc(p.name) === q);
  if (exact.length === 1) return exact[0];
  const first = g.people.filter((p) => lc(p.name).split(/\s+/)[0] === q);
  if (first.length === 1) return first[0];
  const loose = g.people.filter((p) => lc(p.name).includes(q));
  if (loose.length === 1) return loose[0];
  const many = first.length > 1 ? first : loose;
  if (many.length > 1) return fail(`"${ref}" could be ${many.map((p) => p.name).join(" or ")}. Ask which one.`);
  return fail(`Nobody called "${ref}" is on this team. Team: ${g.people.map((p) => p.name).join(", ")}.`);
}

type Item = { kind: "ticket"; v: Ticket } | { kind: "bug"; v: Bug } | { kind: "feature"; v: Feature };

function findItem(g: Graph, ref: string, only?: Item["kind"][]): Item {
  const q = ref.trim().toUpperCase();
  const ok = (k: Item["kind"]) => !only || only.includes(k);
  const t = ok("ticket") && g.tickets.find((x) => x.key.toUpperCase() === q);
  if (t) return { kind: "ticket", v: t };
  const b = ok("bug") && g.bugs.find((x) => x.key.toUpperCase() === q);
  if (b) return { kind: "bug", v: b };
  const f = ok("feature") && g.features.find((x) => x.key.toUpperCase() === q);
  if (f) return { kind: "feature", v: f };
  // Not a key: accept an exact, unique title.
  const l = lc(ref);
  const byTitle: Item[] = [
    ...(ok("ticket") ? g.tickets.filter((x) => lc(x.title) === l).map((v) => ({ kind: "ticket" as const, v })) : []),
    ...(ok("bug") ? g.bugs.filter((x) => lc(x.title) === l).map((v) => ({ kind: "bug" as const, v })) : []),
    ...(ok("feature") ? g.features.filter((x) => lc(x.name) === l).map((v) => ({ kind: "feature" as const, v })) : []),
  ];
  if (byTitle.length === 1) return byTitle[0];
  if (byTitle.length > 1) return fail(`"${ref}" matches ${byTitle.length} items: ${byTitle.map((i) => i.v.key).join(", ")}. Ask which one.`);
  const near = search(g, ref, only).slice(0, 5);
  return fail(`No ${only?.join("/") ?? "item"} with key or exact title "${ref}".${near.length ? ` Closest: ${near.map((h) => `${h.key} "${h.title}"`).join(", ")}.` : ""} Use search, or ask the person which one they mean.`);
}

/* ---------- rows the model reads, and cards the person clicks ---------- */

const ticketRow = (g: Graph, t: Ticket) => {
  const f = featureOf(g, t);
  return {
    key: t.key,
    title: t.title,
    status: STATUS_WORD[t.status],
    assignee: personName(g, t.assigneeId),
    points: t.points,
    feature: `${f.key} ${f.name}`,
    module: moduleName(g, f.moduleId),
    release: releaseOf(g, f.releaseId).version,
  };
};
const bugRow = (g: Graph, b: Bug) => ({
  key: b.key,
  title: b.title,
  severity: b.severity,
  status: STATUS_WORD[b.status],
  assignee: personName(g, b.assigneeId),
  module: moduleName(g, b.moduleId),
  release: releaseOf(g, b.releaseId).version,
  introducedIn: b.introducedIn ? releaseOf(g, b.introducedIn)?.version : undefined,
});
const featureRow = (g: Graph, f: Feature) => {
  const p = progress(ticketsOf(g, f.id));
  return {
    key: f.key,
    name: f.name,
    module: moduleName(g, f.moduleId),
    release: releaseOf(g, f.releaseId).version,
    owner: personName(g, f.ownerId),
    progress: `${p.done}/${p.total} tickets done (${p.pct}%)`,
    buildsOn: f.extendsId ? g.features.find((x) => x.id === f.extendsId)?.key : undefined,
  };
};

/** The clickable card for any item key, built from the database row (never from model text). */
export function cardFor(g: Graph, key: string): AiCard | null {
  const K = key.toUpperCase();
  const t = g.tickets.find((x) => x.key.toUpperCase() === K);
  if (t) {
    const f = featureOf(g, t);
    return {
      label: t.title,
      sub: `${t.key} · ${f.name} · ${STATUS_LABEL[t.status]} · ${personName(g, t.assigneeId).split(" ")[0]}`,
      tone: t.status === "done" ? "ok" : !t.assigneeId ? "bad" : t.status === "todo" ? "muted" : "warn",
      go: { scope: f.releaseId, selected: { kind: "ticket", id: t.id } },
    };
  }
  const b = g.bugs.find((x) => x.key.toUpperCase() === K);
  if (b)
    return {
      label: b.title,
      sub: `${b.key} · ${moduleName(g, b.moduleId)} · ${b.severity} · ${STATUS_LABEL[b.status]}`,
      tone: b.status === "done" ? "ok" : b.severity === "critical" || b.severity === "high" ? "bad" : "warn",
      go: { scope: b.releaseId, selected: { kind: "bug", id: b.id } },
    };
  const f = g.features.find((x) => x.key.toUpperCase() === K);
  if (f) {
    const p = progress(ticketsOf(g, f.id));
    return {
      label: f.name,
      sub: `${f.key} · ${releaseOf(g, f.releaseId).version} · ${p.done}/${p.total} done`,
      tone: p.total && p.done === p.total ? "ok" : "muted",
      go: { scope: f.releaseId, selected: { kind: "feature", id: f.id } },
    };
  }
  return null;
}

/** Every real item key on the board, upper-cased. */
export const allKeys = (g: Graph) => new Set([...g.tickets, ...g.bugs, ...g.features].map((x) => x.key.toUpperCase()));

/* ---------- search ---------- */

type Hit = { kind: string; key: string; title: string; where: string; score: number };

function search(g: Graph, query: string, only?: string[]): Hit[] {
  const words = lc(query)
    .split(/[^a-z0-9.\-]+/)
    .filter((w) => w.length > 1);
  if (!words.length) return [];
  const phrase = lc(query);
  const score = (text: string) => {
    const t = lc(text);
    let s = 0;
    for (const w of words) if (t.includes(w)) s++;
    if (s && t.includes(phrase)) s += 2;
    return s;
  };
  const need = Math.max(1, Math.ceil(words.length * 0.6));
  const hits: Hit[] = [];
  const add = (kind: string, key: string, title: string, where: string, s: number) => s >= need && hits.push({ kind, key, title, where, score: s });
  const want = (k: string) => !only || only.includes(k);
  if (want("ticket")) for (const t of g.tickets) add("ticket", t.key, t.title, "title", Math.max(score(t.title), t.key.toLowerCase() === phrase ? 9 : 0));
  if (want("bug")) for (const b of g.bugs) add("bug", b.key, b.title, "title", Math.max(score(b.title), b.key.toLowerCase() === phrase ? 9 : 0));
  if (want("feature"))
    for (const f of g.features) {
      const n = score(f.name);
      const s = score(f.spec);
      add("feature", f.key, f.name, n >= s ? "name" : "spec", Math.max(n + 0.5, s, f.key.toLowerCase() === phrase ? 9 : 0));
    }
  if (want("comment"))
    for (const cm of g.comments) {
      const s = score(cm.body);
      if (s < need) continue;
      const target = cm.target.kind === "ticket" ? g.tickets.find((x) => x.id === cm.target.id) : cm.target.kind === "bug" ? g.bugs.find((x) => x.id === cm.target.id) : g.features.find((x) => x.id === cm.target.id);
      if (!target) continue;
      add("comment", target.key, cm.body.slice(0, 140), `comment by ${personName(g, cm.authorId)} on ${day(cm.createdAt)}`, s - 0.25);
    }
  return hits.sort((a, b) => b.score - a.score).slice(0, 15);
}

/* ---------- tool definitions ---------- */

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: "string", description, ...extra });
const STATUS_ENUM = ["todo", "dev", "qa", "done"];

const parse = <T extends z.ZodType>(s: T, args: unknown): z.infer<T> => {
  const r = s.safeParse(args ?? {});
  if (!r.success) fail(`Bad arguments: ${r.error.issues.map((i) => `${i.path.join(".") || "args"}: ${i.message}`).join("; ")}`);
  return (r as { data: z.infer<T> }).data;
};
const optStr = z.string().trim().min(1).optional().nullable().transform((v) => v ?? undefined);

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
    run: (a, c) => {
      const { query, kinds } = parse(z.object({ query: z.string().min(1).max(200), kinds: z.array(z.enum(["ticket", "bug", "feature", "comment"])).optional().nullable() }), a);
      const hits = search(c.g, query, kinds ?? undefined);
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
          severity: { type: "array", items: { type: "string", enum: SEV_ORDER }, description: "Bugs only" },
          limit: { type: "integer", description: "Max rows, default 25, max 60" },
        }),
      },
    },
    run: (a, c) => {
      const f = parse(
        z.object({
          kind: z.enum(["tickets", "bugs", "both"]).optional().nullable(),
          status: z.array(z.enum(["todo", "dev", "qa", "done"])).optional().nullable(),
          assignee: optStr,
          release: optStr,
          module: optStr,
          feature: optStr,
          severity: z.array(z.enum(["critical", "high", "medium", "low"])).optional().nullable(),
          limit: z.number().int().min(1).max(60).optional().nullable(),
        }),
        a,
      );
      const g = c.g;
      const kind = f.kind ?? "both";
      const unassigned = f.assignee && ["unassigned", "nobody", "no one", "none"].includes(lc(f.assignee));
      const person = f.assignee && !unassigned ? findPerson(c, f.assignee) : undefined;
      const rel = f.release ? findRelease(g, f.release) : undefined;
      const mod = f.module ? findModule(g, f.module) : undefined;
      const feat = f.feature ? (findItem(g, f.feature, ["feature"]).v as Feature) : undefined;
      const st = f.status?.length ? new Set(f.status) : null;
      const limit = f.limit ?? 25;
      const who = (id: string | null) => (unassigned ? !id : person ? id === person.id : true);
      const tickets =
        kind === "bugs" || f.severity?.length
          ? []
          : g.tickets.filter((t) => {
              const ft = featureOf(g, t);
              return who(t.assigneeId) && (!st || st.has(t.status)) && (!rel || ft.releaseId === rel.id) && (!mod || ft.moduleId === mod.id) && (!feat || ft.id === feat.id);
            });
      const bugs =
        kind === "tickets" || feat
          ? []
          : g.bugs
              .filter((b) => who(b.assigneeId) && (!st || st.has(b.status)) && (!rel || b.releaseId === rel.id) && (!mod || b.moduleId === mod.id) && (!f.severity?.length || f.severity.includes(b.severity)))
              .sort((x, y) => SEV_ORDER.indexOf(x.severity) - SEV_ORDER.indexOf(y.severity));
      const order: Status[] = ["dev", "qa", "todo", "done"];
      tickets.sort((x, y) => order.indexOf(x.status) - order.indexOf(y.status));
      return {
        filters: { assignee: person?.name ?? (unassigned ? "unassigned" : undefined), release: rel?.version, module: mod?.name, feature: feat?.key, status: f.status ?? undefined },
        ticketCount: tickets.length,
        bugCount: bugs.length,
        tickets: tickets.slice(0, limit).map((t) => ticketRow(g, t)),
        bugs: bugs.slice(0, limit).map((b) => bugRow(g, b)),
        truncated: tickets.length > limit || bugs.length > limit ? `Showing ${limit} of each; counts above are complete.` : undefined,
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
    run: (a, c) => {
      const { key } = parse(z.object({ key: z.string().min(1).max(200) }), a);
      const g = c.g;
      const it = findItem(g, key);
      const id = it.v.id;
      const comments = g.comments
        .filter((cm) => cm.target.id === id)
        .slice(-12)
        .map((cm) => ({ by: personName(g, cm.authorId), at: stamp(cm.createdAt), text: cm.body.slice(0, 600), files: cm.attachments.map((x) => x.name) }));
      const history = g.activity
        .filter((x) => x.target.id === id)
        .slice(-20)
        .map((x) => ({
          at: stamp(x.at),
          by: personName(g, x.actorId),
          change: x.kind === "created" ? "created it" : x.kind === "status" ? `status ${STATUS_WORD[x.from as Status] ?? x.from} → ${STATUS_WORD[x.to as Status] ?? x.to}` : `assignee ${personName(g, x.from)} → ${personName(g, x.to)}`,
        }));
      if (it.kind === "ticket") {
        const t = it.v;
        return { kind: "ticket", ...ticketRow(g, t), createdAt: stamp(t.createdAt), createdBy: personName(g, t.createdBy), comments, history };
      }
      if (it.kind === "bug") {
        const b = it.v;
        return { kind: "bug", ...bugRow(g, b), createdAt: stamp(b.createdAt), createdBy: personName(g, b.createdBy), comments, history };
      }
      const f = it.v;
      const chain: string[] = [];
      for (let cur: Feature | undefined = f; cur && chain.length < 12; cur = cur.extendsId ? g.features.find((x) => x.id === cur!.extendsId) : undefined) chain.unshift(`${releaseOf(g, cur.releaseId).version} ${cur.key} ${cur.name}`);
      const later = g.features.filter((x) => x.extendsId === f.id).map((x) => `${releaseOf(g, x.releaseId).version} ${x.key}`);
      return {
        kind: "feature",
        ...featureRow(g, f),
        spec: f.spec.length > 2500 ? `${f.spec.slice(0, 2500)}… (cut)` : f.spec,
        createdAt: stamp(f.createdAt),
        createdBy: personName(g, f.createdBy),
        versionChain: chain,
        continuedIn: later,
        tickets: ticketsOf(g, f.id).map((t) => ({ key: t.key, title: t.title, status: STATUS_WORD[t.status], assignee: personName(g, t.assigneeId) })),
        comments,
        history,
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
    run: (a, c) => {
      const { release } = parse(z.object({ release: optStr }), a);
      const g = c.g;
      const r = findRelease(g, release, c);
      const feats = g.features.filter((f) => f.releaseId === r.id);
      const ids = new Set(feats.map((f) => f.id));
      const ts = g.tickets.filter((t) => ids.has(t.featureId));
      const bugs = g.bugs.filter((b) => b.releaseId === r.id);
      const open = ts.filter((t) => t.status !== "done");
      const p = progress(ts);
      const byStatus = Object.fromEntries((["todo", "dev", "qa", "done"] as Status[]).map((s) => [STATUS_WORD[s], ts.filter((t) => t.status === s).length]));
      const load = new Map<string, number>();
      for (const t of open) load.set(personName(g, t.assigneeId), (load.get(personName(g, t.assigneeId)) ?? 0) + 1);
      const daysLeft = Math.round((Date.parse(r.date) - Date.parse(new Date().toISOString().slice(0, 10))) / 86400000);
      return {
        release: `${r.version} · ${r.name}`,
        state: r.state,
        targetDate: r.date,
        daysLeft,
        progress: `${p.done}/${p.total} tickets done (${p.pct}%)`,
        pointsDone: `${ts.filter((t) => t.status === "done").reduce((s, t) => s + t.points, 0)}/${ts.reduce((s, t) => s + t.points, 0)}`,
        ticketsByStatus: byStatus,
        openBugs: bugs.filter((b) => b.status !== "done").sort((x, y) => SEV_ORDER.indexOf(x.severity) - SEV_ORDER.indexOf(y.severity)).map((b) => bugRow(g, b)),
        unassignedOpenTickets: open.filter((t) => !t.assigneeId).map((t) => ({ key: t.key, title: t.title })),
        stillTodo: open.filter((t) => t.status === "todo").slice(0, 20).map((t) => ({ key: t.key, title: t.title, assignee: personName(g, t.assigneeId) })),
        features: feats.map((f) => featureRow(g, f)),
        openTicketsPerPerson: Object.fromEntries([...load].sort((x, y) => y[1] - x[1])),
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
    run: (a, c) => {
      const { from, to } = parse(z.object({ from: z.string().min(1), to: z.string().min(1) }), a);
      const g = c.g;
      let x = findRelease(g, from);
      let y = findRelease(g, to);
      if (x.date > y.date) [x, y] = [y, x];
      const between = g.releases.filter((r) => r.date > x.date && r.date <= y.date).sort((p, q) => p.date.localeCompare(q.date));
      return {
        from: x.version,
        to: y.version,
        releases: between.map((r) => ({
          version: r.version,
          name: r.name,
          date: r.date,
          state: r.state,
          features: g.features.filter((f) => f.releaseId === r.id).map((f) => ({ ...featureRow(g, f), buildsOn: f.extendsId ? (g.features.find((p) => p.id === f.extendsId)?.key ?? null) : "new" })),
        })),
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
    run: (a, c) => {
      const { person, release } = parse(z.object({ person: z.string().min(1), release: optStr }), a);
      const g = c.g;
      const p = findPerson(c, person);
      const r = release ? findRelease(g, release) : undefined;
      const inRel = (fid: string) => !r || g.features.find((f) => f.id === fid)?.releaseId === r.id;
      const mine = g.tickets.filter((t) => t.assigneeId === p.id && inRel(t.featureId));
      const bugs = g.bugs.filter((b) => b.assigneeId === p.id && b.status !== "done" && (!r || b.releaseId === r.id));
      return {
        person: p.name,
        role: p.role,
        release: r?.version ?? "all releases",
        openTickets: mine.filter((t) => t.status !== "done").map((t) => ticketRow(g, t)),
        doneTickets: mine.filter((t) => t.status === "done").length,
        openPoints: mine.filter((t) => t.status !== "done").reduce((s, t) => s + t.points, 0),
        openBugs: bugs.map((b) => bugRow(g, b)),
        ownsFeatures: g.features.filter((f) => f.ownerId === p.id && (!r || f.releaseId === r.id)).map((f) => `${f.key} ${f.name}`),
        recentChanges: recentActivity(g, { actor: p.id, limit: 10 }),
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
    run: (a, c) => {
      const f = parse(z.object({ person: optStr, since: optStr, until: optStr, limit: z.number().int().min(1).max(50).optional().nullable() }), a);
      const p = f.person ? findPerson(c, f.person) : undefined;
      for (const d of [f.since, f.until]) if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) fail(`Dates must be YYYY-MM-DD, got "${d}".`);
      const list = recentActivity(c.g, { actor: p?.id, since: f.since, until: f.until, limit: f.limit ?? 20 });
      return { person: p?.name, since: f.since, until: f.until, count: list.length, changes: list };
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
    run: (a, c) => {
      const { module } = parse(z.object({ module: z.string().min(1) }), a);
      const g = c.g;
      const m = findModule(g, module);
      const feats = g.features.filter((f) => f.moduleId === m.id).sort((x, y) => releaseOf(g, x.releaseId).date.localeCompare(releaseOf(g, y.releaseId).date));
      const bugs = g.bugs.filter((b) => b.moduleId === m.id);
      return {
        module: m.name,
        features: feats.map((f) => featureRow(g, f)),
        bugs: { total: bugs.length, open: bugs.filter((b) => b.status !== "done").map((b) => bugRow(g, b)) },
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
      const rows = await db
        .select({ name: schema.users.name, email: schema.users.email, role: schema.members.role, title: schema.members.title, joinedAt: schema.members.joinedAt })
        .from(schema.members)
        .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
        .where(eq(schema.members.workspaceId, c.workspaceId))
        .orderBy(asc(schema.members.joinedAt));
      const invites = admin
        ? await db
            .select({ email: schema.invites.email, role: schema.invites.role, expiresAt: schema.invites.expiresAt })
            .from(schema.invites)
            .where(and(eq(schema.invites.workspaceId, c.workspaceId), eq(schema.invites.status, "pending")))
        : [];
      return {
        members: rows.map((r) => ({ name: r.name, access: r.role, title: r.title ?? undefined, joined: day(r.joinedAt.toISOString()), email: admin ? r.email : undefined })),
        pendingInvites: admin ? invites.map((i) => ({ email: i.email, role: i.role, expires: day(i.expiresAt.toISOString()), expired: i.expiresAt < new Date() })) : "Only admins can see invites.",
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
      const used = (await db.select({ u: schema.members.userId }).from(schema.members).where(eq(schema.members.workspaceId, c.workspaceId))).length;
      return {
        plan: w.plan,
        seats: w.seats,
        seatsUsed: used,
        paidUntil: w.paidUntil ? day(w.paidUntil.toISOString()) : null,
        card: w.cardLast4 ? `${w.cardBrand} ending ${w.cardLast4}, expires ${w.cardExp}` : null,
        payments: pays.map((p) => ({ date: day(p.createdAt.toISOString()), plan: p.plan, seats: p.seats, amount: `${(p.amountCents / 100).toFixed(2)} ${p.currency.toUpperCase()}`, tax: `${(p.taxCents / 100).toFixed(2)}`, status: p.status, reason: p.failureReason ?? undefined })),
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
    run: (a, c) => {
      const { item, status } = parse(z.object({ item: z.string().min(1), status: z.enum(["todo", "dev", "qa", "done"]) }), a);
      const it = findItem(c.g, item, ["ticket", "bug"]);
      const v = it.v as Ticket | Bug;
      if (v.status === status) fail(`${v.key} is already ${STATUS_WORD[status]}. Nothing to change.`);
      return propose(c, {
        action: it.kind === "ticket" ? { type: "ticketStatus", id: v.id, status } : { type: "bugStatus", id: v.id, status },
        expect: { kind: it.kind as "ticket" | "bug", id: v.id, field: "status", value: v.status },
        title: `Move ${v.key} to ${STATUS_WORD[status]}`,
        lines: [`"${v.title}"`, `Status: ${STATUS_WORD[v.status]} → ${STATUS_WORD[status]}`],
        key: v.key,
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
    run: (a, c) => {
      const { ticket, person } = parse(z.object({ ticket: z.string().min(1), person: z.string().min(1) }), a);
      if (c.g.bugs.some((b) => b.key.toUpperCase() === ticket.trim().toUpperCase())) fail("Bugs can't be reassigned from Ask Zelo yet. Tell the person to open the bug and change it there.");
      const t = findItem(c.g, ticket, ["ticket"]).v as Ticket;
      const nobody = ["nobody", "no one", "unassigned", "none", "unassign"].includes(lc(person));
      const p = nobody ? null : findPerson(c, person);
      if ((p?.id ?? null) === t.assigneeId) fail(`${t.key} is already ${p ? `assigned to ${p.name}` : "unassigned"}.`);
      return propose(c, {
        action: { type: "ticketAssignee", id: t.id, assigneeId: p?.id ?? null },
        expect: { kind: "ticket", id: t.id, field: "assigneeId", value: t.assigneeId },
        title: p ? `Assign ${t.key} to ${p.name}` : `Unassign ${t.key}`,
        lines: [`"${t.title}"`, `Assignee: ${personName(c.g, t.assigneeId)} → ${p?.name ?? "Unassigned"}`],
        key: t.key,
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
    run: (a, c) => {
      const f0 = parse(z.object({ feature: z.string().min(1), title: z.string().trim().min(3).max(200), assignee: optStr }), a);
      const f = findItem(c.g, f0.feature, ["feature"]).v as Feature;
      const nobody = f0.assignee && ["nobody", "no one", "unassigned", "none"].includes(lc(f0.assignee));
      const p = nobody ? null : f0.assignee ? findPerson(c, f0.assignee) : (c.g.people.find((x) => x.id === c.user.id) ?? null);
      const dup = ticketsOf(c.g, f.id).find((t) => lc(t.title) === lc(f0.title));
      if (dup) fail(`${f.key} already has a ticket with that title: ${dup.key}. Ask if they still want a second one.`);
      return propose(c, {
        action: { type: "addTicket", id: randomUUID(), featureId: f.id, title: f0.title, assigneeId: p?.id ?? null },
        expect: null,
        title: "Create a ticket",
        lines: [`"${f0.title}"`, `Feature: ${f.key} ${f.name} (${releaseOf(c.g, f.releaseId).version})`, `Assignee: ${p?.name ?? "Unassigned"}`],
        key: f.key,
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
      const f0 = parse(z.object({ release: z.string().min(1), title: z.string().trim().min(3).max(200) }), a);
      const r = findRelease(c.g, f0.release);
      return propose(c, {
        action: { type: "addMiscTicket", id: randomUUID(), releaseId: r.id, title: f0.title },
        expect: null,
        title: "Create a chore",
        lines: [`"${f0.title}"`, `Release: ${r.version} · Housekeeping`, `Assignee: ${c.user.name}`],
        key: null,
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
    run: (a, c) => {
      const f0 = parse(z.object({ release: z.string().min(1), module: z.string().min(1), name: z.string().trim().min(2).max(120), owner: optStr, spec: z.string().max(20_000).optional().nullable() }), a);
      const r = findRelease(c.g, f0.release);
      const m = findModule(c.g, f0.module);
      if (m.misc) fail("Features can't go in the Miscellaneous module. Use create_chore for chores.");
      const nobody = !f0.owner || ["nobody", "no one", "none"].includes(lc(f0.owner));
      const p = nobody ? null : findPerson(c, f0.owner!);
      const dup = c.g.features.find((f) => f.releaseId === r.id && f.moduleId === m.id && lc(f.name) === lc(f0.name));
      if (dup) fail(`${r.version} already has "${dup.name}" in ${m.name}: ${dup.key}.`);
      return propose(c, {
        action: { type: "addFeature", id: randomUUID(), releaseId: r.id, moduleId: m.id, name: f0.name, ownerId: p?.id ?? null, spec: f0.spec ?? "" },
        expect: null,
        title: "Create a feature",
        lines: [`"${f0.name}"`, `${r.version} · ${m.name}`, `Owner: ${p?.name ?? "Nobody"}`, ...(f0.spec ? [`Spec: ${f0.spec.slice(0, 120)}${f0.spec.length > 120 ? "…" : ""}`] : [])],
        key: null,
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
      const dup = c.g.releases.find((r) => bare(r.version) === bare(f0.version));
      if (dup) fail(`Release ${dup.version} already exists.`);
      const cur = c.g.releases.find((r) => r.state === "current");
      return propose(c, {
        action: { type: "addRelease", id: randomUUID(), version: f0.version, name: f0.name ?? "", date: f0.date, state: f0.state },
        expect: null,
        title: `Create release ${f0.version}`,
        lines: [`${f0.version}${f0.name ? ` · ${f0.name}` : ""}`, `Target: ${f0.date} · ${f0.state}`, ...(f0.state === "current" && cur ? [`${cur.version} will be marked shipped`] : [])],
        key: null,
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
      const dup = c.g.modules.find((m) => lc(m.name) === lc(name));
      if (dup) fail(`A module called ${dup.name} already exists.`);
      return propose(c, { action: { type: "addModule", id: randomUUID(), name }, expect: null, title: `Create module ${name}`, lines: [`Module: ${name}`], key: null });
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
    run: (a, c) => {
      const { item, text } = parse(z.object({ item: z.string().min(1), text: z.string().trim().min(1).max(5000) }), a);
      const it = findItem(c.g, item);
      return propose(c, {
        action: { type: "addComment", id: randomUUID(), target: { kind: it.kind, id: it.v.id }, body: text, attachmentIds: [] },
        expect: null,
        title: `Comment on ${it.v.key}`,
        lines: [`"${text.length > 200 ? `${text.slice(0, 200)}…` : text}"`, `Posted as ${c.user.name}`],
        key: it.v.key,
      });
    },
  },
};

function propose(c: ToolCtx, p: { action: unknown; expect: Proposal["expect"]; title: string; lines: string[]; key: string | null }) {
  if (c.proposals.length >= 8) fail("That's already 8 changes in one go. Ask the person to confirm these first.");
  const action = Action.parse(p.action); // the exact schema the UI's own changes go through
  const prop: Proposal = { id: randomUUID(), action, expect: p.expect, title: p.title, lines: p.lines, card: p.key ? cardFor(c.g, p.key) : null };
  c.proposals.push(prop);
  return { status: "waiting_for_confirmation", change: p.title, details: p.lines, note: "Not done yet: the person must press Confirm on the card. Don't say it's done." };
}

function recentActivity(g: Graph, f: { actor?: string; since?: string; until?: string; limit: number }) {
  return [...g.activity]
    .filter((x) => (!f.actor || x.actorId === f.actor) && (!f.since || day(x.at) >= f.since) && (!f.until || day(x.at) <= f.until))
    .sort((x, y) => y.at.localeCompare(x.at))
    .slice(0, f.limit)
    .map((x) => {
      const t = x.target.kind === "ticket" ? g.tickets.find((i) => i.id === x.target.id) : x.target.kind === "bug" ? g.bugs.find((i) => i.id === x.target.id) : g.features.find((i) => i.id === x.target.id);
      const label = t ? `${t.key} "${"title" in t ? t.title : t.name}"` : "a deleted item";
      const what = x.kind === "created" ? "created" : x.kind === "status" ? `moved to ${STATUS_WORD[x.to as Status] ?? x.to} (from ${STATUS_WORD[x.from as Status] ?? x.from})` : x.to ? `assigned to ${personName(g, x.to)}` : "unassigned";
      return { at: stamp(x.at), by: personName(g, x.actorId), item: label, what };
    });
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
  const tool = TOOLS[name];
  let args: unknown = {};
  try {
    args = rawArgs?.trim() ? JSON.parse(rawArgs) : {};
  } catch {
    return { ok: false, args: rawArgs, result: { error: "Arguments were not valid JSON. Call the tool again with valid JSON." } };
  }
  if (!tool) return { ok: false, args, result: { error: `There is no tool called ${name}.` } };
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
