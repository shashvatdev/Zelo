import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { act, addMember, graph, sql, workspace, type Client } from "./helpers";

/**
 * Ask Zelo end to end against a scripted mock of Groq's streaming API (port 3399; the test server
 * is started with GROQ_BASE_URL pointing here). The mock decides what the "model" does from the
 * conversation it receives, so the real agent loop, tools, guard and proposals all run.
 */

type Req = { model: string; messages: { role: string; content: string | null; tool_calls?: unknown[] }[]; tools?: { function: { name: string } }[] };
const calls: Req[] = [];
let failModels = new Set<string>();
let limitModels = new Set<string>();

function sse(chunks: unknown[]) {
  return chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
}
const text = (s: string) => [
  { choices: [{ index: 0, delta: { role: "assistant", content: "" } }] },
  ...(s.match(/[\s\S]{1,12}/g) ?? []).map((p) => ({ choices: [{ index: 0, delta: { content: p } }] })),
  { choices: [{ index: 0, delta: {}, finish_reason: "stop" }], x_groq: { usage: { prompt_tokens: 100, completion_tokens: 20 } } },
];
const tool = (name: string, args: unknown) => [
  { choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: `call_${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] } }] },
  { choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }], x_groq: { usage: { prompt_tokens: 80, completion_tokens: 10 } } },
];

/** The scripted "model". */
function respond(r: Req): unknown[] {
  const msgs = r.messages;
  const lastUser = [...msgs].reverse().find((m) => m.role === "user")!.content ?? "";
  const toolMsgs = msgs.filter((m) => m.role === "tool");
  const lastTool = toolMsgs.length ? JSON.parse(toolMsgs[toolMsgs.length - 1].content ?? "{}") : null;
  if (lastUser.startsWith("(System check: no change card")) return text("Want me to move it? Just say the word.");
  if (lastUser.startsWith("(System check:")) return text("Sorry, I couldn't find that ticket.");
  let m: RegExpMatchArray | null;
  if ((m = lastUser.match(/^status of (\S+)/))) {
    if (!lastTool) return tool("get_item", { key: m[1] });
    // Real models often write keys with a non-breaking hyphen (U+2011); the server must normalise it.
    return text(lastTool.error ? `Hmm: ${lastTool.error}` : `**${lastTool.key.replace("-", "\u2011")}** is ${lastTool.status}, assigned to ${lastTool.assignee}.`);
  }
  if ((m = lastUser.match(/^move (\S+) to (\w+)/))) {
    if (!lastTool) return tool("set_status", { item: m[1], status: m[2] });
    return text(lastTool.error ? `Can't: ${lastTool.error}` : "Ready for you to confirm below.");
  }
  if ((m = lastUser.match(/^assign (\S+) to (.+)$/))) {
    if (!lastTool) return tool("assign_ticket", { ticket: m[1], person: m[2] });
    return text(lastTool.error ? `Which one? ${lastTool.error}` : "Ready to confirm.");
  }
  if (lastUser.startsWith("billing")) {
    if (!lastTool) return tool("billing", {});
    return text(lastTool.error ? lastTool.error : `You're on ${lastTool.plan}.`);
  }
  if (lastUser.startsWith("invent")) return text("Sure, PAY-999 is blocking everything.");
  if (lastUser.startsWith("fake card")) return text("The card is ready, bas “Confirm” dabao!");
  if (lastUser.startsWith("what did I ask")) return text(`You said: ${msgs.filter((x) => x.role === "user").length} messages so far.`);
  return text("Hey! Ask me about the board.");
}

let server: Server;
beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const r = JSON.parse(body) as Req;
      calls.push(r);
      if (req.headers.authorization !== "Bearer test-key") {
        res.writeHead(401).end("bad key");
        return;
      }
      if (limitModels.has(r.model)) {
        res.writeHead(429, { "Content-Type": "application/json" }).end(JSON.stringify({ error: { message: "Rate limit reached on tokens per minute (TPM). Please try again in 30.5s." } }));
        return;
      }
      if (failModels.has(r.model)) {
        res.writeHead(503, { "Content-Type": "application/json" }).end(JSON.stringify({ error: { message: "over capacity" } }));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end(sse(respond(r)));
    });
  });
  await new Promise<void>((ok) => server.listen(3399, ok));
});
afterAll(() => new Promise<void>((ok) => server.close(() => ok())));
beforeEach(() => {
  calls.length = 0;
  failModels = new Set();
  limitModels = new Set();
});

type Ev = { event: string; data: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
async function ask(c: Client, wsId: string, message: string, conversationId?: string) {
  const r = await c.post(`/api/workspaces/${wsId}/ask`, { message, conversationId, view: { scope: "all", selected: null, personId: null } });
  if (r.status !== 200) return { status: r.status, body: r.body, events: [] as Ev[], done: null as any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const events: Ev[] = String(r.body)
    .split("\n\n")
    .filter(Boolean)
    .map((b) => {
      const ev = /event: (.*)/.exec(b)?.[1] ?? "";
      const data = JSON.parse(/data: (.*)/.exec(b)?.[1] ?? "{}");
      return { event: ev, data };
    });
  return { status: 200, body: r.body, events, done: events.find((e) => e.event === "done")?.data.message, meta: events.find((e) => e.event === "meta")?.data };
}

async function board() {
  const w = await workspace();
  const { graph: g } = await graph(w.owner.c, w.id);
  const rel = g.releases[0];
  const pay = g.modules.find((m) => m.name === "Payments")!;
  const f = (await act(w.owner.c, w.id, { type: "addFeature", releaseId: rel.id, moduleId: pay.id, name: "Refunds", ownerId: w.owner.id, spec: "Let shoppers get money back" })).body.graph.features[0];
  const t1 = crypto.randomUUID();
  const t2 = crypto.randomUUID();
  await act(w.owner.c, w.id, { type: "addTicket", id: t1, featureId: f.id, title: "Refund API", assigneeId: w.owner.id });
  await act(w.owner.c, w.id, { type: "addTicket", id: t2, featureId: f.id, title: "Refund email", assigneeId: null });
  const { graph: g2 } = await graph(w.owner.c, w.id);
  const tk = (id: string) => g2.tickets.find((t) => t.id === id)!;
  return { ...w, f, t1: tk(t1), t2: tk(t2) };
}

describe("Ask Zelo", () => {
  it("answers from a tool call, streams, saves the chat and builds cards from real rows", async () => {
    const b = await board();
    const r = await ask(b.owner.c, b.id, `status of ${b.t1.key}`);
    expect(r.status).toBe(200);
    expect(r.events.map((e) => e.event)).toEqual(expect.arrayContaining(["meta", "status", "delta", "done"]));
    expect(r.done.content).toBe(`**${b.t1.key}** is To do, assigned to Owner.`);
    expect(r.done.cards).toHaveLength(1);
    expect(r.done.cards[0].go.selected).toEqual({ kind: "ticket", id: b.t1.id });
    // The model got tools and the board snapshot.
    expect(calls[0].tools!.map((t) => t.function.name)).toEqual(expect.arrayContaining(["get_item", "list_work", "set_status"]));
    expect(calls[0].messages[0].content).toContain("Product: Test App");
    // Saved with token usage.
    const conv = await b.owner.c.get(`/api/workspaces/${b.id}/ask/${r.meta!.conversationId}`);
    expect(conv.body.messages.map((m: { role: string }) => m.role)).toEqual(["user", "assistant"]);
    const [row] = await sql<{ p: number; c: number }>(`select prompt_tokens p, completion_tokens c from ai_messages where id = $1`, [r.done.id]);
    expect(row).toEqual({ p: 180, c: 30 });
    const list = await b.owner.c.get(`/api/workspaces/${b.id}/ask`);
    expect(list.body.conversations[0].title).toBe(`status of ${b.t1.key}`);
  });

  it("keeps history within a conversation", async () => {
    const b = await board();
    const first = await ask(b.owner.c, b.id, "hello");
    const second = await ask(b.owner.c, b.id, "what did I ask", first.meta!.conversationId);
    expect(second.done.content).toBe("You said: 2 messages so far.");
  });

  it("never lets a made-up key through: the guard forces a rewrite", async () => {
    const b = await board();
    const r = await ask(b.owner.c, b.id, "invent something");
    expect(r.done.content).toBe("Sorry, I couldn't find that ticket.");
    expect(r.done.content).not.toContain("PAY-999");
    expect(r.done.cards).toEqual([]);
  });

  it("never claims a confirm card exists when no change was prepared", async () => {
    const b = await board();
    const r = await ask(b.owner.c, b.id, "fake card please");
    expect(r.done.proposals).toEqual([]);
    expect(r.done.content).toBe("Want me to move it? Just say the word.");
  });

  it("proposes changes without writing; Confirm applies once; Cancel and stale proposals don't", async () => {
    const b = await board();
    const r = await ask(b.owner.c, b.id, `move ${b.t1.key} to done`);
    expect(r.done.content).toBe("Ready for you to confirm below.");
    expect(r.done.proposals).toHaveLength(1);
    const p = r.done.proposals[0];
    expect(p).toMatchObject({ status: "pending", title: `Move ${b.t1.key} to Done` });
    expect((await graph(b.owner.c, b.id)).graph.tickets.find((t) => t.id === b.t1.id)!.status).toBe("todo"); // nothing written yet

    const ok = await b.owner.c.post(`/api/workspaces/${b.id}/ask/proposals/${p.id}`, { decision: "apply" });
    expect(ok.body.proposal.status).toBe("applied");
    const g = (await graph(b.owner.c, b.id)).graph;
    expect(g.tickets.find((t) => t.id === b.t1.id)!.status).toBe("done");
    expect(g.activity.filter((a) => a.target.id === b.t1.id && a.kind === "status")).toHaveLength(1);
    // A second click is harmless.
    const again = await b.owner.c.post(`/api/workspaces/${b.id}/ask/proposals/${p.id}`, { decision: "apply" });
    expect(again.body.proposal.status).toBe("applied");
    expect((await graph(b.owner.c, b.id)).graph.activity.filter((a) => a.target.id === b.t1.id && a.kind === "status")).toHaveLength(1);

    // Cancel leaves the board alone.
    const r2 = await ask(b.owner.c, b.id, `move ${b.t2.key} to qa`);
    const c2 = await b.owner.c.post(`/api/workspaces/${b.id}/ask/proposals/${r2.done.proposals[0].id}`, { decision: "cancel" });
    expect(c2.body.proposal.status).toBe("cancelled");
    expect((await graph(b.owner.c, b.id)).graph.tickets.find((t) => t.id === b.t2.id)!.status).toBe("todo");

    // Someone else changes the ticket after the suggestion: Confirm refuses to overwrite.
    const r3 = await ask(b.owner.c, b.id, `move ${b.t2.key} to dev`);
    await act(b.owner.c, b.id, { type: "ticketStatus", id: b.t2.id, status: "qa" });
    const c3 = await b.owner.c.post(`/api/workspaces/${b.id}/ask/proposals/${r3.done.proposals[0].id}`, { decision: "apply" });
    expect(c3.body.proposal.status).toBe("failed");
    expect(c3.body.proposal.error).toMatch(/changed by someone else/);
    expect((await graph(b.owner.c, b.id)).graph.tickets.find((t) => t.id === b.t2.id)!.status).toBe("qa");
  });

  it("refuses no-op and unknown targets instead of guessing", async () => {
    const b = await board();
    const same = await ask(b.owner.c, b.id, `move ${b.t1.key} to todo`);
    expect(same.done.proposals).toEqual([]);
    expect(same.done.content).toMatch(/already To do/);
    const ghost = await ask(b.owner.c, b.id, "status of PAY-777");
    expect(ghost.done.content).toMatch(/No item with key/);
    const nobody = await ask(b.owner.c, b.id, `assign ${b.t2.key} to Zorro`);
    expect(nobody.done.proposals).toEqual([]);
    expect(nobody.done.content).toMatch(/Nobody called "Zorro"/);
  });

  it("asks which person when a name is ambiguous", async () => {
    const b = await board();
    await addMember(b.owner.c, b.id, "member", "Riya Sharma");
    await addMember(b.owner.c, b.id, "member", "Riya Kapoor");
    const r = await ask(b.owner.c, b.id, `assign ${b.t2.key} to Riya`);
    expect(r.done.proposals).toEqual([]);
    expect(r.done.content).toMatch(/Riya Sharma or Riya Kapoor/);
  });

  it("viewers get no write tools (except comments) and can't see billing", async () => {
    const b = await board();
    const v = await addMember(b.owner.c, b.id, "viewer", "Vee");
    await ask(v.c, b.id, "hello");
    const names = calls[0].tools!.map((t) => t.function.name);
    expect(names).not.toContain("set_status");
    expect(names).not.toContain("create_ticket");
    expect(names).toContain("add_comment");
    const bill = await ask(v.c, b.id, "billing please");
    expect(bill.done.content).toMatch(/Only owners and admins/);
  });

  it("keeps chats and proposals private to their owner", async () => {
    const b = await board();
    const m = await addMember(b.owner.c, b.id, "admin", "Admin");
    const r = await ask(b.owner.c, b.id, `move ${b.t1.key} to dev`);
    expect((await m.c.get(`/api/workspaces/${b.id}/ask/${r.meta!.conversationId}`)).status).toBe(404);
    expect((await m.c.post(`/api/workspaces/${b.id}/ask/proposals/${r.done.proposals[0].id}`, { decision: "apply" })).status).toBe(404);
    expect((await m.c.get(`/api/workspaces/${b.id}/ask`)).body.conversations).toEqual([]);
    const other = await workspace();
    expect((await other.owner.c.post(`/api/workspaces/${b.id}/ask`, { message: "hi" })).status).toBe(404);
    // Deleting a chat removes it.
    expect((await b.owner.c.del(`/api/workspaces/${b.id}/ask/${r.meta!.conversationId}`)).status).toBe(200);
    expect((await b.owner.c.get(`/api/workspaces/${b.id}/ask/${r.meta!.conversationId}`)).status).toBe(404);
  });

  it("falls back to the backup model, then to a board-only answer when the AI is down", async () => {
    const b = await board();
    failModels = new Set(["mock-main"]);
    const r = await ask(b.owner.c, b.id, "hello");
    expect(r.done.content).toBe("Hey! Ask me about the board.");
    expect(calls.map((c) => c.model)).toEqual(["mock-main", "mock-main", "mock-backup"]);

    failModels = new Set(["mock-main", "mock-backup"]);
    const down = await ask(b.owner.c, b.id, "show open bugs");
    expect(down.status).toBe(200);
    expect(down.done.error).toBe("ai_unavailable");
    expect(down.done.content).toMatch(/isn't reachable/);
  }, 30_000);

  it("on rate limits it says when to ask again instead of a vague answer", async () => {
    const b = await board();
    limitModels = new Set(["mock-main", "mock-backup"]);
    const r = await ask(b.owner.c, b.id, "hello");
    expect(r.done.error).toBe("rate_limited");
    expect(r.done.content).toMatch(/Ask again in about 31 seconds/);
    expect(calls.map((c) => c.model)).toEqual(["mock-main", "mock-backup"]); // a 30s wait: skip straight to the next model, then stop
  });

  it("turns typographic hyphens in keys into plain ones so they link and get checked", async () => {
    const b = await board();
    const r = await ask(b.owner.c, b.id, `status of ${b.t1.key}`);
    expect(r.done.cards).toHaveLength(1);
  });

  it("rate limits per person and validates input", async () => {
    const b = await board();
    expect((await b.owner.c.post(`/api/workspaces/${b.id}/ask`, { message: "   " })).status).toBe(400);
    expect((await b.owner.c.post(`/api/workspaces/${b.id}/ask`, { message: "x".repeat(4001) })).status).toBe(400);
    const r = await ask(b.owner.c, b.id, "hello");
    await sql(
      `insert into ai_messages (conversation_id, workspace_id, user_id, role, content) select $1, $2, $3, 'user', 'spam' from generate_series(1, 20)`,
      [r.meta!.conversationId, b.id, b.owner.id],
    );
    const limited = await b.owner.c.post(`/api/workspaces/${b.id}/ask`, { message: "one more" });
    expect(limited.status).toBe(429);
  });
});
