import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { graph, sql, workspace, type Client } from "./helpers";

/**
 * Ask Zelo on a big board: 2,000 features, 30,000 tickets, 3,000 bugs, 20,000 comments,
 * 100,000 activity rows and 50 people. Every tool must stay fast, return exact counts, and keep
 * its result small enough for the model. Runs against the scripted mock Groq on :3399.
 */

type Msg = { role: string; content: string | null; tool_calls?: unknown[] };
type Req = { messages: Msg[]; tools?: unknown[] };
const calls: Req[] = [];
let script: (step: number) => unknown[] = () => text("ok");

const text = (s: string) => [
  ...(s.match(/[\s\S]{1,40}/g) ?? [""]).map((p) => ({ choices: [{ index: 0, delta: { content: p } }] })),
  { choices: [{ index: 0, delta: {}, finish_reason: "stop" }], x_groq: { usage: { prompt_tokens: 10, completion_tokens: 5 } } },
];
const tools = (...list: [string, unknown][]) => [
  { choices: [{ index: 0, delta: { tool_calls: list.map(([name, args], i) => ({ index: i, id: `c${i}`, type: "function", function: { name, arguments: JSON.stringify(args) } })) } }] },
  { choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] },
];

let server: Server;
beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const r = JSON.parse(body) as Req;
      calls.push(r);
      const lastUser = r.messages.map((m, i) => [m, i] as const).filter(([m]) => m.role === "user" && !m.content?.startsWith("(System")).pop()![1];
      const step = r.messages.slice(lastUser + 1).filter((m) => m.role === "assistant" && m.tool_calls).length;
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end([...(r.messages.at(-1)?.content?.startsWith("(System check") ? text("Fixed.") : script(step))].map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n");
    });
  });
  await new Promise<void>((ok) => server.listen(3399, ok));
});
afterAll(() => new Promise<void>((ok) => server.close(() => ok())));

let w: Awaited<ReturnType<typeof workspace>>;
let P = "";
const timings: [string, number][] = [];

async function ask(c: Client, message: string) {
  calls.length = 0;
  const t0 = performance.now();
  const r = await c.post(`/api/workspaces/${w.id}/ask`, { message, view: { scope: "all", selected: null, personId: null } });
  const ms = performance.now() - t0;
  expect(r.status).toBe(200);
  const events = String(r.body).split("\n\n").filter(Boolean).map((b) => ({ event: /event: (.*)/.exec(b)?.[1], data: JSON.parse(/data: (.*)/.exec(b)?.[1] ?? "{}") }));
  expect(events.find((e) => e.event === "error")).toBeUndefined();
  const results = calls.flatMap((c) => c.messages.filter((m) => m.role === "tool").map((m) => m.content ?? ""));
  return { ms, done: events.find((e) => e.event === "done")!.data.message, results: [...new Set(results)], prompt: calls[0].messages[0].content ?? "" };
}

describe("Ask Zelo on a large board", () => {
  beforeAll(async () => {
    w = await workspace();
    [{ id: P }] = await sql<{ id: string }>(`select id from products where workspace_id = $1`, [w.id]);
    const tag = Date.now().toString(36);
    const t0 = performance.now();
    await sql(`insert into users (email, name) select 'scale' || g || '.${tag}@test.zelo', 'Person ' || g || ' ${tag}' from generate_series(1, 50) g`);
    await sql(`insert into members (workspace_id, user_id, role, color) select $1, id, 'member', '#333333' from users where email like 'scale%.${tag}@test.zelo'`, [w.id]);
    await sql(`update releases set state = 'shipped' where product_id = $1`, [P]);
    await sql(`insert into releases (product_id, version, name, target_date, state) select $1, 'v' || g || '.5', 'Release ' || g, date '2025-01-01' + g * 20, case when g < 29 then 'shipped' when g = 29 then 'current' else 'planned' end from generate_series(1, 30) g`, [P]);
    await sql(`insert into modules (product_id, name, color, key_prefix, position) select $1, 'Area ' || chr(64 + g), '#333333', 'Q' || chr(64 + g), g from generate_series(1, 12) g`, [P]);
    await sql(
      `with m as (select id, key_prefix, row_number() over (order by key_prefix) - 1 as i from modules where product_id = $1 and key_prefix like 'Q%'),
            r as (select id, row_number() over (order by target_date) - 1 as i from releases where product_id = $1 and version like '%.5')
       insert into features (product_id, module_id, release_id, key, name, spec)
       select $1, m.id, r.id, m.key_prefix || '-' || (1000 + g), 'Feature ' || g || ' ' || (array['checkout','search','refund','login','report','export'])[1 + g % 6], repeat('Spec text for feature ' || g || '. ', 40)
       from generate_series(0, 1999) g join m on m.i = g % 12 join r on r.i = g % 30`,
      [P],
    );
    await sql(
      `with f as (select id, key, row_number() over (order by key) - 1 as i from features where product_id = $1 and key ~ '^Q'),
            u as (select array_agg(user_id) a from members where workspace_id = $2)
       insert into tickets (product_id, feature_id, key, title, status, points, assignee_id)
       select $1, f.id, split_part(f.key, '-', 1) || '-' || (100000 + g), 'Task ' || g || ' for ' || f.key, (array['todo','dev','qa','done'])[1 + g % 4], 1 + g % 5,
              case when g % 7 = 0 then null else u.a[1 + g % array_length(u.a, 1)] end
       from generate_series(0, 29999) g join f on f.i = g % 2000 cross join u`,
      [P, w.id],
    );
    await sql(`update tickets set title = 'Zebra unicorn migration' where product_id = $1 and key = 'QA-100012'`, [P]);
    await sql(
      `with m as (select id, key_prefix, row_number() over (order by key_prefix) - 1 as i from modules where product_id = $1 and key_prefix like 'Q%'),
            r as (select id, row_number() over (order by target_date) - 1 as i from releases where product_id = $1 and version like '%.5')
       insert into bugs (product_id, module_id, release_id, key, title, status, severity)
       select $1, m.id, r.id, m.key_prefix || '-' || (200000 + g), 'Bug ' || g, (array['todo','dev','qa','done'])[1 + g % 4], (array['critical','high','medium','low'])[1 + g % 4]
       from generate_series(0, 2999) g join m on m.i = g % 12 join r on r.i = g % 30`,
      [P],
    );
    await sql(
      `with t as (select id, row_number() over (order by key) as n from tickets where product_id = $1), u as (select array_agg(user_id) a from members where workspace_id = $2)
       insert into comments (product_id, target_kind, target_id, author_id, body)
       select $1, 'ticket', t.id, u.a[1 + t.n % array_length(u.a, 1)], 'Comment ' || t.n || ' about the deploy pipeline' from t cross join u where t.n <= 20000`,
      [P, w.id],
    );
    await sql(
      `with t as (select id, row_number() over (order by key) - 1 as i from tickets where product_id = $1), u as (select array_agg(user_id) a from members where workspace_id = $2)
       insert into activity (product_id, target_kind, target_id, actor_id, kind, from_value, to_value, at)
       select $1, 'ticket', t.id, u.a[1 + g % array_length(u.a, 1)], 'status', 'todo', 'dev', now() - (g || ' minutes')::interval
       from generate_series(1, 100000) g join t on t.i = g % 30000 cross join u`,
      [P, w.id],
    );
    await sql(`update products set version = version + 1 where id = $1`, [P]);
    await sql(`analyze tickets; analyze bugs; analyze features; analyze comments; analyze activity`);
    console.log(`  seeded the big board in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
  }, 180_000);

  afterAll(() => {
    console.log("\n  Ask Zelo latency on a 30k-ticket board (whole request incl. DB, excl. model time):");
    for (const [name, ms] of timings) console.log(`    ${name.padEnd(42)} ${ms.toFixed(0).padStart(5)} ms`);
  });

  it("the prompt's board summary is exact and bounded", async () => {
    script = () => text("Hi.");
    const r = await ask(w.owner.c, "hello");
    timings.push(["summary + prompt (first, uncached)", r.ms]);
    const [t] = await sql<{ f: number; t: number; o: number; b: number; ob: number }>(
      `select (select count(*)::int from features where product_id = $1) f, (select count(*)::int from tickets where product_id = $1) t,
              (select count(*)::int from tickets where product_id = $1 and status <> 'done') o, (select count(*)::int from bugs where product_id = $1) b,
              (select count(*)::int from bugs where product_id = $1 and status <> 'done') ob`,
      [P],
    );
    expect(r.prompt).toContain(`Totals: ${t.f} features, ${t.t} tickets (${t.o} open,`);
    expect(r.prompt).toContain(`${t.b} bugs (${t.ob} open)`);
    expect(r.prompt).toContain("busiest 40 shown");
    expect(r.prompt.length).toBeLessThan(12_000); // bounded no matter how big the board is
    const again = await ask(w.owner.c, "hello again");
    timings.push(["summary + prompt (cached)", again.ms]);
  });

  it("list_work returns exact counts and a capped list", async () => {
    script = (s) => (s === 0 ? tools(["list_work", { kind: "both", status: ["todo", "dev"], module: "Area C", limit: 60 }]) : text("Listed."));
    const r = await ask(w.owner.c, "open work in Area C");
    timings.push(["list_work (module + status filter)", r.ms]);
    const res = JSON.parse(r.results[0]);
    const [truth] = await sql<{ t: number; b: number }>(
      `select (select count(*)::int from tickets t join features f on f.id = t.feature_id join modules m on m.id = f.module_id where t.product_id = $1 and m.name = 'Area C' and t.status in ('todo','dev')) t,
              (select count(*)::int from bugs b join modules m on m.id = b.module_id where b.product_id = $1 and m.name = 'Area C' and b.status in ('todo','dev')) b`,
      [P],
    );
    expect(res.ticketCount).toBe(truth.t);
    expect(res.bugCount).toBe(truth.b);
    expect(res.tickets).toHaveLength(60);
    expect(res.truncated).toMatch(/counts are exact/);
  });

  it("full-text search finds one ticket among 30,000 (by prefix too)", async () => {
    script = (s) => (s === 0 ? tools(["search", { query: "zebra unic" }]) : text("Found QA-100012."));
    const r = await ask(w.owner.c, "find the zebra thing");
    timings.push(["search (full text, prefix)", r.ms]);
    expect(JSON.parse(r.results[0]).results[0]).toMatchObject({ key: "QA-100012", title: "Zebra unicorn migration" });
    expect(r.done.cards[0].sub).toContain("QA-100012");
  });

  it("every read tool stays fast and small on the big board", async () => {
    const plan: [string, string, unknown][] = [
      ["release_status (current)", "release_status", {}],
      ["get_item (feature with 15 tickets)", "get_item", { key: "QA-1000" }],
      ["get_item (ticket with comments)", "get_item", { key: "QA-100012" }],
      ["person_workload", "person_workload", { person: "Person 7" }],
      ["activity (last 50)", "activity", { limit: 50 }],
      ["activity (one person, date range)", "activity", { person: "Person 41", since: "2020-01-01", until: "2030-01-01", limit: 50 }],
      ["module_history (167 features)", "module_history", { module: "Area B" }],
      ["compare_releases (10 releases)", "compare_releases", { from: "v10.5", to: "v20.5" }],
      ["search comments", "search", { query: "deploy pipeline", kinds: ["comment"] }],
      ["team (51 people)", "team", {}],
    ];
    for (const [label, name, args] of plan) {
      script = (s) => (s === 0 ? tools([name, args]) : text("Done."));
      const r = await ask(w.owner.c, `run ${name}`);
      timings.push([label, r.ms]);
      const out = r.results[0];
      expect(out, label).not.toContain('"error"');
      expect(out.length, `${label} result size`).toBeLessThan(12_000); // never needs the agent's emergency cut
      expect(r.ms, `${label} latency`).toBeLessThan(1500);
    }
  }, 120_000);

  it("person_workload counts are exact even when the list is capped", async () => {
    script = (s) => (s === 0 ? tools(["person_workload", { person: "Person 7" }]) : text("Done."));
    const r = await ask(w.owner.c, "Person 7 workload");
    const res = JSON.parse(r.results[0]);
    const [truth] = await sql<{ n: number }>(`select count(*)::int n from tickets t join users u on u.id = t.assignee_id where t.product_id = $1 and u.name like 'Person 7 %' and t.status <> 'done'`, [P]);
    expect(res.openTicketCount).toBe(truth.n);
    expect(res.openTickets.length).toBeLessThanOrEqual(40);
  });

  it("the made-up-key guard and cards work with batched lookups", async () => {
    script = () => text("Look at QA-100012, QA-100013 and QA-99999.");
    const r = await ask(w.owner.c, "anything risky?");
    timings.push(["guard + cards (3 keys)", r.ms]);
    expect(r.done.content).toBe("Fixed."); // QA-99999 doesn't exist → rewrite
  });

  it("for comparison: the canvas endpoint loads the whole board", async () => {
    const t0 = performance.now();
    const g = await graph(w.owner.c, w.id);
    timings.push([`GET /graph, whole board (${g.graph.tickets.length} tickets)`, performance.now() - t0]);
    expect(g.graph.tickets.length).toBeGreaterThanOrEqual(30_000);
  }, 60_000);
});
