import { and, eq } from "drizzle-orm";
import { Action, runAction } from "../actions";
import type { Role } from "../auth";
import { db, schema } from "../db";
import { productOf } from "../graph";
import { HttpError, notFound } from "../http";
import { proposalView } from "./agent";

/**
 * Confirm or cancel a change Ask Zelo proposed. Only the person it was proposed to can decide.
 * Confirm re-checks everything: still pending, not too old, the item hasn't changed since it was
 * proposed, and the action passes the same validation and permission checks as a click in the UI.
 */

const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export async function decideProposal(o: { id: string; workspaceId: string; userId: string; role: Role; decision: "apply" | "cancel" }) {
  // Claim it atomically so a double click can't apply it twice.
  const [p] = await db
    .update(schema.aiProposals)
    .set({ status: o.decision === "cancel" ? "cancelled" : "applied", resolvedAt: new Date() })
    .where(and(eq(schema.aiProposals.id, o.id), eq(schema.aiProposals.workspaceId, o.workspaceId), eq(schema.aiProposals.userId, o.userId), eq(schema.aiProposals.status, "pending")))
    .returning();
  if (!p) {
    const [cur] = await db
      .select()
      .from(schema.aiProposals)
      .where(and(eq(schema.aiProposals.id, o.id), eq(schema.aiProposals.workspaceId, o.workspaceId), eq(schema.aiProposals.userId, o.userId)));
    if (!cur) throw notFound("That change doesn't exist.");
    return proposalView(cur); // already decided: report how
  }
  if (o.decision === "cancel") return proposalView(p);

  const failWith = async (message: string) => {
    const [f] = await db.update(schema.aiProposals).set({ status: "failed", error: message }).where(eq(schema.aiProposals.id, p.id)).returning();
    return proposalView(f);
  };

  if (Date.now() - p.createdAt.getTime() > MAX_AGE_MS) return failWith("This suggestion is over an hour old. Ask again so it uses the latest board.");
  const product = await productOf(o.workspaceId);
  if (!product) throw notFound("This workspace has no product yet.");

  // Someone changed the item after the suggestion was made: don't overwrite their work.
  if (p.expect) {
    const table = p.expect.kind === "ticket" ? schema.tickets : schema.bugs;
    const [row] = await db.select().from(table).where(and(eq(table.id, p.expect.id), eq(table.productId, product.id)));
    if (!row) return failWith("That item was deleted.");
    const now = p.expect.field === "status" ? row.status : (row.assigneeId ?? null);
    if (now !== p.expect.value) return failWith("It was changed by someone else after I suggested this. Ask me again with the latest board.");
  }

  const parsed = Action.safeParse(p.action);
  if (!parsed.success) return failWith("This change is no longer valid.");
  try {
    await runAction(o.workspaceId, product.id, o.userId, o.role, parsed.data);
  } catch (e) {
    if (e instanceof HttpError) return failWith(e.message);
    const pg = ((e as { cause?: unknown })?.cause ?? e) as { code?: string };
    if (pg?.code === "23505") return failWith("That already exists now.");
    if (pg?.code === "23503") return failWith("Something it depends on was just removed.");
    throw e;
  }
  return proposalView(p);
}

