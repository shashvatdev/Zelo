import { and, desc, eq, inArray, isNull, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { atLeast, type Role } from "./auth";
import { db, schema, type Tx } from "./db";
import { bumpVersion, memberIds, nextKey, prefixFor } from "./graph";
import { bad, forbidden, notFound } from "./http";

/**
 * Every change to a product board goes through here: validated, permission-checked,
 * done in one transaction, logged to the activity table, and the product version bumped
 * so other people's open boards pick it up.
 */

const status = z.enum(["todo", "dev", "qa", "done"]);
const uid = z.uuid();
const title = z.string().trim().min(1, "Give it a title.").max(200, "Keep it under 200 characters.");
const target = z.object({ kind: z.enum(["ticket", "feature", "bug"]), id: uid });

export const Action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ticketStatus"), id: uid, status }),
  z.object({ type: z.literal("ticketAssignee"), id: uid, assigneeId: uid.nullable() }),
  z.object({ type: z.literal("bugStatus"), id: uid, status }),
  z.object({ type: z.literal("addTicket"), id: uid.optional(), featureId: uid, title, assigneeId: uid.nullable().optional() }),
  z.object({ type: z.literal("addMiscTicket"), id: uid.optional(), releaseId: uid, title }),
  z.object({
    type: z.literal("addFeature"),
    id: uid.optional(),
    releaseId: uid,
    moduleId: uid,
    name: z.string().trim().min(1, "Name the feature.").max(120),
    ownerId: uid.nullable(),
    spec: z.string().max(20_000).default(""),
  }),
  z.object({
    type: z.literal("addRelease"),
    id: uid.optional(),
    version: z.string().trim().min(1, "Add a version number.").max(30),
    name: z.string().trim().max(80).default(""),
    date: z.iso.date("Use a valid date."),
    state: z.enum(["current", "planned", "shipped"]),
  }),
  z.object({ type: z.literal("addModule"), id: uid.optional(), name: z.string().trim().min(1, "Name the module.").max(60) }),
  z.object({ type: z.literal("addComment"), id: uid.optional(), target, body: z.string().max(10_000).default(""), attachmentIds: z.array(uid).max(10).default([]) }),
  z.object({ type: z.literal("deleteComment"), id: uid }),
]);
export type Action = z.infer<typeof Action>;

const MODULE_COLORS = ["#e5582b", "#3866c9", "#2f8f46", "#d48a1c", "#1f8a8a", "#b5401b", "#5a6fd6", "#8a6a3a"];

type Ctx = { tx: Tx; productId: string; workspaceId: string; actorId: string; role: Role };

async function log(c: Ctx, targetKind: "ticket" | "feature" | "bug", targetId: string, kind: "created" | "status" | "assignee", from?: string | null, to?: string | null) {
  await c.tx.insert(schema.activity).values({ productId: c.productId, targetKind, targetId, actorId: c.actorId, kind, fromValue: from ?? null, toValue: to ?? null });
}

async function one<T>(rows: Promise<T[]>, what: string) {
  const [r] = await rows;
  if (!r) throw notFound(`That ${what} doesn't exist (it may have been deleted).`);
  return r;
}

async function assertAssignable(c: Ctx, userId: string | null | undefined) {
  if (!userId) return;
  if (!(await memberIds(c.workspaceId, [userId], c.tx)).has(userId)) throw bad("That person isn't in this workspace.");
}

async function createTicket(c: Ctx, featureId: string, titleText: string, assigneeId: string | null, id?: string) {
  const f = await one(c.tx.select().from(schema.features).where(and(eq(schema.features.id, featureId), eq(schema.features.productId, c.productId))), "feature");
  await assertAssignable(c, assigneeId);
  const prefix = f.key.split("-")[0];
  const key = await nextKey(c.tx, c.productId, prefix);
  const [t] = await c.tx
    .insert(schema.tickets)
    .values({ ...(id ? { id } : {}), productId: c.productId, featureId, key, title: titleText, assigneeId, createdBy: c.actorId })
    .returning();
  await log(c, "ticket", t.id, "created");
  if (assigneeId && assigneeId !== c.actorId) await log(c, "ticket", t.id, "assignee", null, assigneeId);
  return t;
}

async function apply(c: Ctx, a: Action) {
  // Viewers can only talk: comment and delete their own comments.
  if (!atLeast(c.role, "member") && a.type !== "addComment" && a.type !== "deleteComment") throw forbidden("Viewers can comment but can't change work.");
  const P = c.productId;

  switch (a.type) {
    case "ticketStatus": {
      const t = await one(c.tx.select().from(schema.tickets).where(and(eq(schema.tickets.id, a.id), eq(schema.tickets.productId, P))).for("update"), "ticket");
      if (t.status === a.status) return;
      await c.tx.update(schema.tickets).set({ status: a.status }).where(eq(schema.tickets.id, t.id));
      return log(c, "ticket", t.id, "status", t.status, a.status);
    }
    case "ticketAssignee": {
      const t = await one(c.tx.select().from(schema.tickets).where(and(eq(schema.tickets.id, a.id), eq(schema.tickets.productId, P))).for("update"), "ticket");
      if (t.assigneeId === a.assigneeId) return;
      await assertAssignable(c, a.assigneeId);
      await c.tx.update(schema.tickets).set({ assigneeId: a.assigneeId }).where(eq(schema.tickets.id, t.id));
      return log(c, "ticket", t.id, "assignee", t.assigneeId, a.assigneeId);
    }
    case "bugStatus": {
      const b = await one(c.tx.select().from(schema.bugs).where(and(eq(schema.bugs.id, a.id), eq(schema.bugs.productId, P))).for("update"), "bug");
      if (b.status === a.status) return;
      await c.tx.update(schema.bugs).set({ status: a.status }).where(eq(schema.bugs.id, b.id));
      return log(c, "bug", b.id, "status", b.status, a.status);
    }
    case "addTicket":
      await createTicket(c, a.featureId, a.title, a.assigneeId === undefined ? c.actorId : a.assigneeId, a.id);
      return;
    case "addMiscTicket": {
      const rel = await one(c.tx.select().from(schema.releases).where(and(eq(schema.releases.id, a.releaseId), eq(schema.releases.productId, P))), "version");
      const misc = await one(c.tx.select().from(schema.modules).where(and(eq(schema.modules.productId, P), eq(schema.modules.isMisc, true))).limit(1), "Miscellaneous module");
      // Serialise bucket creation for this release so two people adding at once get one bucket.
      await c.tx.select({ id: schema.releases.id }).from(schema.releases).where(eq(schema.releases.id, rel.id)).for("update");
      let [bucket] = await c.tx.select().from(schema.features).where(and(eq(schema.features.moduleId, misc.id), eq(schema.features.releaseId, rel.id))).limit(1);
      if (!bucket) {
        const [prev] = await c.tx
          .select({ id: schema.features.id })
          .from(schema.features)
          .innerJoin(schema.releases, eq(schema.releases.id, schema.features.releaseId))
          .where(and(eq(schema.features.moduleId, misc.id), lt(schema.releases.targetDate, rel.targetDate)))
          .orderBy(desc(schema.releases.targetDate))
          .limit(1);
        [bucket] = await c.tx
          .insert(schema.features)
          .values({
            productId: P,
            moduleId: misc.id,
            releaseId: rel.id,
            key: await nextKey(c.tx, P, misc.keyPrefix),
            name: "Housekeeping",
            ownerId: c.actorId,
            extendsId: prev?.id ?? null,
            spec: "Work that doesn't belong to a feature: ops, admin and chores for this release.",
            createdBy: c.actorId,
          })
          .returning();
      }
      await createTicket(c, bucket.id, a.title, c.actorId, a.id);
      return;
    }
    case "addFeature": {
      const mod = await one(c.tx.select().from(schema.modules).where(and(eq(schema.modules.id, a.moduleId), eq(schema.modules.productId, P))), "module");
      const rel = await one(c.tx.select().from(schema.releases).where(and(eq(schema.releases.id, a.releaseId), eq(schema.releases.productId, P))), "version");
      await assertAssignable(c, a.ownerId);
      // A same-named feature in an earlier version of this module is what this one builds on.
      const earlier = await c.tx
        .select({ id: schema.features.id, name: schema.features.name })
        .from(schema.features)
        .innerJoin(schema.releases, eq(schema.releases.id, schema.features.releaseId))
        .where(and(eq(schema.features.moduleId, mod.id), lt(schema.releases.targetDate, rel.targetDate)))
        .orderBy(desc(schema.releases.targetDate));
      const same = earlier.find((f) => f.name.toLowerCase() === a.name.toLowerCase());
      const [f] = await c.tx
        .insert(schema.features)
        .values({
          ...(a.id ? { id: a.id } : {}),
          productId: P,
          moduleId: mod.id,
          releaseId: rel.id,
          key: await nextKey(c.tx, P, mod.keyPrefix),
          name: a.name,
          ownerId: a.ownerId,
          extendsId: same?.id ?? null,
          spec: a.spec.trim() || "No spec yet.",
          createdBy: c.actorId,
        })
        .returning();
      return log(c, "feature", f.id, "created");
    }
    case "addRelease": {
      if (a.state === "current") await c.tx.update(schema.releases).set({ state: "shipped" }).where(and(eq(schema.releases.productId, P), eq(schema.releases.state, "current")));
      await c.tx.insert(schema.releases).values({ ...(a.id ? { id: a.id } : {}), productId: P, version: a.version, name: a.name || "Untitled", targetDate: a.date, state: a.state });
      return;
    }
    case "addModule": {
      const count = (await c.tx.select({ id: schema.modules.id }).from(schema.modules).where(and(eq(schema.modules.productId, P), eq(schema.modules.isMisc, false)))).length;
      await c.tx.insert(schema.modules).values({
        ...(a.id ? { id: a.id } : {}),
        productId: P,
        name: a.name,
        color: MODULE_COLORS[count % MODULE_COLORS.length],
        keyPrefix: await prefixFor(c.tx, P, a.name),
        position: count,
      });
      return;
    }
    case "addComment": {
      if (!a.body.trim() && !a.attachmentIds.length) throw bad("Write something or attach a file.");
      const table = a.target.kind === "ticket" ? schema.tickets : a.target.kind === "bug" ? schema.bugs : schema.features;
      await one(c.tx.select({ id: table.id }).from(table).where(and(eq(table.id, a.target.id), eq(table.productId, P))), a.target.kind);
      const [cm] = await c.tx
        .insert(schema.comments)
        .values({ ...(a.id ? { id: a.id } : {}), productId: P, targetKind: a.target.kind, targetId: a.target.id, authorId: c.actorId, body: a.body.trim() })
        .returning();
      if (a.attachmentIds.length) {
        const linked = await c.tx
          .update(schema.attachments)
          .set({ commentId: cm.id })
          .where(and(inArray(schema.attachments.id, a.attachmentIds), eq(schema.attachments.uploaderId, c.actorId), eq(schema.attachments.workspaceId, c.workspaceId), isNull(schema.attachments.commentId)))
          .returning({ id: schema.attachments.id });
        if (linked.length !== new Set(a.attachmentIds).size) throw bad("One of the files is missing. Upload it again.");
      }
      return;
    }
    case "deleteComment": {
      const cm = await one(c.tx.select().from(schema.comments).where(and(eq(schema.comments.id, a.id), eq(schema.comments.productId, P))), "comment");
      if (cm.authorId !== c.actorId && !atLeast(c.role, "admin")) throw forbidden("You can only delete your own comments.");
      await c.tx.delete(schema.comments).where(eq(schema.comments.id, cm.id)); // attachments cascade
      return;
    }
  }
}

export async function runAction(workspaceId: string, productId: string, actorId: string, role: Role, action: Action) {
  await db.transaction(async (tx) => {
    await apply({ tx, productId, workspaceId, actorId, role }, action);
    await bumpVersion(tx, productId);
  });
}

/** Files left unattached for a day (uploaded, comment never sent) are swept. */
export async function stalePendingAttachments() {
  return db
    .select()
    .from(schema.attachments)
    .where(and(isNull(schema.attachments.commentId), lt(schema.attachments.createdAt, new Date(Date.now() - 86400000)), ne(schema.attachments.size, -1)))
    .limit(200);
}
