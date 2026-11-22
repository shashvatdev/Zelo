// Load check: N people at once sign up, pay, onboard, make changes and poll their boards.
// Usage: node tests/load.mjs [users=30] [base=http://localhost:3300]
const N = Number(process.argv[2] ?? 30);
const BASE = process.argv[3] ?? "http://localhost:3300";
const times = [];
let errors = 0;
const errSamples = [];

function client(i) {
  const jar = new Map();
  const ip = `10.99.${Math.floor(i / 250)}.${(i % 250) + 1}`;
  return async (method, path, body) => {
    const t = performance.now();
    const res = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip, cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") },
      body: body ? JSON.stringify(body) : undefined,
    });
    times.push(performance.now() - t);
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const [k, ...v] = kv.split("=");
      jar.set(k, v.join("="));
    }
    const data = res.status === 304 ? null : await res.json().catch(() => null);
    if (res.status >= 400) {
      errors++;
      if (errSamples.length < 5) errSamples.push(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
    }
    return { status: res.status, data, etag: res.headers.get("etag") };
  };
}

async function user(i) {
  const req = client(i);
  const tag = `${Date.now().toString(36)}-${i}`;
  await req("POST", "/api/auth/signup", { name: `Load ${i}`, email: `load.${tag}@load.test`, password: "load-pass-123" });
  const co = await req("POST", "/api/checkout", { plan: "team", seats: 5, card: { number: "4242424242424242", exp: "12/30", cvc: "123", name: "Load" } });
  const ws = co.data.workspaceId;
  await req("POST", `/api/workspaces/${ws}/onboard`, { name: `Load ${i}`, slug: `load-${tag}`, productName: "Load app", mode: "sample" });
  let g = await req("GET", `/api/workspaces/${ws}/graph`);
  const rel = g.data.graph.releases.find((r) => r.state === "current");
  const feat = g.data.graph.features.find((f) => f.releaseId === rel.id);
  for (let k = 0; k < 10; k++) {
    const t = g.data.graph.tickets[k];
    const r = await req("POST", `/api/workspaces/${ws}/actions`, k % 3 === 0 ? { type: "addTicket", featureId: feat.id, title: `Load ticket ${k}` } : { type: "ticketStatus", id: t.id, status: ["todo", "dev", "qa", "done"][k % 4] });
    if (r.data) g = r;
  }
  for (let k = 0; k < 5; k++) await req("GET", `/api/workspaces/${ws}/graph`); // polls
}

const t0 = performance.now();
await Promise.all(Array.from({ length: N }, (_, i) => user(i).catch((e) => { errors++; errSamples.push(String(e)); })));
const wall = (performance.now() - t0) / 1000;
times.sort((a, b) => a - b);
const p = (q) => times[Math.min(times.length - 1, Math.floor(q * times.length))].toFixed(0);
console.log(`${N} users · ${times.length} requests in ${wall.toFixed(1)}s · errors ${errors}`);
console.log(`latency ms  p50 ${p(0.5)}  p95 ${p(0.95)}  p99 ${p(0.99)}  max ${times.at(-1).toFixed(0)}`);
if (errSamples.length) console.log(errSamples.join("\n"));
process.exit(errors ? 1 : 0);
