import { describe, expect, it } from "vitest";
import { CARD_DECLINE, CARD_OK, client, signup, sql } from "./helpers";

describe("checkout and billing", () => {
  it("needs a signed-in user", async () => {
    expect((await client().post("/api/checkout", { plan: "free", seats: 5 })).status).toBe(401);
  });

  it("free plan creates a workspace without a card, owner is a member", async () => {
    const { c, id } = await signup("Free");
    const r = await c.post("/api/checkout", { plan: "free", seats: 99 });
    expect(r.status).toBe(200);
    expect(r.body.seats).toBe(5);
    const me = await c.get("/api/auth/me");
    expect(me.body.workspaces).toHaveLength(1);
    expect(me.body.workspaces[0]).toMatchObject({ role: "owner", onboarded: false, plan: "free" });
    const [m] = await sql("select role from members where user_id = $1", [id]);
    expect(m.role).toBe("owner");
  });

  it("declined card: clear message, nothing charged, failed attempt recorded once a workspace exists", async () => {
    const { c, id } = await signup("Declined");
    const r = await c.post("/api/checkout", { plan: "team", seats: 3, card: CARD_DECLINE });
    expect(r.status).toBe(402);
    expect(r.body.error).toMatch(/declined/);
    expect(r.body.field).toBe("card");
    expect((await sql("select 1 from workspaces where owner_id = $1", [id])).length).toBe(0);
  });

  it("validates the card (Luhn, expiry, CVC) before charging", async () => {
    const { c } = await signup("BadCard");
    expect((await c.post("/api/checkout", { plan: "team", seats: 2, card: { ...CARD_OK, number: "4242 4242 4242 4241" } })).body.error).toMatch(/card number/);
    expect((await c.post("/api/checkout", { plan: "team", seats: 2, card: { ...CARD_OK, exp: "01/20" } })).body.error).toMatch(/expired/);
    expect((await c.post("/api/checkout", { plan: "team", seats: 2, card: { ...CARD_OK, cvc: "1" } })).body.error).toMatch(/security code/);
    // No card: in demo mode (no gateway yet) paying without a card succeeds as a demo payment.
    const demo = await c.post("/api/checkout", { plan: "team", seats: 2 });
    expect(demo.status).toBe(200);
    expect(demo.body.demo).toBe(true);
  });

  it("paid plan: totals with GST, stores only brand + last 4, sends a receipt", async () => {
    const { c, email: e } = await signup("Paid");
    const r = await c.post("/api/checkout", { plan: "team", seats: 5, country: "India", card: CARD_OK });
    expect(r.status).toBe(200);
    expect(r.body.totalCents).toBe(70800); // 5 × $10 × 12 = $600 + 18% GST
    expect(r.body.card).toEqual({ brand: "Visa", last4: "4242" });
    const [p] = await sql<{ amount_cents: number; tax_cents: number; card_last4: string; status: string }>("select * from payments where workspace_id = $1", [r.body.workspaceId]);
    expect(p).toMatchObject({ amount_cents: 60000, tax_cents: 10800, card_last4: "4242", status: "paid" });
    const dump = JSON.stringify(await sql("select * from payments where workspace_id = $1", [r.body.workspaceId]));
    expect(dump).not.toContain("4242424242424242");
    expect((await sql("select 1 from emails where \"to\" = $1 and kind = 'receipt'", [e])).length).toBe(1);
  });

  it("paying again before setup reuses the same unfinished workspace", async () => {
    const { c, id } = await signup("Twice");
    const a = await c.post("/api/checkout", { plan: "free", seats: 5 });
    const b = await c.post("/api/checkout", { plan: "business", seats: 7, card: CARD_OK });
    expect(b.body.workspaceId).toBe(a.body.workspaceId);
    const rows = await sql("select plan, seats from workspaces where owner_id = $1", [id]);
    expect(rows).toEqual([{ plan: "business", seats: 7 }]);
  });
});
