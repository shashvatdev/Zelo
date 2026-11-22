import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, schema } from "./db";
import { forbidden, HttpError, unauthorized } from "./http";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

/* ---------- passwords: scrypt (N=2^15), per-user salt, constant-time compare ---------- */

const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [algo, n, saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt") return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, { ...SCRYPT, N: Number(n) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Spends the same time as a real check, so "no such user" and "wrong password" look alike. */
const DUMMY_HASH = "scrypt$32768$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");
export const burnPasswordCheck = (password: string) => verifyPassword(password, DUMMY_HASH);

/* ---------- tokens ---------- */

export const newToken = () => randomBytes(32).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/* ---------- sessions: random token in an httpOnly cookie, only its hash in the DB ---------- */

export const SESSION_COOKIE = "zelo_session";
const SESSION_DAYS = 30;

export async function createSession(userId: string, workspaceId?: string | null) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.insert(schema.sessions).values({ id: sha256(token), userId, workspaceId: workspaceId ?? null, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !process.env.APP_URL?.startsWith("http://"),
    path: "/",
    expires: expiresAt,
  });
  // Opportunistic cleanup keeps the table small without a cron job.
  if (Math.random() < 0.02) void db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date())).catch(() => {});
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

export type SessionUser = { id: string; email: string; name: string; sessionId: string; workspaceId: string | null; hasPassword: boolean };

export async function currentSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      passwordHash: schema.users.passwordHash,
      sessionId: schema.sessions.id,
      workspaceId: schema.sessions.workspaceId,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return { id: r.id, email: r.email, name: r.name, sessionId: r.sessionId, workspaceId: r.workspaceId, hasPassword: !!r.passwordHash };
}

export async function requireUser() {
  const u = await currentSession();
  if (!u) throw unauthorized();
  return u;
}

export async function setSessionWorkspace(sessionId: string, workspaceId: string) {
  await db.update(schema.sessions).set({ workspaceId }).where(eq(schema.sessions.id, sessionId));
}

/* ---------- roles ---------- */

export type Role = "owner" | "admin" | "member" | "viewer";
const RANK: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

/** The caller's membership in a workspace, or 404 (we don't reveal workspaces you're not in). */
export async function requireMember(userId: string, workspaceId: string, min: Role = "viewer") {
  const rows = await db
    .select({ role: schema.members.role, workspace: schema.workspaces })
    .from(schema.members)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.members.workspaceId))
    .where(and(eq(schema.members.workspaceId, workspaceId), eq(schema.members.userId, userId)))
    .limit(1);
  const m = rows[0];
  if (!m) throw new HttpError(404, "Workspace not found.", "not_found");
  if (RANK[m.role] < RANK[min]) throw forbidden(min === "admin" ? "Only admins can do that." : min === "owner" ? "Only the owner can do that." : "Viewers can't edit work.");
  return m;
}

export const atLeast = (role: Role, min: Role) => RANK[role] >= RANK[min];

/* ---------- rate limiting (shared through the DB, so it holds across instances) ---------- */

export async function assertNotLimited(key: string | null, max: number, windowMin: number) {
  if (!key) return;
  const since = new Date(Date.now() - windowMin * 60000);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.authAttempts)
    .where(and(eq(schema.authAttempts.key, key), gt(schema.authAttempts.createdAt, since)));
  if (n >= max) throw new HttpError(429, `Too many attempts. Try again in ${windowMin} minutes.`, "rate_limited");
}

export async function recordAttempt(key: string | null) {
  if (!key) return;
  await db.insert(schema.authAttempts).values({ key });
  if (Math.random() < 0.05) void db.delete(schema.authAttempts).where(lt(schema.authAttempts.createdAt, new Date(Date.now() - 86400000))).catch(() => {});
}

export async function clearAttempts(key: string) {
  await db.delete(schema.authAttempts).where(eq(schema.authAttempts.key, key));
}

/**
 * The caller's IP, only when a trusted proxy sets it (TRUST_PROXY=1, e.g. Vercel, Cloudflare, nginx).
 * Without one the header could be forged, so IP-based limits are skipped and per-account limits apply.
 */
export function clientIp(req: Request): string | null {
  if (process.env.TRUST_PROXY !== "1") return null;
  return (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "").trim() || null;
}

/** Per-IP budget for sign-ups and similar, tunable per deployment. */
export const IP_LIMIT_PER_HOUR = Number(process.env.IP_LIMIT_PER_HOUR ?? 20);
