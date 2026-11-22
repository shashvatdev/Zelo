import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { SEED } from "@/data/seed";
import { newToken, sha256, type Role } from "./auth";
import { config } from "./config";
import { db, schema, type Tx } from "./db";
import { prefixFor, productOf } from "./graph";
import { bad, conflict, HttpError } from "./http";
import { inviteEmail, sendMail } from "./mail";
import { FREE_MAX_USERS } from "./payments";

export const PERSON_COLORS = ["var(--coral)", "var(--blue)", "var(--green)", "var(--amber)", "#1f8a8a", "#8a6a3a"];
const MODULE_COLORS = ["#e5582b", "#3866c9", "#2f8f46", "#d48a1c", "#1f8a8a", "#b5401b", "#5a6fd6", "#8a6a3a"];

/** People changed: bump the boards so open tabs refetch the team. */
export async function bumpWorkspace(tx: Tx, workspaceId: string) {
  await tx.update(schema.products).set({ version: sql`${schema.products.version} + 1` }).where(eq(schema.products.workspaceId, workspaceId));
}

export async function nextColor(tx: Tx, workspaceId: string) {
  const [{ n }] = await tx.select({ n: count() }).from(schema.members).where(eq(schema.members.workspaceId, workspaceId));
  return PERSON_COLORS[n % PERSON_COLORS.length];
}

/* ---------- workspace details for the client ---------- */

export async function workspaceDetail(workspaceId: string, viewerRole: Role) {
  const [ws] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId));
  const [memberRows, inviteRows, product] = await Promise.all([
    db
      .select({
        userId: schema.members.userId,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.members.role,
        title: schema.members.title,
        color: schema.members.color,
        joinedAt: schema.members.joinedAt,
        invitedBy: schema.members.invitedBy,
      })
      .from(schema.members)
      .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
      .where(eq(schema.members.workspaceId, workspaceId))
      .orderBy(asc(schema.members.joinedAt), sql`case when ${schema.members.role} = 'owner' then 0 else 1 end`, asc(schema.users.name)),
    db
      .select({
        id: schema.invites.id,
        email: schema.invites.email,
        role: schema.invites.role,
        createdAt: schema.invites.createdAt,
        expiresAt: schema.invites.expiresAt,
        invitedBy: schema.invites.invitedBy,
        inviterName: schema.users.name,
      })
      .from(schema.invites)
      .leftJoin(schema.users, eq(schema.users.id, schema.invites.invitedBy))
      .where(and(eq(schema.invites.workspaceId, workspaceId), eq(schema.invites.status, "pending")))
      .orderBy(asc(schema.invites.createdAt)),
    productOf(workspaceId),
  ]);
  const isAdmin = viewerRole === "owner" || viewerRole === "admin";
  return {
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    plan: ws.plan,
    seats: ws.seats,
    onboarded: ws.onboarded,
    demo: ws.demo,
    teamSize: ws.teamSize,
    createdAt: ws.createdAt.toISOString(),
    role: viewerRole,
    card: ws.cardLast4 && isAdmin ? { brand: ws.cardBrand ?? "Card", last4: ws.cardLast4, exp: ws.cardExp ?? "" } : null,
    paidUntil: ws.paidUntil?.toISOString() ?? null,
    product: product ? { id: product.id, name: product.name } : null,
    members: memberRows.map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString() })),
    // Everyone sees who is invited (the sidebar shows them); only admins manage them.
    invites: inviteRows.map((i) => ({ ...i, createdAt: i.createdAt.toISOString(), expiresAt: i.expiresAt.toISOString(), expired: i.expiresAt < new Date() })),
    canManage: isAdmin,
  };
}

/** Seats in use: active editors plus pending editor invites (viewers are free). */
export async function seatsUsed(tx: Tx | typeof db, workspaceId: string) {
  const [[{ m }], [{ i }]] = await Promise.all([
    tx.select({ m: count() }).from(schema.members).where(and(eq(schema.members.workspaceId, workspaceId), ne(schema.members.role, "viewer"))),
    tx
      .select({ i: count() })
      .from(schema.invites)
      .where(and(eq(schema.invites.workspaceId, workspaceId), eq(schema.invites.status, "pending"), ne(schema.invites.role, "viewer"), sql`${schema.invites.expiresAt} > now()`)),
  ]);
  return m + i;
}

export const seatLimit = (ws: { plan: string; seats: number }) => (ws.plan === "free" ? FREE_MAX_USERS : ws.seats);

/* ---------- invites ---------- */

export const inviteUrl = (token: string) => `${config.appUrl}/invite?token=${encodeURIComponent(token)}`;

/** Creates (or refreshes) invites and emails them. Returns accept links for the inviter to copy. */
export async function createInvites(workspaceId: string, emails: string[], role: "admin" | "member" | "viewer", inviter: { id: string; name: string }) {
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()))];
  if (!unique.length) throw bad("Add at least one email.");
  if (unique.length > 50) throw bad("Invite at most 50 people at a time.");

  const made = await db.transaction(async (tx) => {
    // Lock the workspace row so two admins inviting at once can't both take the last seat.
    const [ws] = await tx.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).for("update");
    const already = await tx
      .select({ email: schema.users.email })
      .from(schema.members)
      .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
      .where(and(eq(schema.members.workspaceId, workspaceId), inArray(schema.users.email, unique)));
    if (already.length) throw conflict(`Already in the workspace: ${already.map((a) => a.email).join(", ")}`, "emails");

    const pending = await tx
      .select({ email: schema.invites.email, role: schema.invites.role })
      .from(schema.invites)
      .where(and(eq(schema.invites.workspaceId, workspaceId), eq(schema.invites.status, "pending"), inArray(schema.invites.email, unique)));
    const fresh = unique.filter((e) => !pending.some((p) => p.email === e));
    const used = await seatsUsed(tx, workspaceId);
    const adding = role === "viewer" ? 0 : fresh.length + pending.filter((p) => p.role === "viewer").length;
    if (used + adding > seatLimit(ws)) {
      throw new HttpError(402, ws.plan === "free" ? `The Free plan includes ${FREE_MAX_USERS} people. Upgrade to add more.` : `That needs ${used + adding} seats; you have ${ws.seats}. Add seats in billing.`, "seats");
    }

    const out: { id: string; email: string; role: string; token: string }[] = [];
    for (const email of unique) {
      const token = newToken();
      // Re-inviting someone replaces their old link.
      await tx.update(schema.invites).set({ status: "revoked" }).where(and(eq(schema.invites.workspaceId, workspaceId), eq(schema.invites.email, email), eq(schema.invites.status, "pending")));
      const [row] = await tx
        .insert(schema.invites)
        .values({ workspaceId, email, role, tokenHash: sha256(token), invitedBy: inviter.id, expiresAt: new Date(Date.now() + config.inviteDays * 86400000) })
        .returning({ id: schema.invites.id });
      out.push({ id: row.id, email, role, token });
    }
    return { out, wsName: ws.name };
  });

  const product = await productOf(workspaceId);
  const results = await Promise.all(
    made.out.map(async (m) => {
      const mail = await sendMail(inviteEmail({ to: m.email, inviter: inviter.name, workspace: made.wsName || "their workspace", product: product?.name, role: m.role, url: inviteUrl(m.token) }));
      return { id: m.id, email: m.email, role: m.role, link: inviteUrl(m.token), emailId: mail.id, emailError: mail.error };
    }),
  );
  return results;
}

/** New link for an existing invite (old one stops working), optionally emailed again. */
export async function refreshInvite(workspaceId: string, inviteId: string, inviter: { id: string; name: string }, email: boolean) {
  const token = newToken();
  const [inv] = await db
    .update(schema.invites)
    .set({ tokenHash: sha256(token), expiresAt: new Date(Date.now() + config.inviteDays * 86400000), invitedBy: inviter.id, createdAt: new Date() })
    .where(and(eq(schema.invites.id, inviteId), eq(schema.invites.workspaceId, workspaceId), eq(schema.invites.status, "pending")))
    .returning();
  if (!inv) throw new HttpError(404, "That invite is no longer pending.", "not_found");
  if (email) {
    const [ws] = await db.select({ name: schema.workspaces.name }).from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId));
    const product = await productOf(workspaceId);
    await sendMail(inviteEmail({ to: inv.email, inviter: inviter.name, workspace: ws.name, product: product?.name, role: inv.role, url: inviteUrl(token) }));
  }
  return { link: inviteUrl(token) };
}

export async function findInviteByToken(token: string) {
  const [row] = await db
    .select({ invite: schema.invites, workspace: schema.workspaces, inviterName: schema.users.name })
    .from(schema.invites)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.invites.workspaceId))
    .leftJoin(schema.users, eq(schema.users.id, schema.invites.invitedBy))
    .where(eq(schema.invites.tokenHash, sha256(token)))
    .limit(1);
  return row ?? null;
}

/** Turns a pending invite into a membership. Idempotent for the same user. */
export async function joinFromInvite(token: string, user: { id: string; email: string }) {
  return db.transaction(async (tx) => {
    const [inv] = await tx.select().from(schema.invites).where(eq(schema.invites.tokenHash, sha256(token))).for("update");
    if (!inv) throw new HttpError(404, "This invite link doesn't work.", "not_found");
    if (inv.email !== user.email) throw new HttpError(403, `This invite is for ${inv.email}.`, "wrong_user");
    if (inv.status === "revoked") throw new HttpError(410, "This invite was cancelled.", "revoked");
    if (inv.status === "accepted") {
      if (inv.acceptedBy === user.id) return inv.workspaceId;
      throw new HttpError(410, "This invite was already used.", "used");
    }
    if (inv.expiresAt < new Date()) throw new HttpError(410, "This invite has expired. Ask for a new one.", "expired");
    const existing = await tx.select().from(schema.members).where(and(eq(schema.members.workspaceId, inv.workspaceId), eq(schema.members.userId, user.id)));
    if (!existing.length) {
      await tx.insert(schema.members).values({ workspaceId: inv.workspaceId, userId: user.id, role: inv.role, color: await nextColor(tx, inv.workspaceId), invitedBy: inv.invitedBy });
    }
    await tx.update(schema.invites).set({ status: "accepted", acceptedBy: user.id, acceptedAt: new Date() }).where(eq(schema.invites.id, inv.id));
    await bumpWorkspace(tx, inv.workspaceId);
    return inv.workspaceId;
  });
}

/* ---------- products: fresh, sample, demo ---------- */

type Fresh = { productName: string; modules: string[]; release: { version: string; name: string; date: string } };

export async function createFreshProduct(tx: Tx, workspaceId: string, input: Fresh) {
  const [p] = await tx.insert(schema.products).values({ workspaceId, name: input.productName }).returning();
  const names = [...new Map(input.modules.map((m) => [m.trim().toLowerCase(), m.trim()])).values()].filter(Boolean);
  for (const [i, name] of names.entries()) {
    await tx.insert(schema.modules).values({ productId: p.id, name, color: MODULE_COLORS[i % MODULE_COLORS.length], keyPrefix: await prefixFor(tx, p.id, name), position: i });
  }
  await tx.insert(schema.modules).values({ productId: p.id, name: "Miscellaneous", color: "#7a7365", keyPrefix: await prefixFor(tx, p.id, "Misc"), isMisc: true, position: 999 });
  await tx.insert(schema.releases).values({ productId: p.id, version: input.release.version, name: input.release.name || "First release", targetDate: input.release.date, state: "current" });
  return p;
}

const SEED_PREFIX: Record<string, string> = { "m-pay": "PAY", "m-auth": "AUTH", "m-dash": "DASH", "m-ui": "UI", "m-note": "NOTE", "m-misc": "MISC" };

/**
 * Copies the sample board (Acme Store) into a product, mapping the sample people to real users.
 * Ids are made up-front so each table goes in with one multi-row insert (a short transaction even
 * when many workspaces are created at once). Self-references (`extends`) resolve within the statement.
 */
export async function createSampleProduct(tx: Tx, workspaceId: string, people: Record<string, string>, productName?: string) {
  const [p] = await tx.insert(schema.products).values({ workspaceId, name: productName || SEED.product.name }).returning();
  const ids = new Map<string, string>();
  const idOf = (old: string) => {
    if (!ids.has(old)) ids.set(old, randomUUID());
    return ids.get(old)!;
  };
  const map = (old: string | null | undefined) => (old ? idOf(old) : null);
  const person = (old: string | null | undefined) => (old ? (people[old] ?? null) : null);
  const at = (s: string) => new Date(s);
  const P = p.id;

  await tx.insert(schema.modules).values(SEED.modules.map((m, i) => ({ id: idOf(m.id), productId: P, name: m.name, color: m.color, keyPrefix: SEED_PREFIX[m.id] ?? m.name.slice(0, 3).toUpperCase(), isMisc: !!m.misc, position: i })));
  await tx.insert(schema.releases).values(SEED.releases.map((r) => ({ id: idOf(r.id), productId: P, version: r.version, name: r.name, targetDate: r.date, state: r.state })));
  await tx.insert(schema.features).values(
    SEED.features.map((f) => ({ id: idOf(f.id), productId: P, moduleId: map(f.moduleId)!, releaseId: map(f.releaseId)!, key: f.key, name: f.name, ownerId: person(f.ownerId), extendsId: map(f.extendsId), spec: f.spec, createdAt: at(f.createdAt), createdBy: person(f.createdBy) })),
  );
  await tx.insert(schema.tickets).values(
    SEED.tickets.map((t) => ({ id: idOf(t.id), productId: P, featureId: map(t.featureId)!, key: t.key, title: t.title, assigneeId: person(t.assigneeId), status: t.status, points: t.points, createdAt: at(t.createdAt), createdBy: person(t.createdBy) })),
  );
  await tx.insert(schema.bugs).values(
    SEED.bugs.map((b) => ({ id: idOf(b.id), productId: P, moduleId: map(b.moduleId)!, releaseId: map(b.releaseId)!, key: b.key, title: b.title, assigneeId: person(b.assigneeId), status: b.status, severity: b.severity, introducedIn: map(b.introducedIn), createdAt: at(b.createdAt), createdBy: person(b.createdBy) })),
  );
  const known = new Set([...SEED.features, ...SEED.tickets, ...SEED.bugs].map((x) => x.id));
  const comments = SEED.comments.filter((c) => known.has(c.target.id));
  if (comments.length) await tx.insert(schema.comments).values(comments.map((c) => ({ productId: P, targetKind: c.target.kind, targetId: idOf(c.target.id), authorId: person(c.authorId), body: c.body, createdAt: at(c.createdAt) })));
  const acts = SEED.activity
    .filter((a) => known.has(a.target.id))
    .map((a) => ({ productId: P, targetKind: a.target.kind, targetId: idOf(a.target.id), actorId: person(a.actorId), kind: a.kind, fromValue: a.kind === "assignee" ? person(a.from) : (a.from ?? null), toValue: a.kind === "assignee" ? person(a.to) : (a.to ?? null), at: at(a.at) }));
  if (acts.length) await tx.insert(schema.activity).values(acts);
  // Keep key counters ahead of the copied keys.
  const max = new Map<string, number>();
  for (const k of [...SEED.features, ...SEED.tickets, ...SEED.bugs].map((x) => x.key)) {
    const [pre, n] = k.split("-");
    max.set(pre, Math.max(max.get(pre) ?? 0, Number(n)));
  }
  await tx.insert(schema.keyCounters).values([...max].map(([prefix, last]) => ({ productId: P, prefix, last })));
  return p;
}

export const DEMO_SLUG = "acme-sample";
export const DEMO_USERS = {
  bhumika: { email: "bhumika@acme.example", name: "Bhumika Saxena", title: "Product manager", color: "var(--coral)", role: "owner" as Role },
  shashvat: { email: "shashvat@acme.example", name: "Shashvat Singh", title: "Developer", color: "var(--blue)", role: "admin" as Role },
};

/** The shared sample workspace, created on first use. Demo users have no password (entry is via /api/demo). */
export async function ensureDemo() {
  const [found] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.slug, DEMO_SLUG));
  if (found) return found;
  try {
    return await db.transaction(async (tx) => {
      const users: Record<string, string> = {};
      for (const [k, u] of Object.entries(DEMO_USERS)) {
        const [row] = await tx
          .insert(schema.users)
          .values({ email: u.email, name: u.name })
          .onConflictDoUpdate({ target: schema.users.email, set: { name: u.name } })
          .returning({ id: schema.users.id });
        users[k] = row.id;
      }
      const [ws] = await tx
        .insert(schema.workspaces)
        .values({ name: "Acme", slug: DEMO_SLUG, plan: "team", seats: 5, ownerId: users.bhumika, onboarded: true, demo: true, cardBrand: "Visa", cardLast4: "4242", cardExp: "08/28", paidUntil: new Date(Date.now() + 300 * 86400000) })
        .returning();
      for (const [k, u] of Object.entries(DEMO_USERS)) {
        await tx.insert(schema.members).values({ workspaceId: ws.id, userId: users[k], role: u.role, title: u.title, color: u.color, invitedBy: k === "bhumika" ? null : users.bhumika });
      }
      await createSampleProduct(tx, ws.id, { "p-bhumika": users.bhumika, "p-shashvat": users.shashvat });
      return ws;
    });
  } catch (e) {
    // Two first visitors at once: the loser reads what the winner created.
    if ((e as { code?: string }).code === "23505") {
      const [ws] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.slug, DEMO_SLUG));
      if (ws) return ws;
    }
    throw e;
  }
}

export async function resetDemo(workspaceId: string) {
  await db.transaction(async (tx) => {
    const members = await tx
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.members)
      .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
      .where(eq(schema.members.workspaceId, workspaceId));
    const byEmail = (e: string) => members.find((m) => m.email === e)?.id ?? null;
    await tx.delete(schema.products).where(eq(schema.products.workspaceId, workspaceId));
    await tx.delete(schema.attachments).where(eq(schema.attachments.workspaceId, workspaceId));
    await createSampleProduct(tx, workspaceId, { "p-bhumika": byEmail(DEMO_USERS.bhumika.email)!, "p-shashvat": byEmail(DEMO_USERS.shashvat.email)! });
  });
}

export async function latestPayments(workspaceId: string) {
  return db.select().from(schema.payments).where(eq(schema.payments.workspaceId, workspaceId)).orderBy(desc(schema.payments.createdAt)).limit(24);
}
