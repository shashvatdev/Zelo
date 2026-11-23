import { describe, expect, it } from "vitest";
import { nextPath, safeNext } from "../../src/lib/flow";
import { addMember, client, email, graph, signup, sql } from "./helpers";

/**
 * The start flow end to end: sign up → choose a plan → pay (demo: no gateway, Pay just succeeds)
 * → set up the workspace → the product map. Plus every way people leave and come back.
 */

const onboardBody = (slug: string) => ({ name: "Flow Co", slug, productName: "Flow App", mode: "empty", modules: ["Payments", "Auth"], release: { version: "v1.0", name: "Launch", date: "2027-03-01" } });
const slug = () => `flow-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const me = async (c: ReturnType<typeof client>) => (await c.get("/api/auth/me")).body as { workspaces: { id: string; onboarded: boolean; isOwner: boolean; plan: string }[]; activeWorkspaceId: string | null };

describe("where people go next (shared routing rule)", () => {
  const ws = (id: string, onboarded: boolean, isOwner = true) => ({ id, onboarded, isOwner });
  it("covers every state of the flow", () => {
    expect(nextPath({ workspaces: [], activeWorkspaceId: null })).toBe("/checkout"); // signed up, no plan yet
    expect(nextPath({ workspaces: [ws("a", false)], activeWorkspaceId: "a" })).toBe("/onboarding"); // paid, not set up
    expect(nextPath({ workspaces: [ws("a", true)], activeWorkspaceId: "a" })).toBe("/app"); // all done
    expect(nextPath({ workspaces: [ws("a", true), ws("b", false)], activeWorkspaceId: "b" })).toBe("/onboarding"); // mid-setup of a 2nd workspace
    expect(nextPath({ workspaces: [ws("a", true), ws("b", false)], activeWorkspaceId: "a" })).toBe("/app"); // working in the finished one
    expect(nextPath({ workspaces: [ws("a", false)], activeWorkspaceId: null })).toBe("/onboarding");
    expect(nextPath({ workspaces: [ws("a", true, false)], activeWorkspaceId: "a" })).toBe("/app"); // invited member
  });
  it("only follows same-site next= paths", () => {
    expect(safeNext("/onboarding")).toBe("/onboarding");
    expect(safeNext("//evil.com")).toBeNull();
    expect(safeNext("/\\evil.com")).toBeNull();
    expect(safeNext("https://evil.com")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});

describe("start flow with demo payments", () => {
  it("signup → Pay (no card) → onboarding → product map, and the receipt says it's a demo", async () => {
    const o = await signup("Payer");
    expect((await me(o.c)).workspaces).toEqual([]); // → choose a plan

    const pay = await o.c.post("/api/checkout", { plan: "team", seats: 4, country: "India" });
    expect(pay.status).toBe(200);
    expect(pay.body).toMatchObject({ plan: "team", seats: 4, totalCents: 56640, taxCents: 8640, card: null, demo: true });
    expect(pay.body.renews).toBeTruthy();
    const [p] = await sql<{ provider: string; status: string; amount_cents: number; card_last4: string | null }>(`select * from payments where workspace_id = $1`, [pay.body.workspaceId]);
    expect(p).toMatchObject({ provider: "demo", status: "paid", amount_cents: 48000, card_last4: null });
    const [mail] = await sql<{ text: string }>(`select text from emails where "to" = $1 and kind = 'receipt'`, [o.email]);
    expect(mail.text).toMatch(/demo payment \(no card was charged\)/);

    const m1 = await me(o.c);
    expect(m1.activeWorkspaceId).toBe(pay.body.workspaceId);
    expect(m1.workspaces[0]).toMatchObject({ onboarded: false, isOwner: true, plan: "team" }); // → onboarding

    expect((await o.c.post(`/api/workspaces/${pay.body.workspaceId}/onboard`, onboardBody(slug()))).status).toBe(200);
    expect((await me(o.c)).workspaces[0].onboarded).toBe(true); // → the map
    const g = await graph(o.c, pay.body.workspaceId);
    expect(g.graph.modules.map((m) => m.name)).toEqual(["Payments", "Auth", "Miscellaneous"]);
  });

  it("a double click on Pay makes one workspace and one payment", async () => {
    const o = await signup("Clicker");
    const res = await Promise.all(Array.from({ length: 4 }, () => o.c.post("/api/checkout", { plan: "business", seats: 3 })));
    expect(res.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect(new Set(res.map((r) => r.body.workspaceId)).size).toBe(1);
    const [{ n }] = await sql<{ n: number }>(`select count(*)::int n from payments where workspace_id = $1`, [res[0].body.workspaceId]);
    expect(n).toBe(1);
    expect((await me(o.c)).workspaces).toHaveLength(1);
  });

  it("changing plan before setup updates the same workspace (no duplicates)", async () => {
    const o = await signup("Changer");
    const a = await o.c.post("/api/checkout", { plan: "free", seats: 5 });
    const b = await o.c.post("/api/checkout", { plan: "team", seats: 8 });
    const c = await o.c.post("/api/checkout", { plan: "business", seats: 8 });
    expect(new Set([a.body.workspaceId, b.body.workspaceId, c.body.workspaceId]).size).toBe(1);
    const [w] = await sql<{ plan: string; seats: number; paid_until: Date | null }>(`select * from workspaces where id = $1`, [a.body.workspaceId]);
    expect(w).toMatchObject({ plan: "business", seats: 8 });
    expect(w.paid_until).toBeTruthy();
    const d = await o.c.post("/api/checkout", { plan: "free", seats: 5 });
    const [w2] = await sql<{ plan: string; seats: number; paid_until: Date | null; card_last4: string | null }>(`select * from workspaces where id = $1`, [d.body.workspaceId]);
    expect(w2).toMatchObject({ plan: "free", seats: 5, paid_until: null, card_last4: null });
  });

  it("leaving after signup or after paying: logging in again keeps their place", async () => {
    const e1 = email("leaver");
    const s = client();
    await s.post("/api/auth/signup", { name: "Leaver", email: e1, password: "correct-horse-9" });
    const again = client();
    expect((await again.post("/api/auth/login", { email: e1, password: "correct-horse-9" })).status).toBe(200);
    expect(nextPath(await me(again))).toBe("/checkout"); // never a silent Free workspace

    const pay = await again.post("/api/checkout", { plan: "team", seats: 2 });
    const third = client();
    await third.post("/api/auth/login", { email: e1, password: "correct-horse-9" });
    const m = await me(third);
    expect(nextPath(m)).toBe("/onboarding");
    expect(m.workspaces.map((w) => w.id)).toEqual([pay.body.workspaceId]);
  });

  it("upgrading a set-up workspace from billing needs no card and keeps it set up", async () => {
    const o = await signup("Upgrader");
    const free = await o.c.post("/api/checkout", { plan: "free", seats: 5 });
    await o.c.post(`/api/workspaces/${free.body.workspaceId}/onboard`, onboardBody(slug()));
    const up = await o.c.post("/api/checkout", { plan: "team", seats: 6, workspaceId: free.body.workspaceId });
    expect(up.status).toBe(200);
    expect(up.body).toMatchObject({ workspaceId: free.body.workspaceId, plan: "team", demo: true });
    const m = await me(o.c);
    expect(m.workspaces).toHaveLength(1);
    expect(m.workspaces[0]).toMatchObject({ plan: "team", onboarded: true });
    const pays = (await o.c.get(`/api/workspaces/${free.body.workspaceId}/payments`)).body;
    expect(pays[0]).toMatchObject({ plan: "team", seats: 6, status: "paid", card: null });
  });

  it("a second workspace after the first is set up is a new workspace, and /app keeps working", async () => {
    const o = await signup("Twice");
    const one = await o.c.post("/api/checkout", { plan: "free", seats: 5 });
    await o.c.post(`/api/workspaces/${one.body.workspaceId}/onboard`, onboardBody(slug()));
    const two = await o.c.post("/api/checkout", { plan: "team", seats: 3 });
    expect(two.body.workspaceId).not.toBe(one.body.workspaceId);
    const m = await me(o.c);
    expect(m.activeWorkspaceId).toBe(two.body.workspaceId);
    expect(nextPath(m)).toBe("/onboarding"); // finish the new one
    await o.c.post("/api/auth/switch", { workspaceId: one.body.workspaceId });
    expect(nextPath(await me(o.c))).toBe("/app");
  });

  it("guards: signed out, someone else's workspace, too few seats, bad input", async () => {
    expect((await client().post("/api/checkout", { plan: "team", seats: 2 })).status).toBe(401);
    const a = await signup("Owner A");
    const ws = (await a.c.post("/api/checkout", { plan: "team", seats: 3 })).body.workspaceId;
    await a.c.post(`/api/workspaces/${ws}/onboard`, onboardBody(slug()));
    const b = await signup("Owner B");
    expect((await b.c.post("/api/checkout", { plan: "business", seats: 3, workspaceId: ws })).status).toBe(404);
    const m = await addMember(a.c, ws, "member", "Seat Taker");
    expect(m.id).toBeTruthy();
    const few = await a.c.post("/api/checkout", { plan: "business", seats: 1, workspaceId: ws });
    expect(few.status).toBe(400);
    expect(few.body.field).toBe("seats");
    expect((await a.c.post("/api/checkout", { plan: "gold", seats: 3 })).status).toBe(400);
    expect((await a.c.post("/api/checkout", { plan: "team", seats: 0 })).status).toBe(400);
    expect((await a.c.post("/api/checkout", { plan: "team", seats: 501 })).status).toBe(400);
    // Onboarding is owner-only.
    expect((await m.c.post(`/api/workspaces/${ws}/onboard`, onboardBody(slug()))).status).toBe(403);
  });

  it("the old test-card path still works when a card is sent (for the future gateway)", async () => {
    const o = await signup("Carder");
    const ok = await o.c.post("/api/checkout", { plan: "team", seats: 2, card: { number: "4242 4242 4242 4242", exp: "12/30", cvc: "123", name: "C" } });
    expect(ok.body).toMatchObject({ card: { brand: "Visa", last4: "4242" }, demo: false });
  });
});
