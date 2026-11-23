"use client";

import { api, clearQueries, revalidate, setQueryData, useQuery } from "./api";

/** Accounts, workspaces, members, invites and billing: thin client over the API. */

export type Role = "owner" | "admin" | "member" | "viewer";
export type PlanId = "free" | "team" | "business";

export type Me = {
  user: { id: string; name: string; email: string; hasPassword: boolean };
  workspaces: { id: string; name: string; role: Role; onboarded: boolean; plan: PlanId; demo: boolean; isOwner: boolean }[];
  activeWorkspaceId: string | null;
};
export type WsMember = { userId: string; name: string; email: string; role: Role; title: string | null; color: string; joinedAt: string; invitedBy: string | null };
export type WsInvite = { id: string; email: string; role: Exclude<Role, "owner">; createdAt: string; expiresAt: string; invitedBy: string | null; inviterName: string | null; expired: boolean };
export type Workspace = {
  id: string;
  name: string;
  slug: string | null;
  plan: PlanId;
  seats: number;
  onboarded: boolean;
  demo: boolean;
  teamSize: string | null;
  createdAt: string;
  role: Role;
  card: { brand: string; last4: string; exp: string } | null;
  paidUntil: string | null;
  product: { id: string; name: string } | null;
  members: WsMember[];
  invites: WsInvite[];
  canManage: boolean;
};
export type SentInvite = { id: string; email: string; role: string; link: string; emailId: string; emailError: string | null };
export type Providers = { google: boolean; devMailbox: boolean; demo: boolean };

export const PLANS: Record<PlanId, { name: string; price: number; blurb: string; maxUsers?: number; features: string[] }> = {
  free: { name: "Free", price: 0, blurb: "Small teams trying Zelo", maxUsers: 5, features: ["Up to 5 users", "1 product, 3 active releases", "Canvas, docs and workflows", "Limited AI"] },
  team: { name: "Team", price: 10, blurb: "Startups and small product teams", features: ["Unlimited releases", "Docs on every node", "Custom workflows", "Integrations", "AI credits included"] },
  business: { name: "Business", price: 20, blurb: "Growing companies and agencies", features: ["Everything in Team", "Multiple products", "Advanced AI and reports", "Guest access for clients"] },
};
export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" };
export const ROLE_HINT: Record<Role, string> = { owner: "Billing and everything else", admin: "Manage people and settings", member: "Create and edit work", viewer: "Can view and comment" };
export const INVITE_DAYS = 7;
export const PERSON_COLORS = ["var(--coral)", "var(--blue)", "var(--green)", "var(--amber)", "#1f8a8a", "#8a6a3a"];

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
export const inviteDaysLeft = (expiresAt: string) => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000));
export const yearFromNowLabel = () => new Date(Date.now() + 365 * 86400000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/* ---------- reads ---------- */

export const ME = "/api/auth/me";
export const wsKey = (id: string) => `/api/workspaces/${id}`;

/** The signed-in person (null when signed out, undefined while loading). */
export function useMe() {
  const q = useQuery<Me>(ME);
  const signedOut = q.error?.status === 401;
  return { me: signedOut ? null : q.data, loading: q.loading, error: signedOut ? undefined : q.error, reload: q.reload };
}

export const useWorkspace = (id: string | null | undefined) => useQuery<Workspace>(id ? wsKey(id) : null);
export const useProviders = () => useQuery<Providers>("/api/auth/providers");

const refreshMe = () => revalidate(ME);

/** Fetch the signed-in person fresh (and update every component showing them). */
export async function loadMe() {
  const me = await api<Me>(ME);
  setQueryData(ME, me);
  return me;
}

export { nextPath, safeNext } from "./flow";
const refreshWs = (id: string) => Promise.all([revalidate(wsKey(id)), revalidate(ME)]);

/* ---------- auth ---------- */

export async function signUp(name: string, email: string, password: string) {
  await api("/api/auth/signup", { body: { name, email, password } });
  clearQueries();
  return loadMe();
}

export async function logIn(email: string, password: string) {
  await api("/api/auth/login", { body: { email, password } });
  clearQueries();
  return loadMe();
}

export async function logOut() {
  await api("/api/auth/logout", { method: "POST" });
  clearQueries();
  setQueryData(ME, undefined);
}

export async function switchWorkspace(workspaceId: string) {
  await api("/api/auth/switch", { body: { workspaceId } });
  await refreshMe();
}

export async function forgotPassword(email: string) {
  await api("/api/auth/forgot", { body: { email } });
}

export async function resetPassword(token: string, password: string) {
  await api("/api/auth/reset", { body: { token, password } });
  clearQueries();
  await refreshMe();
}

/** Opens the shared sample workspace as Bhumika (or Shashvat). */
export async function enterDemo(as: "bhumika" | "shashvat" = "bhumika") {
  await api("/api/demo", { body: { as } });
  clearQueries();
  await refreshMe();
}

/* ---------- workspace ---------- */

export type CheckoutInput = { plan: PlanId; seats: number; country?: string; gstin?: string; card?: { number: string; exp: string; cvc: string; name: string }; workspaceId?: string };
export type CheckoutResult = { workspaceId: string; plan: PlanId; seats: number; totalCents: number; taxCents: number; card: { brand: string; last4: string } | null; demo: boolean; renews: string | null };
export async function checkout(input: CheckoutInput) {
  const r = await api<CheckoutResult>("/api/checkout", { body: input });
  await refreshWs(r.workspaceId);
  return r;
}

export type OnboardInput = {
  name: string;
  slug: string;
  teamSize?: string;
  title?: string;
  productName: string;
  mode: "empty" | "sample";
  modules: string[];
  release?: { version: string; name: string; date: string };
};
export async function onboard(workspaceId: string, input: OnboardInput) {
  const ws = await api<Workspace>(`/api/workspaces/${workspaceId}/onboard`, { body: input });
  setQueryData(wsKey(workspaceId), ws);
  await refreshMe();
  return ws;
}

export async function updateWorkspace(id: string, patch: { name?: string; slug?: string; teamSize?: string }) {
  const ws = await api<Workspace>(wsKey(id), { method: "PATCH", body: patch });
  setQueryData(wsKey(id), ws);
  await refreshMe();
  return ws;
}

export async function setSeats(id: string, seats: number) {
  setQueryData(wsKey(id), await api<Workspace>(`/api/workspaces/${id}/seats`, { method: "PATCH", body: { seats } }));
}

export async function invite(workspaceId: string, emails: string[], role: Exclude<Role, "owner">) {
  const r = await api<{ invites: SentInvite[] }>(`/api/workspaces/${workspaceId}/invites`, { body: { emails, role } });
  await refreshWs(workspaceId);
  return r.invites;
}

export async function revokeInvite(workspaceId: string, inviteId: string) {
  await api(`/api/workspaces/${workspaceId}/invites/${inviteId}`, { method: "DELETE" });
  await refreshWs(workspaceId);
}

export async function resendInvite(workspaceId: string, inviteId: string) {
  const r = await api<{ link: string }>(`/api/workspaces/${workspaceId}/invites/${inviteId}/resend`, { method: "POST" });
  await refreshWs(workspaceId);
  return r.link;
}

/** A fresh copyable link (the previous one stops working). */
export async function inviteLink(workspaceId: string, inviteId: string) {
  return (await api<{ link: string }>(`/api/workspaces/${workspaceId}/invites/${inviteId}/link`, { method: "POST" })).link;
}

export async function setRole(workspaceId: string, userId: string, role: Exclude<Role, "owner">) {
  setQueryData(wsKey(workspaceId), await api<Workspace>(`/api/workspaces/${workspaceId}/members/${userId}`, { method: "PATCH", body: { role } }));
}

export async function removeMember(workspaceId: string, userId: string) {
  setQueryData(wsKey(workspaceId), await api<Workspace>(`/api/workspaces/${workspaceId}/members/${userId}`, { method: "DELETE" }));
}

export type InviteInfo =
  | { status: "missing" | "revoked" | "used" | "expired"; workspace?: { name: string } }
  | {
      status: "valid";
      email: string;
      role: Exclude<Role, "owner">;
      inviterName: string | null;
      workspace: { id: string; name: string };
      teamCount: number;
      existingAccount: boolean;
      accountHasPassword: boolean;
      signedInAs: { email: string; name: string } | null;
    };

export async function acceptInvite(token: string, input: { name?: string; password?: string }) {
  const r = await api<{ workspaceId: string; role: Role; workspaceName: string }>(`/api/invites/${encodeURIComponent(token)}/accept`, { body: input });
  clearQueries();
  await refreshMe();
  return r;
}
