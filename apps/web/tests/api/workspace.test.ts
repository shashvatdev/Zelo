import { describe, expect, it } from "vitest";
import { addMember, CARD_OK, client, email, graph, signup, sql, workspace } from "./helpers";

describe("onboarding", () => {
  it("creates the product with modules, Miscellaneous and the first version in one go", async () => {
    const { owner, id } = await workspace();
    const { graph: g } = await graph(owner.c, id);
    expect(g.product.name).toBe("Test App");
    expect(g.modules.map((m) => m.name)).toEqual(["Payments", "Auth", "Miscellaneous"]);
    expect(g.modules.find((m) => m.name === "Miscellaneous")?.misc).toBe(true);
    expect(g.releases).toEqual([expect.objectContaining({ version: "v1.0", name: "Launch", state: "current", date: "2027-01-10" })]);
    expect(g.people).toEqual([expect.objectContaining({ id: owner.id, name: "Owner" })]);
    const me = await owner.c.get("/api/auth/me");
    expect(me.body.workspaces[0].onboarded).toBe(true);
  });

  it("sample mode copies the whole sample board with consistent keys and links", async () => {
    const { owner, id } = await workspace({ mode: "sample" });
    const { graph: g } = await graph(owner.c, id);
    expect(g.releases).toHaveLength(5);
    expect(g.features.length).toBeGreaterThan(20);
    expect(g.tickets.length).toBeGreaterThan(40);
    expect(new Set(g.tickets.map((t) => t.key)).size).toBe(g.tickets.length);
    const ids = new Set(g.features.map((f) => f.id));
    for (const f of g.features) if (f.extendsId) expect(ids.has(f.extendsId)).toBe(true);
    expect(g.activity.length).toBeGreaterThan(50);
    // sample people map to the real owner
    expect(g.tickets.every((t) => t.assigneeId === null || t.assigneeId === owner.id)).toBe(true);
  });

  it("taken workspace URL is refused with a field error", async () => {
    const a = await workspace();
    const b = await signup("Second");
    const co = await b.c.post("/api/checkout", { plan: "free", seats: 5 });
    const r = await b.c.post(`/api/workspaces/${co.body.workspaceId}/onboard`, { name: "X", slug: a.slug, productName: "P", mode: "empty", modules: ["A"], release: { version: "v1", name: "", date: "2027-01-01" } });
    expect(r.status).toBe(409);
    expect(r.body.field).toBe("slug");
    const patch = await b.c.patch(`/api/workspaces/${co.body.workspaceId}`, { slug: a.slug });
    expect(patch.status).toBe(409);
  });

  it("onboarding twice does not create a second product", async () => {
    const { owner, id, slug } = await workspace();
    const again = await owner.c.post(`/api/workspaces/${id}/onboard`, { name: "Renamed", slug, productName: "Other", mode: "empty", modules: ["Z"], release: { version: "v9", name: "", date: "2027-01-01" } });
    expect(again.status).toBe(200);
    expect((await sql("select count(*)::int as n from products where workspace_id = $1", [id]))[0].n).toBe(1);
    expect(again.body.name).toBe("Renamed");
  });

  it("only the owner can finish onboarding; strangers get 404 not 403", async () => {
    const { owner, id } = await workspace();
    const m = await addMember(owner.c, id, "admin");
    expect((await m.c.post(`/api/workspaces/${id}/onboard`, { name: "X", slug: "x-y-z", productName: "P", mode: "sample" })).status).toBe(403);
    const stranger = await signup("Stranger");
    expect((await stranger.c.get(`/api/workspaces/${id}`)).status).toBe(404);
    expect((await stranger.c.get(`/api/workspaces/${id}/graph`)).status).toBe(404);
  });
});

describe("invites", () => {
  it("full accept flow for a new person, who then sees the board", async () => {
    const { owner, id } = await workspace();
    const e = email("arjun");
    const inv = await owner.c.post(`/api/workspaces/${id}/invites`, { emails: [e], role: "member" });
    expect(inv.status).toBe(201);
    const link = inv.body.invites[0].link as string;
    expect(link).toMatch(/\/invite\?token=/);
    const token = new URL(link).searchParams.get("token")!;
    // the token is never stored, only its hash
    expect((await sql("select 1 from invites where token_hash = $1", [token])).length).toBe(0);
    // an email went out with the same link
    const [mail] = await sql<{ text: string; subject: string }>("select text, subject from emails where \"to\" = $1 and kind = 'invite'", [e]);
    expect(mail.text).toContain(token);
    expect(mail.subject).toMatch(/Owner invited you to Test Co/);
    const info = await client().get(`/api/invites/${token}`);
    expect(info.body).toMatchObject({ status: "valid", email: e, role: "member", inviterName: "Owner", existingAccount: false });
    const arjun = client();
    const acc = await arjun.post(`/api/invites/${token}/accept`, { name: "Arjun", password: "arjun-pass-1" });
    expect(acc.status).toBe(200);
    const { graph: g } = await graph(arjun, id);
    expect(g.people.map((p) => p.name)).toEqual(["Owner", "Arjun"]);
    expect((await client().get(`/api/invites/${token}`)).body.status).toBe("used");
    // using it again (even by a new person) fails cleanly
    const reuse = await client().post(`/api/invites/${token}/accept`, { name: "Z", password: "zzzzzzzz1" });
    expect(reuse.status).toBe(410);
    expect((await sql("select count(*)::int as n from users where email = $1", [e]))[0].n).toBe(1);
  });

  it("existing account must prove the password; wrong signed-in user is told to log out", async () => {
    const { owner, id } = await workspace();
    const existing = await signup("Existing");
    const inv = await owner.c.post(`/api/workspaces/${id}/invites`, { emails: [existing.email], role: "viewer" });
    const token = new URL(inv.body.invites[0].link).searchParams.get("token")!;
    expect((await client().get(`/api/invites/${token}`)).body.existingAccount).toBe(true);
    // signed in as someone else
    const other = await signup("Other");
    const wrong = await other.c.post(`/api/invites/${token}/accept`, {});
    expect(wrong.status).toBe(403);
    expect(wrong.body.error).toMatch(/Log out first/);
    // anonymous with wrong then right password
    const anon = client();
    expect((await anon.post(`/api/invites/${token}/accept`, { password: "bad-password-1" })).status).toBe(401);
    expect((await anon.post(`/api/invites/${token}/accept`, { password: "correct-horse-9" })).status).toBe(200);
    // already signed in as the invited person: one click
    const inv2 = await owner.c.post(`/api/workspaces/${id}/invites`, { emails: [email("signedin")], role: "member" });
    void inv2;
  });

  it("signed-in invitee accepts with one click and the session switches workspace", async () => {
    const { owner, id } = await workspace();
    const p = await signup("Clicker");
    const inv = await owner.c.post(`/api/workspaces/${id}/invites`, { emails: [p.email], role: "member" });
    const token = new URL(inv.body.invites[0].link).searchParams.get("token")!;
    expect((await p.c.post(`/api/invites/${token}/accept`, {})).status).toBe(200);
    expect((await p.c.get("/api/auth/me")).body.activeWorkspaceId).toBe(id);
  });

  it("expired and revoked invites are refused with the right status", async () => {
    const { owner, id } = await workspace();
    const a = email("exp");
    const b = email("rev");
    const inv = await owner.c.post(`/api/workspaces/${id}/invites`, { emails: [a, b], role: "member" });
    const [ia, ib] = inv.body.invites;
    await sql("update invites set expires_at = now() - interval '1 hour' where id = $1", [ia.id]);
    const ta = new URL(ia.link).searchParams.get("token")!;
    expect((await client().get(`/api/invites/${ta}`)).body.status).toBe("expired");
    expect((await client().post(`/api/invites/${ta}/accept`, { name: "A", password: "aaaaaaaa1" })).status).toBe(410);
    expect((await owner.c.del(`/api/workspaces/${id}/invites/${ib.id}`)).status).toBe(200);
    const tb = new URL(ib.link).searchParams.get("token")!;
    expect((await client().get(`/api/invites/${tb}`)).body.status).toBe("revoked");
    expect((await owner.c.del(`/api/workspaces/${id}/invites/${ib.id}`)).status).toBe(404);
    expect((await client().get(`/api/invites/garbage-token-value`)).body.status).toBe("missing");
  });

  it("resend and copy-link rotate the token; the old link stops working", async () => {
    const { owner, id } = await workspace();
    const e = email("rot");
    const inv = await owner.c.post(`/api/workspaces/${id}/invites`, { emails: [e], role: "member" });
    const old = new URL(inv.body.invites[0].link).searchParams.get("token")!;
    const re = await owner.c.post(`/api/workspaces/${id}/invites/${inv.body.invites[0].id}/resend`);
    expect(re.status).toBe(200);
    expect((await client().get(`/api/invites/${old}`)).body.status).toBe("missing");
    const linked = await owner.c.post(`/api/workspaces/${id}/invites/${inv.body.invites[0].id}/link`);
    const t2 = new URL(linked.body.link).searchParams.get("token")!;
    expect((await client().get(`/api/invites/${new URL(re.body.link).searchParams.get("token")}`)).body.status).toBe("missing");
    expect((await client().get(`/api/invites/${t2}`)).body.status).toBe("valid");
    expect((await sql("select count(*)::int as n from emails where \"to\" = $1", [e]))[0].n).toBe(2); // invite + resend, not copy-link
    // re-inviting the same email replaces the pending invite, never duplicates it
    await owner.c.post(`/api/workspaces/${id}/invites`, { emails: [e.toUpperCase()], role: "admin" });
    expect((await sql("select count(*)::int as n from invites where workspace_id = $1 and email = $2 and status = 'pending'", [id, e]))[0].n).toBe(1);
  });

  it("enforces seats: free plan stops at 5 editors, viewers are free", async () => {
    const owner = await signup("Seats");
    const co = await owner.c.post("/api/checkout", { plan: "free", seats: 5 });
    const id = co.body.workspaceId;
    await owner.c.post(`/api/workspaces/${id}/onboard`, { name: "S", slug: `seats-${Date.now().toString(36)}`, productName: "P", mode: "empty", modules: ["A"], release: { version: "v1", name: "", date: "2027-01-01" } });
    const four = [email(), email(), email(), email()];
    expect((await owner.c.post(`/api/workspaces/${id}/invites`, { emails: four, role: "member" })).status).toBe(201);
    const fifth = await owner.c.post(`/api/workspaces/${id}/invites`, { emails: [email()], role: "member" });
    expect(fifth.status).toBe(402);
    expect(fifth.body.error).toMatch(/Free plan/);
    expect((await owner.c.post(`/api/workspaces/${id}/invites`, { emails: [email()], role: "viewer" })).status).toBe(201);
  });

  it("only admins invite; members get 403; bad emails are rejected; members can't be re-invited", async () => {
    const { owner, id } = await workspace();
    const m = await addMember(owner.c, id, "member");
    expect((await m.c.post(`/api/workspaces/${id}/invites`, { emails: [email()], role: "member" })).status).toBe(403);
    expect((await owner.c.post(`/api/workspaces/${id}/invites`, { emails: ["nope"], role: "member" })).status).toBe(400);
    const dup = await owner.c.post(`/api/workspaces/${id}/invites`, { emails: [m.email], role: "member" });
    expect(dup.status).toBe(409);
  });
});

describe("members", () => {
  it("roles: admin can change others; owner and self are protected; members can't", async () => {
    const { owner, id } = await workspace();
    const admin = await addMember(owner.c, id, "admin", "Admin");
    const mem = await addMember(owner.c, id, "member", "Mem");
    expect((await admin.c.patch(`/api/workspaces/${id}/members/${mem.id}`, { role: "viewer" })).status).toBe(200);
    expect((await admin.c.patch(`/api/workspaces/${id}/members/${owner.id}`, { role: "member" })).status).toBe(403);
    expect((await admin.c.patch(`/api/workspaces/${id}/members/${admin.id}`, { role: "member" })).status).toBe(400);
    expect((await mem.c.patch(`/api/workspaces/${id}/members/${admin.id}`, { role: "viewer" })).status).toBe(403);
    expect((await owner.c.patch(`/api/workspaces/${id}/members/${owner.id}`, { role: "owner" })).status).toBe(400);
  });

  it("removing someone unassigns their open tickets, keeps done ones, and cuts their access", async () => {
    const { owner, id } = await workspace();
    const m = await addMember(owner.c, id, "member", "Leaver");
    const { graph: g } = await graph(owner.c, id);
    const f = await owner.c.post(`/api/workspaces/${id}/actions`, { type: "addFeature", releaseId: g.releases[0].id, moduleId: g.modules[0].id, name: "F", ownerId: null, spec: "" });
    const fid = f.body.graph.features[0].id;
    const t1 = crypto.randomUUID();
    const t2 = crypto.randomUUID();
    await owner.c.post(`/api/workspaces/${id}/actions`, { type: "addTicket", id: t1, featureId: fid, title: "Open one", assigneeId: m.id });
    await owner.c.post(`/api/workspaces/${id}/actions`, { type: "addTicket", id: t2, featureId: fid, title: "Done one", assigneeId: m.id });
    await owner.c.post(`/api/workspaces/${id}/actions`, { type: "ticketStatus", id: t2, status: "done" });
    expect((await owner.c.del(`/api/workspaces/${id}/members/${m.id}`)).status).toBe(200);
    const after = (await graph(owner.c, id)).graph;
    expect(after.tickets.find((t) => t.id === t1)?.assigneeId).toBeNull();
    expect(after.tickets.find((t) => t.id === t2)?.assigneeId).toBe(m.id);
    expect(after.people.some((p) => p.id === m.id)).toBe(false);
    expect((await m.c.get(`/api/workspaces/${id}/graph`)).status).toBe(404);
    const me = await m.c.get("/api/auth/me"); // still signed in, just without that workspace
    expect(me.status).toBe(200);
    expect(me.body.workspaces).toEqual([]);
    expect((await owner.c.del(`/api/workspaces/${id}/members/${owner.id}`)).status).toBe(403);
  });

  it("seat changes: owner only, never below people in use", async () => {
    const { owner, id } = await workspace({ seats: 3 });
    await addMember(owner.c, id, "member");
    expect((await owner.c.patch(`/api/workspaces/${id}/seats`, { seats: 1 })).status).toBe(400);
    expect((await owner.c.patch(`/api/workspaces/${id}/seats`, { seats: 4 })).body.seats).toBe(4);
    const admin = await addMember(owner.c, id, "admin");
    expect((await admin.c.patch(`/api/workspaces/${id}/seats`, { seats: 9 })).status).toBe(403);
    const pays = await owner.c.get(`/api/workspaces/${id}/payments`);
    expect(pays.body[0]).toMatchObject({ status: "paid", card: "Visa •••• 4242" });
    void CARD_OK;
  });

  it("workspace details hide billing from non-admins", async () => {
    const { owner, id } = await workspace();
    const m = await addMember(owner.c, id, "member");
    const mine = await m.c.get(`/api/workspaces/${id}`);
    expect(mine.body.card).toBeNull();
    expect(mine.body.canManage).toBe(false);
    expect((await m.c.get(`/api/workspaces/${id}/payments`)).status).toBe(403);
    expect((await owner.c.get(`/api/workspaces/${id}`)).body.card.last4).toBe("4242");
  });
});
