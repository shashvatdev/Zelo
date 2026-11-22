import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Zelo's database. Postgres 16+.
 * Every product table carries product_id so a product loads with indexed, parallel queries,
 * and every row is reachable from exactly one workspace (the unit of access control).
 */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const id = () => uuid("id").primaryKey().defaultRandom();

/* ---------- identity ---------- */

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(), // always stored lower-case
    name: text("name").notNull(),
    passwordHash: text("password_hash"), // null for Google-only accounts
    googleSub: text("google_sub"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email), uniqueIndex("users_google_sub_key").on(t.googleSub)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256 of the cookie token; the token itself is never stored
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").references((): AnyPgColumn => workspaces.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

/** Failed sign-in attempts, for rate limiting across all server instances. */
export const authAttempts = pgTable(
  "auth_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    key: text("key").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("auth_attempts_key_idx").on(t.key, t.createdAt)],
);

export const passwordResets = pgTable(
  "password_resets",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
  },
  (t) => [index("password_resets_user_idx").on(t.userId)],
);

/* ---------- workspaces, people, billing ---------- */

export const workspaces = pgTable(
  "workspaces",
  {
    id: id(),
    name: text("name").notNull().default(""),
    slug: text("slug"),
    plan: text("plan", { enum: ["free", "team", "business"] }).notNull(),
    seats: integer("seats").notNull(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),
    teamSize: text("team_size"),
    onboarded: boolean("onboarded").notNull().default(false),
    demo: boolean("demo").notNull().default(false),
    cardBrand: text("card_brand"),
    cardLast4: text("card_last4"),
    cardExp: text("card_exp"),
    paidUntil: ts("paid_until"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("workspaces_slug_key").on(t.slug), index("workspaces_owner_idx").on(t.ownerId)],
);

export const members = pgTable(
  "members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "member", "viewer"] }).notNull(),
    title: text("title"), // what they do, e.g. "Product manager"
    color: text("color").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    joinedAt: ts("joined_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] }), index("members_user_idx").on(t.userId)],
);

export const invites = pgTable(
  "invites",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role", { enum: ["admin", "member", "viewer"] }).notNull(),
    tokenHash: text("token_hash").notNull(),
    status: text("status", { enum: ["pending", "accepted", "revoked"] }).notNull().default("pending"),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    acceptedBy: uuid("accepted_by").references(() => users.id, { onDelete: "set null" }),
    acceptedAt: ts("accepted_at"),
  },
  (t) => [
    uniqueIndex("invites_token_key").on(t.tokenHash),
    // One live invite per person per workspace.
    uniqueIndex("invites_pending_email_key").on(t.workspaceId, t.email).where(sql`status = 'pending'`),
    index("invites_workspace_idx").on(t.workspaceId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    plan: text("plan").notNull(),
    seats: integer("seats").notNull(),
    amountCents: integer("amount_cents").notNull(),
    taxCents: integer("tax_cents").notNull().default(0),
    currency: text("currency").notNull().default("usd"),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref"),
    status: text("status", { enum: ["paid", "failed"] }).notNull(),
    failureReason: text("failure_reason"),
    cardBrand: text("card_brand"),
    cardLast4: text("card_last4"),
    gstin: text("gstin"),
    country: text("country"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("payments_workspace_idx").on(t.workspaceId, t.createdAt)],
);

/** Every email the app sends (or would send). In development this doubles as the mailbox. */
export const emails = pgTable(
  "emails",
  {
    id: id(),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    text: text("text").notNull(),
    kind: text("kind").notNull(),
    provider: text("provider").notNull(),
    providerId: text("provider_id"),
    error: text("error"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("emails_to_idx").on(t.to, t.createdAt)],
);

/* ---------- the product graph ---------- */

export const products = pgTable(
  "products",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Bumped on every change; clients poll it to know when to refetch. */
    version: bigint("version", { mode: "number" }).notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("products_workspace_idx").on(t.workspaceId)],
);

const productRef = () =>
  uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" });

export const modules = pgTable(
  "modules",
  {
    id: id(),
    productId: productRef(),
    name: text("name").notNull(),
    color: text("color").notNull(),
    keyPrefix: text("key_prefix").notNull(), // PAY, AUTH… used for feature/ticket keys
    isMisc: boolean("is_misc").notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("modules_name_key").on(t.productId, sql`lower(${t.name})`), index("modules_product_idx").on(t.productId)],
);

export const releases = pgTable(
  "releases",
  {
    id: id(),
    productId: productRef(),
    version: text("version").notNull(),
    name: text("name").notNull(),
    targetDate: date("target_date", { mode: "string" }).notNull(),
    state: text("state", { enum: ["shipped", "current", "planned"] }).notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("releases_version_key").on(t.productId, sql`lower(${t.version})`), index("releases_product_idx").on(t.productId)],
);

export const features = pgTable(
  "features",
  {
    id: id(),
    productId: productRef(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    extendsId: uuid("extends_id").references((): AnyPgColumn => features.id, { onDelete: "set null" }),
    spec: text("spec").notNull().default(""),
    createdAt: ts("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("features_key_key").on(t.productId, t.key), index("features_product_idx").on(t.productId), index("features_release_idx").on(t.releaseId)],
);

export const tickets = pgTable(
  "tickets",
  {
    id: id(),
    productId: productRef(),
    featureId: uuid("feature_id")
      .notNull()
      .references(() => features.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    title: text("title").notNull(),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status", { enum: ["todo", "dev", "qa", "done"] }).notNull().default("todo"),
    points: integer("points").notNull().default(2),
    createdAt: ts("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("tickets_key_key").on(t.productId, t.key),
    index("tickets_product_idx").on(t.productId),
    index("tickets_feature_idx").on(t.featureId),
    index("tickets_assignee_idx").on(t.assigneeId),
  ],
);

export const bugs = pgTable(
  "bugs",
  {
    id: id(),
    productId: productRef(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    title: text("title").notNull(),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status", { enum: ["todo", "dev", "qa", "done"] }).notNull().default("todo"),
    severity: text("severity", { enum: ["critical", "high", "medium", "low"] }).notNull(),
    introducedIn: uuid("introduced_in").references(() => releases.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("bugs_key_key").on(t.productId, t.key), index("bugs_product_idx").on(t.productId)],
);

/** Next number per key prefix (PAY, AUTH…), incremented atomically so keys never collide. */
export const keyCounters = pgTable(
  "key_counters",
  {
    productId: productRef(),
    prefix: text("prefix").notNull(),
    last: integer("last").notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.prefix] })],
);

const targetKind = () => text("target_kind", { enum: ["ticket", "feature", "bug"] }).notNull();

export const comments = pgTable(
  "comments",
  {
    id: id(),
    productId: productRef(),
    targetKind: targetKind(),
    targetId: uuid("target_id").notNull(),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("comments_target_idx").on(t.productId, t.targetKind, t.targetId), index("comments_product_idx").on(t.productId, t.createdAt)],
);

export const attachments = pgTable(
  "attachments",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id").references(() => comments.id, { onDelete: "cascade" }), // null until the comment is posted
    uploaderId: uuid("uploader_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    storageKey: text("storage_key").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("attachments_comment_idx").on(t.commentId), index("attachments_pending_idx").on(t.uploaderId, t.createdAt)],
);

export const activity = pgTable(
  "activity",
  {
    id: id(),
    productId: productRef(),
    targetKind: targetKind(),
    targetId: uuid("target_id").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind", { enum: ["created", "status", "assignee"] }).notNull(),
    fromValue: text("from_value"),
    toValue: text("to_value"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("activity_product_idx").on(t.productId, t.at), index("activity_target_idx").on(t.targetKind, t.targetId)],
);

export const notificationState = pgTable(
  "notification_state",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    readBefore: ts("read_before").notNull(),
    readIds: jsonb("read_ids").$type<string[]>().notNull().default([]),
  },
  (t) => [primaryKey({ columns: [t.userId, t.workspaceId] })],
);

/* ---------- Ask Zelo (AI copilot) ---------- */

/** One chat thread. Private to the person who started it, inside one workspace. */
export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New chat"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("ai_conversations_user_idx").on(t.userId, t.workspaceId, t.updatedAt)],
);

export type AiCard = {
  label: string;
  sub: string;
  tone?: "ok" | "warn" | "bad" | "muted";
  go: { scope: string; selected: { kind: "product" | "module" | "release" | "feature" | "ticket" | "bug" | "person"; id: string } | null };
};

/**
 * Messages, with the tokens each answer cost. workspace_id/user_id are copied here so
 * rate limits and daily token budgets are one indexed sum.
 */
export const aiMessages = pgTable(
  "ai_messages",
  {
    id: id(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    cards: jsonb("cards").$type<AiCard[]>().notNull().default([]),
    /** Tool calls made for this answer (name + arguments), for auditing. */
    tools: jsonb("tools").$type<{ name: string; args: unknown; ok: boolean }[]>().notNull().default([]),
    model: text("model"),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    error: text("error"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ai_messages_conversation_idx").on(t.conversationId, t.createdAt),
    index("ai_messages_workspace_idx").on(t.workspaceId, t.createdAt),
    index("ai_messages_user_idx").on(t.userId, t.createdAt),
  ],
);

/**
 * A change the AI wants to make. Nothing is written to the board until the person presses
 * Confirm; then it runs through the same validated runAction as a click in the UI.
 */
export const aiProposals = pgTable(
  "ai_proposals",
  {
    id: id(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => aiMessages.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The exact server action that Confirm will run. */
    action: jsonb("action").$type<Record<string, unknown>>().notNull(),
    /** What the item looked like when proposed; Confirm refuses if it changed since. */
    expect: jsonb("expect").$type<{ kind: "ticket" | "bug"; id: string; field: "status" | "assigneeId"; value: string | null } | null>(),
    title: text("title").notNull(),
    lines: jsonb("lines").$type<string[]>().notNull().default([]),
    card: jsonb("card").$type<AiCard | null>(),
    status: text("status", { enum: ["pending", "applied", "cancelled", "failed"] }).notNull().default("pending"),
    error: text("error"),
    createdAt: ts("created_at").notNull().defaultNow(),
    resolvedAt: ts("resolved_at"),
  },
  (t) => [index("ai_proposals_conversation_idx").on(t.conversationId), index("ai_proposals_message_idx").on(t.messageId)],
);
