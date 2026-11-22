import { describe, expect, it } from "vitest";
import { BASE, client, email, signup, sql } from "./helpers";

describe("auth", () => {
  it("health check answers", async () => {
    expect((await client().get("/api/health")).status).toBe(200);
  });

  it("validates sign-up fields with a clear message and field", async () => {
    const c = client();
    const bad = await c.post("/api/auth/signup", { name: "A", email: "not-an-email", password: "longenough1" });
    expect(bad.status).toBe(400);
    expect(bad.body.field).toBe("email");
    const short = await c.post("/api/auth/signup", { name: "A", email: email(), password: "short" });
    expect(short.status).toBe(400);
    expect(short.body.field).toBe("password");
    const noName = await c.post("/api/auth/signup", { name: "  ", email: email(), password: "longenough1" });
    expect(noName.body.field).toBe("name");
  });

  it("signs up, sets an httpOnly session cookie, and never returns the password hash", async () => {
    const c = client();
    const e = email("riya");
    const r = await fetch(`${BASE}/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.250.0.1" }, body: JSON.stringify({ name: "Riya", email: e.toUpperCase(), password: "correct-horse-9" }) });
    expect(r.status).toBe(201);
    const cookie = r.headers.getSetCookie().join(";");
    expect(cookie).toMatch(/zelo_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    const text = await r.text();
    expect(text).not.toMatch(/password|scrypt/i);
    // email stored lower-case
    const [row] = await sql<{ email: string; password_hash: string }>("select email, password_hash from users where email = $1", [e]);
    expect(row.email).toBe(e);
    expect(row.password_hash).toMatch(/^scrypt\$/);
    expect(row.password_hash).not.toContain("correct-horse-9");
    void c;
  });

  it("rejects a duplicate email, case-insensitively", async () => {
    const e = email("dup");
    expect((await client().post("/api/auth/signup", { name: "A", email: e, password: "longenough1" })).status).toBe(201);
    const again = await client().post("/api/auth/signup", { name: "B", email: e.toUpperCase(), password: "longenough1" });
    expect(again.status).toBe(409);
    expect(again.body.field).toBe("email");
  });

  it("me / logout / login round trip", async () => {
    const { c, email: e } = await signup("Round");
    const me = await c.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(e);
    expect(me.body.workspaces).toEqual([]);
    expect(JSON.stringify(me.body)).not.toMatch(/sessionId|password/);
    expect((await c.post("/api/auth/logout")).status).toBe(200);
    expect((await c.get("/api/auth/me")).status).toBe(401);
    const wrong = await c.post("/api/auth/login", { email: e, password: "nope-nope-nope" });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error).toMatch(/don't match/);
    const ok = await c.post("/api/auth/login", { email: e.toUpperCase(), password: "correct-horse-9" });
    expect(ok.status).toBe(200);
    expect((await c.get("/api/auth/me")).status).toBe(200);
  });

  it("unknown email and wrong password give the same answer", async () => {
    const a = await client().post("/api/auth/login", { email: email("ghost"), password: "whatever-123" });
    const { email: e } = await signup("Real");
    const b = await client().post("/api/auth/login", { email: e, password: "whatever-123" });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error).toBe(b.body.error);
  });

  it("rate-limits repeated wrong passwords for one account", async () => {
    const { email: e } = await signup("Limited");
    const c = client();
    const codes: number[] = [];
    for (let i = 0; i < 10; i++) codes.push((await c.post("/api/auth/login", { email: e, password: `wrong-${i}-xxxx` })).status);
    expect(codes.slice(0, 8).every((s) => s === 401)).toBe(true);
    expect(codes.slice(8)).toEqual([429, 429]);
    // even the right password is refused while limited
    expect((await c.post("/api/auth/login", { email: e, password: "correct-horse-9" })).status).toBe(429);
  });

  it("forgot/reset: same answer for unknown email, link works once, signs out other sessions", async () => {
    expect((await client().post("/api/auth/forgot", { email: email("nobody") })).status).toBe(200);
    const { c: other, email: e } = await signup("Forgot");
    expect((await client().post("/api/auth/forgot", { email: e })).status).toBe(200);
    const [mail] = await sql<{ text: string }>("select text from emails where \"to\" = $1 and kind = 'reset' order by created_at desc limit 1", [e]);
    const token = mail.text.match(/token=([\w-]+)/)![1];
    const c = client();
    expect((await c.post("/api/auth/reset", { token, password: "short" })).status).toBe(400);
    expect((await c.post("/api/auth/reset", { token, password: "brand-new-pass-1" })).status).toBe(200);
    expect((await c.get("/api/auth/me")).status).toBe(200);
    expect((await other.get("/api/auth/me")).status).toBe(401); // old session revoked
    expect((await client().post("/api/auth/reset", { token, password: "another-pass-22" })).status).toBe(410); // single use
    expect((await client().post("/api/auth/login", { email: e, password: "brand-new-pass-1" })).status).toBe(200);
  });

  it("behind a trusted proxy, limits sign-ups per IP", async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) codes.push((await client().post("/api/auth/signup", { name: "Ip", email: email("ip"), password: "longenough1" }, { "X-Forwarded-For": ip })).status);
    expect(codes).toEqual([201, 201, 201, 201, 201, 429]);
    // a different IP is unaffected
    expect((await client().post("/api/auth/signup", { name: "Ip", email: email("ip"), password: "longenough1" }, { "X-Forwarded-For": "198.51.100.7" })).status).toBe(201);
  });

  it("blocks cross-site writes by Origin", async () => {
    const r = await client().post("/api/auth/signup", { name: "X", email: email(), password: "longenough1" }, { Origin: "https://evil.example" });
    expect(r.status).toBe(403);
  });

  it("rejects a forged or expired session cookie", async () => {
    const c = client();
    c.jar.set("zelo_session", "forged-token-value");
    expect((await c.get("/api/auth/me")).status).toBe(401);
    const { c: real, id } = await signup("Expiry");
    await sql("update sessions set expires_at = now() - interval '1 minute' where user_id = $1", [id]);
    expect((await real.get("/api/auth/me")).status).toBe(401);
  });

  it("reports which sign-in providers are set up", async () => {
    const r = await client().get("/api/auth/providers");
    expect(r.status).toBe(200);
    expect(typeof r.body.google).toBe("boolean");
  });
});
