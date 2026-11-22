import { describe, expect, it } from "vitest";
import { act, addMember, client, graph, signup, sql, workspace } from "./helpers";

async function setup() {
  const w = await workspace();
  const { graph: g } = await graph(w.owner.c, w.id);
  return { ...w, rel: g.releases[0], pay: g.modules[0], auth: g.modules[1], misc: g.modules.find((m) => m.misc)! };
}

describe("board changes", () => {
  it("features get atomic keys per module and log who created them", async () => {
    const { owner, id, rel, pay, auth } = await setup();
    const a = await act(owner.c, id, { type: "addFeature", releaseId: rel.id, moduleId: pay.id, name: "Refunds", ownerId: owner.id, spec: "Do refunds" });
    expect(a.status).toBe(200);
    const b = await act(owner.c, id, { type: "addFeature", releaseId: rel.id, moduleId: pay.id, name: "Cards", ownerId: null, spec: "" });
    const c = await act(owner.c, id, { type: "addFeature", releaseId: rel.id, moduleId: auth.id, name: "Login", ownerId: null, spec: "" });
    expect(c.body.graph.features.map((f: { key: string }) => f.key)).toEqual(["PAY-101", "PAY-102", "AUTH-101"]);
    expect(b.body.graph.features[1].spec).toBe("No spec yet.");
    const created = c.body.graph.activity.filter((x: { kind: string }) => x.kind === "created");
    expect(created).toHaveLength(3);
    expect(created[0].actorId).toBe(owner.id);
    expect(c.body.version).toBe(3);
  });

  it("a same-named feature in a later version links back to the earlier one", async () => {
    const { owner, id, rel, pay } = await setup();
    const f1 = (await act(owner.c, id, { type: "addFeature", releaseId: rel.id, moduleId: pay.id, name: "Checkout", ownerId: null, spec: "" })).body.graph.features[0];
    const relId = crypto.randomUUID();
    const r2 = await act(owner.c, id, { type: "addRelease", id: relId, version: "v1.1", name: "Next", date: "2027-03-01", state: "current" });
    expect(r2.body.graph.releases.find((r: { id: string }) => r.id === rel.id).state).toBe("shipped"); // only one current
    const f2 = (await act(owner.c, id, { type: "addFeature", releaseId: relId, moduleId: pay.id, name: "checkout", ownerId: null, spec: "" })).body.graph.features[1];
    expect(f2.extendsId).toBe(f1.id);
    expect((await act(owner.c, id, { type: "addRelease", version: "V1.1", name: "", date: "2027-04-01", state: "planned" })).status).toBe(409);
  });

  it("tickets: create, status and assignee changes are logged with from/to; same value is a no-op", async () => {
    const { owner, id, rel, pay } = await setup();
    const m = await addMember(owner.c, id, "member", "Dev");
    const fid = (await act(owner.c, id, { type: "addFeature", releaseId: rel.id, moduleId: pay.id, name: "F", ownerId: null, spec: "" })).body.graph.features[0].id;
    const tid = crypto.randomUUID();
    const t = await act(owner.c, id, { type: "addTicket", id: tid, featureId: fid, title: "  Build it  ", assigneeId: m.id });
    const ticket = t.body.graph.tickets[0];
    expect(ticket).toMatchObject({ id: tid, key: "PAY-102", title: "Build it", status: "todo", assigneeId: m.id, createdBy: owner.id });
    await act(m.c, id, { type: "ticketStatus", id: tid, status: "dev" });
    await act(m.c, id, { type: "ticketStatus", id: tid, status: "dev" }); // no-op
    const last = await act(owner.c, id, { type: "ticketAssignee", id: tid, assigneeId: null });
    const log = last.body.graph.activity.filter((a: { target: { id: string } }) => a.target.id === tid).map((a: { kind: string; from: string; to: string; actorId: string }) => [a.kind, a.from, a.to, a.actorId]);
    expect(log).toEqual([
      ["created", null, null, owner.id],
      ["assignee", null, m.id, owner.id],
      ["status", "todo", "dev", m.id],
      ["assignee", m.id, null, owner.id],
    ]);
  });

  it("rejects bad input and things from other workspaces", async () => {
    const { owner, id, rel, pay } = await setup();
    const other = await setup();
    expect((await act(owner.c, id, { type: "addTicket", featureId: crypto.randomUUID(), title: "x" })).status).toBe(404);
    expect((await act(owner.c, id, { type: "addFeature", releaseId: other.rel.id, moduleId: pay.id, name: "Sneaky", ownerId: null, spec: "" })).status).toBe(404);
    expect((await act(owner.c, id, { type: "addFeature", releaseId: rel.id, moduleId: pay.id, name: "", ownerId: null, spec: "" })).status).toBe(400);
    expect((await act(owner.c, id, { type: "addFeature", releaseId: rel.id, moduleId: pay.id, name: "F", ownerId: other.owner.id, spec: "" })).status).toBe(400);
    expect((await act(owner.c, id, { type: "explode" })).status).toBe(400);
    expect((await act(owner.c, id, { type: "ticketStatus", id: "not-a-uuid", status: "done" })).status).toBe(400);
    expect((await act(owner.c, id, { type: "addRelease", version: "v2", name: "", date: "2027-13-45", state: "planned" })).status).toBe(400);
    // an outsider can't act at all
    expect((await act(other.owner.c, id, { type: "addModule", name: "Hack" })).status).toBe(404);
  });

  it("viewers can comment but can't change work", async () => {
    const { owner, id, rel, pay } = await setup();
    const v = await addMember(owner.c, id, "viewer", "Viewer");
    expect((await act(v.c, id, { type: "addFeature", releaseId: rel.id, moduleId: pay.id, name: "F", ownerId: null, spec: "" })).status).toBe(403);
    const fid = (await act(owner.c, id, { type: "addFeature", releaseId: rel.id, moduleId: pay.id, name: "F", ownerId: null, spec: "" })).body.graph.features[0].id;
    const c = await act(v.c, id, { type: "addComment", target: { kind: "feature", id: fid }, body: "Looks good" });
    expect(c.status).toBe(200);
    expect(c.body.graph.comments[0]).toMatchObject({ authorId: v.id, body: "Looks good" });
  });

  it("modules get unique key prefixes and new features use them", async () => {
    const { owner, id, rel } = await setup();
    await act(owner.c, id, { type: "addModule", name: "Payouts" });
    const dup = await act(owner.c, id, { type: "addModule", name: "payouts" });
    expect(dup.status).toBe(409);
    const g = (await act(owner.c, id, { type: "addModule", name: "App UI" })).body.graph;
    const payouts = g.modules.find((m: { name: string }) => m.name === "Payouts");
    const f = await act(owner.c, id, { type: "addFeature", releaseId: rel.id, moduleId: payouts.id, name: "X", ownerId: null, spec: "" });
    expect(f.body.graph.features[0].key).toBe("PAY2-101"); // PAY is taken by Payments
    expect(g.modules.at(-1).name).toBe("Miscellaneous"); // misc stays last
  });

  it("concurrent adds never duplicate keys, and misc tasks share one bucket per version", async () => {
    const { owner, id, rel, pay } = await setup();
    const m = await addMember(owner.c, id, "member");
    const fid = (await act(owner.c, id, { type: "addFeature", releaseId: rel.id, moduleId: pay.id, name: "Busy", ownerId: null, spec: "" })).body.graph.features[0].id;
    const tickets = await Promise.all(Array.from({ length: 20 }, (_, i) => act(i % 2 ? owner.c : m.c, id, { type: "addTicket", featureId: fid, title: `T${i}` })));
    expect(tickets.every((r) => r.status === 200)).toBe(true);
    const misc = await Promise.all(Array.from({ length: 10 }, (_, i) => act(i % 2 ? owner.c : m.c, id, { type: "addMiscTicket", releaseId: rel.id, title: `Chore ${i}` })));
    expect(misc.every((r) => r.status === 200)).toBe(true);
    const { graph: g, version } = await graph(owner.c, id);
    const keys = g.tickets.map((t) => t.key);
    expect(new Set(keys).size).toBe(30);
    const buckets = g.features.filter((f) => f.moduleId === g.modules.find((x) => x.misc)!.id);
    expect(buckets).toHaveLength(1);
    expect(g.tickets.filter((t) => t.featureId === buckets[0].id)).toHaveLength(10);
    expect(version).toBe(32); // 1 feature + 20 + 10 + member join bump
  });

  it("polling: ETag 304 when nothing changed, 200 after a change", async () => {
    const { owner, id } = await setup();
    const first = await owner.c.get(`/api/workspaces/${id}/graph`);
    const etag = first.headers.get("etag")!;
    expect((await owner.c.get(`/api/workspaces/${id}/graph`, { "If-None-Match": etag })).status).toBe(304);
    await act(owner.c, id, { type: "addModule", name: "Search" });
    expect((await owner.c.get(`/api/workspaces/${id}/graph`, { "If-None-Match": etag })).status).toBe(200);
  });

  it("comments: authors and admins delete; others can't", async () => {
    const { owner, id, rel, pay } = await setup();
    const a = await addMember(owner.c, id, "member", "A");
    const b = await addMember(owner.c, id, "member", "B");
    const fid = (await act(owner.c, id, { type: "addFeature", releaseId: rel.id, moduleId: pay.id, name: "F", ownerId: null, spec: "" })).body.graph.features[0].id;
    const cid = crypto.randomUUID();
    await act(a.c, id, { type: "addComment", id: cid, target: { kind: "feature", id: fid }, body: "@B take a look" });
    expect((await act(b.c, id, { type: "deleteComment", id: cid })).status).toBe(403);
    expect((await act(a.c, id, { type: "addComment", target: { kind: "feature", id: fid }, body: "   " })).status).toBe(400);
    expect((await act(a.c, id, { type: "addComment", target: { kind: "ticket", id: crypto.randomUUID() }, body: "x" })).status).toBe(404);
    expect((await act(owner.c, id, { type: "deleteComment", id: cid })).status).toBe(200);
  });
});

describe("files", () => {
  const png = () => new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13])], { type: "image/png" });

  it("upload → attach to a comment → members can download, outsiders can't", async () => {
    const { owner, id, rel, pay } = await setup();
    const m = await addMember(owner.c, id, "member");
    const stranger = await signup("Stranger");
    const form = new FormData();
    form.append("file", png(), "mock.png");
    const up = await owner.c.post(`/api/workspaces/${id}/files`, form);
    expect(up.status).toBe(201);
    expect(up.body).toMatchObject({ name: "mock.png", type: "image/png", size: 12 });
    // pending: only the uploader can see it
    expect((await m.c.get(`/api/files/${up.body.id}`)).status).toBe(404);
    expect((await owner.c.get(`/api/files/${up.body.id}`)).status).toBe(200);
    const fid = (await act(owner.c, id, { type: "addFeature", releaseId: rel.id, moduleId: pay.id, name: "F", ownerId: null, spec: "" })).body.graph.features[0].id;
    const c = await act(owner.c, id, { type: "addComment", target: { kind: "feature", id: fid }, body: "", attachmentIds: [up.body.id] });
    expect(c.body.graph.comments[0].attachments).toEqual([{ id: up.body.id, name: "mock.png", type: "image/png", size: 12 }]);
    const dl = await m.c.get(`/api/files/${up.body.id}`);
    expect(dl.status).toBe(200);
    expect(dl.headers.get("content-type")).toBe("image/png");
    expect(dl.headers.get("x-content-type-options")).toBe("nosniff");
    expect((await stranger.c.get(`/api/files/${up.body.id}`)).status).toBe(404);
    expect((await client().get(`/api/files/${up.body.id}`)).status).toBe(401);
    // someone else can't claim my upload
    const form2 = new FormData();
    form2.append("file", png(), "b.png");
    const up2 = await owner.c.post(`/api/workspaces/${id}/files`, form2);
    expect((await act(m.c, id, { type: "addComment", target: { kind: "feature", id: fid }, body: "mine now", attachmentIds: [up2.body.id] })).status).toBe(400);
    // deleting the comment removes its files
    await act(owner.c, id, { type: "deleteComment", id: c.body.graph.comments[0].id });
    expect((await sql("select 1 from attachments where id = $1", [up.body.id])).length).toBe(0);
  });

  it("refuses unsafe types, empty and oversized files", async () => {
    const { owner, id } = await setup();
    const html = new FormData();
    html.append("file", new Blob(["<script>alert(1)</script>"], { type: "text/html" }), "x.html");
    expect((await owner.c.post(`/api/workspaces/${id}/files`, html)).status).toBe(415);
    const empty = new FormData();
    empty.append("file", new Blob([], { type: "image/png" }), "e.png");
    expect((await owner.c.post(`/api/workspaces/${id}/files`, empty)).status).toBe(400);
    const big = new FormData();
    big.append("file", new Blob([new Uint8Array(10 * 1024 * 1024 + 10)], { type: "application/pdf" }), "big.pdf");
    expect((await owner.c.post(`/api/workspaces/${id}/files`, big)).status).toBe(413);
  });

  it("unposted uploads can be removed by their uploader only", async () => {
    const { owner, id } = await setup();
    const m = await addMember(owner.c, id, "member");
    const f = new FormData();
    f.append("file", png(), "x.png");
    const up = await owner.c.post(`/api/workspaces/${id}/files`, f);
    expect((await m.c.del(`/api/files/${up.body.id}`)).status).toBe(404);
    expect((await owner.c.del(`/api/files/${up.body.id}`)).status).toBe(200);
  });
});

describe("notifications and the sample workspace", () => {
  it("read state is per person and survives reloads", async () => {
    const { owner, id } = await setup();
    const g1 = await owner.c.get(`/api/workspaces/${id}/notifications`);
    expect(g1.body.readIds).toEqual([]);
    await owner.c.put(`/api/workspaces/${id}/notifications`, { readIds: ["n-a", "n-b"] });
    await owner.c.put(`/api/workspaces/${id}/notifications`, { readIds: ["n-b", "n-c"] });
    expect((await owner.c.get(`/api/workspaces/${id}/notifications`)).body.readIds).toEqual(["n-a", "n-b", "n-c"]);
    const all = await owner.c.put(`/api/workspaces/${id}/notifications`, { all: true });
    expect(all.body.readIds).toEqual([]);
    expect(new Date(all.body.readBefore).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it("demo: opens Acme as Bhumika or Shashvat, resets, and other workspaces can't be reset", async () => {
    const c = client();
    const r = await c.post("/api/demo", { as: "bhumika" });
    expect(r.status).toBe(200);
    const g = (await graph(c, r.body.workspaceId)).graph;
    expect(g.product.name).toBe("Acme Store");
    expect(g.people.map((p) => p.name)).toEqual(["Bhumika Saxena", "Shashvat Singh"]);
    const t = g.tickets[0];
    await act(c, r.body.workspaceId, { type: "ticketStatus", id: t.id, status: t.status === "done" ? "todo" : "done" });
    expect((await c.post(`/api/workspaces/${r.body.workspaceId}/reset`)).status).toBe(200);
    const after = (await graph(c, r.body.workspaceId)).graph;
    expect(after.tickets.find((x) => x.key === t.key)?.status).toBe(t.status);
    // concurrent first visits create one demo workspace
    await Promise.all([client().post("/api/demo", {}), client().post("/api/demo", {})]);
    expect((await sql("select count(*)::int as n from workspaces where demo")).at(0)?.n).toBe(1);
    const s = client();
    expect((await s.post("/api/demo", { as: "shashvat" })).status).toBe(200);
    expect((await s.get("/api/auth/me")).body.user.name).toBe("Shashvat Singh");
    const { owner, id } = await setup();
    expect((await owner.c.post(`/api/workspaces/${id}/reset`)).status).toBe(403);
  });
});
