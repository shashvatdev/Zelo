"use client";

import { useSyncExternalStore } from "react";

/**
 * Accounts, workspaces, members and invites for the demo, kept in localStorage.
 * Every function here maps to one API call later (sign up, log in, invite, accept…).
 * Passwords are never stored: the demo only checks that one was typed.
 */

export type Role = "owner" | "admin" | "member" | "viewer";
export type PlanId = "free" | "team" | "business";

export type User = { id: string; name: string; email: string; createdAt: string; via: "email" | "google" };
export type Member = {
  email: string;
  role: Role;
  status: "active" | "invited" | "revoked";
  userId?: string;
  name?: string;
  invitedBy?: string;
  invitedAt?: string;
  acceptedAt?: string;
  token?: string;
};
export type Workspace = {
  id: string;
  name: string;
  slug: string;
  plan: PlanId;
  seats: number;
  card?: { brand: string; last4: string; exp: string };
  paidAt?: string;
  createdAt: string;
  ownerId: string;
  teamSize?: string;
  members: Member[];
  onboarded: boolean;
  demo?: boolean;
};
export type Db = { users: User[]; workspaces: Workspace[]; session: { userId: string; workspaceId?: string } | null };

export const PLANS: Record<PlanId, { name: string; price: number; blurb: string; maxUsers?: number; features: string[] }> = {
  free: { name: "Free", price: 0, blurb: "Small teams trying Zelo", maxUsers: 5, features: ["Up to 5 users", "1 product, 3 active releases", "Canvas, docs and workflows", "Limited AI"] },
  team: { name: "Team", price: 10, blurb: "Startups and small product teams", features: ["Unlimited releases", "Docs on every node", "Custom workflows", "Integrations", "AI credits included"] },
  business: { name: "Business", price: 20, blurb: "Growing companies and agencies", features: ["Everything in Team", "Multiple products", "Advanced AI and reports", "Guest access for clients"] },
};

export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" };
export const ROLE_HINT: Record<Role, string> = {
  owner: "Billing and everything else",
  admin: "Manage people and settings",
  member: "Create and edit work",
  viewer: "Can view and comment",
};

export const INVITE_DAYS = 7;
const KEY = "zelo-db-v1";
const EMPTY: Db = { users: [], workspaces: [], session: null };
const EVENT = "zelo-db";

export const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const nowIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
};
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
export const nameFromEmail = (e: string) =>
  e
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

let cacheRaw: string | null | undefined;
let cache: Db = EMPTY;

function read(): Db {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // storage blocked
  }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try {
      cache = raw ? (JSON.parse(raw) as Db) : EMPTY;
    } catch {
      cache = EMPTY;
    }
  }
  return cache;
}

function write(db: Db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // storage full or blocked
  }
  window.dispatchEvent(new Event(EVENT));
}

function update(fn: (db: Db) => Db) {
  write(fn(structuredClone(read())));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** The whole account db, or null while rendering on the server. */
export function useDb(): Db | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function currentUser(db: Db) {
  return db.users.find((u) => u.id === db.session?.userId);
}
export function currentWorkspace(db: Db) {
  const u = currentUser(db);
  if (!u) return undefined;
  const mine = db.workspaces.filter((w) => w.members.some((m) => m.userId === u.id && m.status === "active"));
  return mine.find((w) => w.id === db.session?.workspaceId) ?? mine[0];
}
export const findUserByEmail = (db: Db, email: string) => db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());

export function findInvite(db: Db, token: string) {
  for (const w of db.workspaces) {
    const m = w.members.find((x) => x.token === token);
    if (m) return { workspace: w, member: m };
  }
  return undefined;
}

export const inviteExpired = (m: Member) => !!m.invitedAt && Date.now() - new Date(m.invitedAt).getTime() > INVITE_DAYS * 86400000;

/* ---------- actions ---------- */

export function signUp(name: string, email: string, via: User["via"] = "email") {
  const db = read();
  const existing = findUserByEmail(db, email);
  if (existing) {
    update((d) => ({ ...d, session: { userId: existing.id } }));
    return existing;
  }
  const user: User = { id: uid("u"), name: name.trim() || nameFromEmail(email), email: email.trim().toLowerCase(), createdAt: nowIso(), via };
  update((d) => ({ ...d, users: [...d.users, user], session: { userId: user.id } }));
  return user;
}

export function logIn(userId: string, workspaceId?: string) {
  update((d) => ({ ...d, session: { userId, workspaceId } }));
}

export function logOut() {
  update((d) => ({ ...d, session: null }));
}

/** Creates the paid (or free) workspace right after checkout; onboarding fills in the rest. */
export function createWorkspace(ownerId: string, plan: PlanId, seats: number, card?: Workspace["card"]) {
  const db = read();
  const owner = db.users.find((u) => u.id === ownerId)!;
  const ws: Workspace = {
    id: uid("ws"),
    name: "",
    slug: "",
    plan,
    seats,
    card,
    paidAt: card ? nowIso() : undefined,
    createdAt: nowIso(),
    ownerId,
    members: [{ email: owner.email, role: "owner", status: "active", userId: owner.id, name: owner.name, acceptedAt: nowIso() }],
    onboarded: false,
  };
  update((d) => ({ ...d, workspaces: [...d.workspaces, ws], session: { userId: ownerId, workspaceId: ws.id } }));
  return ws;
}

export function updateWorkspace(id: string, patch: Partial<Workspace>) {
  update((d) => ({ ...d, workspaces: d.workspaces.map((w) => (w.id === id ? { ...w, ...patch } : w)) }));
}

/** Invites people by email. Returns the new invites (with their accept links' tokens). */
export function invite(workspaceId: string, emails: string[], role: Role, invitedBy: string) {
  const made: Member[] = [];
  update((d) => ({
    ...d,
    workspaces: d.workspaces.map((w) => {
      if (w.id !== workspaceId) return w;
      let members = [...w.members];
      for (const raw of emails) {
        const email = raw.trim().toLowerCase();
        const cur = members.find((m) => m.email === email);
        if (cur?.status === "active") continue;
        const m: Member = { email, role, status: "invited", invitedBy, invitedAt: nowIso(), token: uid("inv").replace("inv-", "") };
        members = cur ? members.map((x) => (x.email === email ? m : x)) : [...members, m];
        made.push(m);
      }
      return { ...w, members };
    }),
  }));
  return made;
}

export function resendInvite(workspaceId: string, email: string) {
  update((d) => ({
    ...d,
    workspaces: d.workspaces.map((w) =>
      w.id !== workspaceId ? w : { ...w, members: w.members.map((m) => (m.email === email ? { ...m, status: "invited", invitedAt: nowIso(), token: m.token ?? uid("t") } : m)) },
    ),
  }));
}

export function revokeInvite(workspaceId: string, email: string) {
  update((d) => ({
    ...d,
    workspaces: d.workspaces.map((w) => (w.id !== workspaceId ? w : { ...w, members: w.members.map((m) => (m.email === email ? { ...m, status: "revoked" } : m)) })),
  }));
}

export function removeMember(workspaceId: string, email: string) {
  update((d) => ({ ...d, workspaces: d.workspaces.map((w) => (w.id !== workspaceId ? w : { ...w, members: w.members.filter((m) => m.email !== email) })) }));
}

export function setRole(workspaceId: string, email: string, role: Role) {
  update((d) => ({ ...d, workspaces: d.workspaces.map((w) => (w.id !== workspaceId ? w : { ...w, members: w.members.map((m) => (m.email === email ? { ...m, role } : m)) })) }));
}

/** The invitee accepts: becomes an active member and is signed in to that workspace. */
export function acceptInvite(token: string, user: User) {
  update((d) => ({
    ...d,
    users: d.users.some((u) => u.id === user.id) ? d.users : [...d.users, user],
    workspaces: d.workspaces.map((w) => ({
      ...w,
      members: w.members.map((m) => (m.token === token ? { ...m, status: "active", userId: user.id, name: user.name, acceptedAt: nowIso() } : m)),
    })),
    session: { userId: user.id, workspaceId: d.workspaces.find((w) => w.members.some((m) => m.token === token))?.id },
  }));
}

/** The sample workspace (Acme Store) with Bhumika and Shashvat, signed in as Bhumika. */
export const DEMO_WS = "ws-demo";
export function enterDemo(asUserId = "p-bhumika") {
  update((d) => {
    const users = [...d.users];
    const add = (id: string, name: string, email: string) => !users.some((u) => u.id === id) && users.push({ id, name, email, createdAt: "2025-11-20T10:00:00", via: "email" });
    add("p-bhumika", "Bhumika Saxena", "bhumika@acme.example");
    add("p-shashvat", "Shashvat Singh", "shashvat@acme.example");
    const workspaces = d.workspaces.some((w) => w.id === DEMO_WS)
      ? d.workspaces
      : [
          ...d.workspaces,
          {
            id: DEMO_WS,
            name: "Acme",
            slug: "acme",
            plan: "team" as PlanId,
            seats: 5,
            card: { brand: "Visa", last4: "4242", exp: "08/28" },
            paidAt: "2025-11-20T10:00:00",
            createdAt: "2025-11-20T10:00:00",
            ownerId: "p-bhumika",
            members: [
              { email: "bhumika@acme.example", role: "owner" as Role, status: "active" as const, userId: "p-bhumika", name: "Bhumika Saxena", acceptedAt: "2025-11-20T10:00:00" },
              { email: "shashvat@acme.example", role: "admin" as Role, status: "active" as const, userId: "p-shashvat", name: "Shashvat Singh", invitedBy: "p-bhumika", invitedAt: "2025-11-20T10:05:00", acceptedAt: "2025-11-20T11:30:00" },
            ],
            onboarded: true,
            demo: true,
          },
        ];
    return { ...d, users, workspaces, session: { userId: asUserId, workspaceId: DEMO_WS } };
  });
}

export const PERSON_COLORS = ["var(--coral)", "var(--blue)", "var(--green)", "var(--amber)", "#1f8a8a", "#8a6a3a"];

/** Active members of a workspace as people on the board (demo people keep their fixed colours). */
export function peopleOf(w: Workspace, users: User[]) {
  return w.members
    .filter((m) => m.status === "active" && m.userId)
    .map((m, i) => {
      const u = users.find((x) => x.id === m.userId);
      return {
        id: m.userId!,
        name: u?.name ?? m.name ?? nameFromEmail(m.email),
        role: m.userId === "p-bhumika" ? "Product manager" : m.userId === "p-shashvat" ? "Developer" : ROLE_LABEL[m.role],
        color: m.userId === "p-bhumika" ? "var(--coral)" : m.userId === "p-shashvat" ? "var(--blue)" : PERSON_COLORS[i % PERSON_COLORS.length],
      };
    });
}

export const inviteDaysLeft = (m: Member) =>
  m.invitedAt ? Math.max(0, INVITE_DAYS - Math.floor((Date.now() - new Date(m.invitedAt).getTime()) / 86400000)) : 0;

export const yearFromNowLabel = () => new Date(Date.now() + 365 * 86400000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
