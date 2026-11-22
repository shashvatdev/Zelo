import { describe, expect, it } from "vitest";
import { act, addMember, BASE, client, email, graph, workspace, type Client } from "./helpers";

type Ev = { event: string; data: { w: string; t?: string; v?: number } };

/** Opens the SSE stream like a browser would and collects events. */
async function stream(c: Client, wsId: string, base = BASE) {
  const ctrl = new AbortController();
  const res = await fetch(`${base}/api/workspaces/${wsId}/events`, { headers: { cookie: [...c.jar].map(([k, v]) => `${k}=${v}`).join("; ") }, signal: ctrl.signal });
  const events: Ev[] = [];
  const waiters: (() => void)[] = [];
  if (res.ok && res.body) {
    void (async () => {
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const ev = /^event: (.+)$/m.exec(chunk)?.[1];
            const data = /^data: (.+)$/m.exec(chunk)?.[1];
            if (ev && data) {
              events.push({ event: ev, data: JSON.parse(data) });
              waiters.splice(0).forEach((w) => w());
            }
          }
        }
      } catch {
        // aborted
      }
    })();
  }
  const next = async (pred: (e: Ev) => boolean, ms = 3000) => {
    const t0 = Date.now();
    for (;;) {
      const hit = events.find(pred);
      if (hit) return { ...hit, ms: Date.now() - t0 };
      if (Date.now() - t0 > ms) return null;
      await new Promise<void>((r) => {
        waiters.push(r);
        setTimeout(r, 100);
      });
    }
  };
  return { status: res.status, type: res.headers.get("content-type"), events, next, close: () => ctrl.abort() };
}

describe("live updates", () => {
  it("only members can open the stream", async () => {
    const { id } = await workspace();
    expect((await stream(client(), id)).status).toBe(401);
    const stranger = await (await import("./helpers")).signup("Stranger");
    expect((await stream(stranger.c, id)).status).toBe(404);
  });

  it("someone else's change reaches an open board within a second", async () => {
    const { owner, id } = await workspace();
    const m = await addMember(owner.c, id, "member");
    const s = await stream(m.c, id);
    expect(s.status).toBe(200);
    expect(s.type).toMatch(/text\/event-stream/);
    const ready = await s.next((e) => e.event === "ready");
    expect(ready?.data.w).toBe(id);
    const { graph: g, version } = await graph(owner.c, id);
    await act(owner.c, id, { type: "addFeature", releaseId: g.releases[0].id, moduleId: g.modules[0].id, name: "Live", ownerId: null, spec: "" });
    const ev = await s.next((e) => e.event === "board" && (e.data.v ?? 0) > version, 2000);
    expect(ev).not.toBeNull();
    expect(ev!.ms).toBeLessThan(1000);
    expect(ev!.data.v).toBe(version + 1);
    s.close();
  });

  it("team changes (invites, roles) are announced too", async () => {
    const { owner, id } = await workspace();
    const s = await stream(owner.c, id);
    await s.next((e) => e.event === "ready");
    await owner.c.post(`/api/workspaces/${id}/invites`, { emails: [email()], role: "member" });
    expect(await s.next((e) => e.event === "team")).not.toBeNull();
    s.close();
  });

  it("a rolled-back change sends nothing", async () => {
    const { owner, id } = await workspace();
    const s = await stream(owner.c, id);
    const ready = await s.next((e) => e.event === "ready");
    const bad = await act(owner.c, id, { type: "addTicket", featureId: crypto.randomUUID(), title: "nope" }); // fails inside the transaction
    expect(bad.status).toBe(404);
    expect(await s.next((e) => e.event === "board", 800)).toBeNull();
    expect(ready).not.toBeNull();
    s.close();
  });

  it("works across server instances (change on one, stream on another)", async () => {
    const other = process.env.TEST_URL_2 ?? "http://localhost:3301";
    if (!(await fetch(`${other}/api/health`).then((r) => r.ok, () => false))) return; // second instance not running
    const { owner, id } = await workspace();
    const m = await addMember(owner.c, id, "member");
    const s = await stream(m.c, id, other);
    await s.next((e) => e.event === "ready");
    const { graph: g, version } = await graph(owner.c, id); // owner talks to the first instance
    await act(owner.c, id, { type: "addModule", name: "Cross" });
    const ev = await s.next((e) => e.event === "board" && (e.data.v ?? 0) > version, 2000);
    expect(ev).not.toBeNull();
    expect(ev!.ms).toBeLessThan(1000);
    void g;
    s.close();
  });
});
