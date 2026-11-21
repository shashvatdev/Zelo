/**
 * The work graph, as in the spec: modules (permanent), releases (versions), features that
 * belong to one module AND one release, tickets under features, bugs on modules planned into
 * releases, and "extends" links between versions of a feature.
 *
 * This is demo data held in the browser. The store is written so a Postgres API can replace it.
 */

export type Status = "todo" | "dev" | "qa" | "done";
export type Severity = "critical" | "high" | "medium" | "low";

export type Person = { id: string; name: string; role: string; color: string };
/** `misc`: the catch-all module for work that doesn't belong to a feature (ops, admin, chores). */
export type Module = {
  id: string;
  name: string;
  color: string;
  misc?: boolean;
};
export type Release = {
  id: string;
  version: string;
  name: string;
  date: string; // ISO
  state: "shipped" | "current" | "planned";
};
export type Feature = {
  id: string;
  key: string;
  name: string;
  moduleId: string;
  releaseId: string;
  ownerId: string | null;
  extendsId?: string;
  spec: string;
  createdAt: string; // ISO
  createdBy: string | null;
};
export type Ticket = {
  id: string;
  key: string;
  title: string;
  featureId: string;
  assigneeId: string | null;
  status: Status;
  points: number;
  createdAt: string; // ISO
  createdBy: string | null;
};
export type Bug = {
  id: string;
  key: string;
  title: string;
  moduleId: string;
  releaseId: string;
  assigneeId: string | null;
  status: Status;
  severity: Severity;
  introducedIn?: string;
  createdAt: string; // ISO
  createdBy: string | null;
};

/** File metadata. The bytes live in the browser's IndexedDB (see lib/files.ts) for this demo. */
export type Attachment = {
  id: string;
  name: string;
  type: string;
  size: number;
};
export type CommentTarget = { kind: "ticket" | "feature" | "bug"; id: string };
export type Comment = {
  id: string;
  target: CommentTarget;
  authorId: string;
  /** Plain text; "@Full Name" marks a mention. */
  body: string;
  createdAt: string; // ISO
  attachments: Attachment[];
};

/** System log entries, written automatically and shown in the task's thread next to comments. */
export type Activity = {
  id: string;
  target: CommentTarget;
  actorId: string | null;
  at: string; // ISO
  kind: "created" | "status" | "assignee";
  from?: string | null;
  to?: string | null;
};

export type Graph = {
  product: { id: string; name: string };
  people: Person[];
  modules: Module[];
  releases: Release[];
  features: Feature[];
  tickets: Ticket[];
  bugs: Bug[];
  comments: Comment[];
  activity: Activity[];
};

export const STATUS_LABEL: Record<Status, string> = {
  todo: "To do",
  dev: "In dev",
  qa: "In QA",
  done: "Done",
};
export const STATUS_ORDER: Status[] = ["todo", "dev", "qa", "done"];
