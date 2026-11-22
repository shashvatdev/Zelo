import pg from "pg";

export const BASE = process.env.TEST_URL ?? "http://localhost:3300";
export const dbUrl = process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/zelo_test";

let pool: pg.Pool | null = null;
export const sql = async <T extends pg.QueryResultRow = Record<string, unknown>>(q: string, params: unknown[] = []) => {
  pool ??= new pg.Pool({ connectionString: dbUrl, max: 3 });
  return (await pool.query<T>(q, params)).rows;
};

let n = 0;
/** A unique email per call, so tests never collide with each other or earlier runs. */
export const email = (name = "user") => `${name}.${Date.now().toString(36)}${(n++).toString(36)}@test.zelo`;

export type Res<T = any> = { status: number; body: T; headers: Headers }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** A browser-like client: keeps its own cookie jar. */
export function client() {
  const jar = new Map<string, string>();
  // Each client is a different person on a different network (the server trusts the proxy header in tests).
  const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`;
  async function req<T = any>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res<T>> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const isForm = body instanceof FormData;
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(isForm || body === undefined ? {} : { "Content-Type": "application/json" }), cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), "X-Forwarded-For": ip, ...headers },
      body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const [k, ...v] = kv.split("=");
      const val = v.join("=");
      if (!val || /expires=Thu, 01 Jan 1970/i.test(c) || /max-age=0/i.test(c)) jar.delete(k.trim());
      else jar.set(k.trim(), val);
    }
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // not JSON
    }
    return { status: res.status, body: parsed as T, headers: res.headers };
  }
  return {
    jar,
    get: <T = any>(p: string, h?: Record<string, string>) => req<T>("GET", p, undefined, h), // eslint-disable-line @typescript-eslint/no-explicit-any
    post: <T = any>(p: string, b?: unknown, h?: Record<string, string>) => req<T>("POST", p, b ?? {}, h), // eslint-disable-line @typescript-eslint/no-explicit-any
    patch: <T = any>(p: string, b?: unknown) => req<T>("PATCH", p, b ?? {}), // eslint-disable-line @typescript-eslint/no-explicit-any
    put: <T = any>(p: string, b?: unknown) => req<T>("PUT", p, b ?? {}), // eslint-disable-line @typescript-eslint/no-explicit-any
    del: <T = any>(p: string) => req<T>("DELETE", p), // eslint-disable-line @typescript-eslint/no-explicit-any
  };
}
export type Client = ReturnType<typeof client>;

export const CARD_OK = { number: "4242 4242 4242 4242", exp: "12/30", cvc: "123", name: "Test Owner" };
export const CARD_DECLINE = { number: "4000 0000 0000 0002", exp: "12/30", cvc: "123", name: "Test Owner" };

export async function signup(name = "Owner") {
  const c = client();
  const e = email(name.toLowerCase());
  const r = await c.post("/api/auth/signup", { name, email: e, password: "correct-horse-9" });
  if (r.status !== 201) throw new Error(`signup failed ${r.status} ${JSON.stringify(r.body)}`);
  return { c, email: e, id: r.body.user.id as string, name };
}

let slugN = 0;
/** Owner + paid workspace + finished onboarding (fresh product with 2 modules and v1.0). */
export async function workspace(opts: { plan?: "free" | "team" | "business"; seats?: number; mode?: "empty" | "sample" } = {}) {
  const owner = await signup("Owner");
  const plan = opts.plan ?? "team";
  const co = await owner.c.post("/api/checkout", { plan, seats: opts.seats ?? 5, country: "India", card: plan === "free" ? undefined : CARD_OK });
  if (co.status !== 200) throw new Error(`checkout failed ${co.status} ${JSON.stringify(co.body)}`);
  const id = co.body.workspaceId as string;
  const slug = `ws-${Date.now().toString(36)}-${slugN++}`;
  const ob = await owner.c.post(`/api/workspaces/${id}/onboard`, {
    name: "Test Co",
    slug,
    productName: "Test App",
    mode: opts.mode ?? "empty",
    modules: ["Payments", "Auth"],
    release: { version: "v1.0", name: "Launch", date: "2027-01-10" },
  });
  if (ob.status !== 200) throw new Error(`onboard failed ${ob.status} ${JSON.stringify(ob.body)}`);
  return { owner, id, slug };
}

/** Invite + accept as a brand-new account. Returns the member's client. */
export async function addMember(owner: Client, wsId: string, role: "admin" | "member" | "viewer" = "member", name = "Member") {
  const e = email(name.toLowerCase());
  const inv = await owner.post(`/api/workspaces/${wsId}/invites`, { emails: [e], role });
  if (inv.status !== 201) throw new Error(`invite failed ${inv.status} ${JSON.stringify(inv.body)}`);
  const token = new URL(inv.body.invites[0].link).searchParams.get("token")!;
  const c = client();
  const acc = await c.post(`/api/invites/${token}/accept`, { name, password: "member-pass-1" });
  if (acc.status !== 200) throw new Error(`accept failed ${acc.status} ${JSON.stringify(acc.body)}`);
  const me = await c.get("/api/auth/me");
  return { c, email: e, id: me.body.user.id as string, token };
}

export async function graph(c: Client, wsId: string) {
  const r = await c.get(`/api/workspaces/${wsId}/graph`);
  if (r.status !== 200) throw new Error(`graph failed ${r.status} ${JSON.stringify(r.body)}`);
  return r.body as { graph: import("../../src/data/model").Graph; version: number };
}

export const act = (c: Client, wsId: string, action: Record<string, unknown>) => c.post(`/api/workspaces/${wsId}/actions`, action);
