import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { ask as demoAnswer } from "@/lib/ask";
import type { Role } from "../auth";
import { config } from "../config";
import { db, schema } from "../db";
import type { AiCard } from "../db/schema";
import { loadGraph, productOf } from "../graph";
import { HttpError, notFound } from "../http";
import { AiUnavailable, chat, RateLimited, type ChatMessage } from "./groq";
import { systemPrompt, type View } from "./prompt";
import { itemById, itemsByKeys, loadDims, summary as boardSummary, type Dims } from "./board";
import { cardOf, runTool, toolsFor, toolStatus, type Proposal, type ToolCtx } from "./tools";

/**
 * One question → one answer. The loop:
 *   build context (prompt + board snapshot + recent history) → model → tools → model … → answer
 * then a guard pass: any item key in the answer that doesn't exist on the board sends the answer
 * back for a rewrite, so made-up tickets never reach the person. Cards are built from database
 * rows, not from model text. Everything (tokens, tool calls, proposals) is saved.
 */

export type AskEvent =
  | { type: "meta"; conversationId: string; title: string }
  | { type: "status"; text: string }
  | { type: "delta"; text: string }
  | { type: "reset" }
  | { type: "done"; message: SavedMessage };

export type ProposalView = { id: string; title: string; lines: string[]; card: AiCard | null; status: "pending" | "applied" | "cancelled" | "failed"; error: string | null };
export type SavedMessage = { id: string; role: "user" | "assistant"; content: string; cards: AiCard[]; proposals: ProposalView[]; createdAt: string; error?: string | null };

const MAX_ROUNDS = 6;
const HISTORY = 12;
const KEY_RE = /\b[A-Z][A-Z0-9]{1,6}-\d{2,6}\b/g;
const TOOL_RESULT_MAX = 12_000; // ~3k tokens; tools are designed to stay under this

/* ---------- limits ---------- */

/**
 * At most 2 answers in flight per person on this server. The per-minute count below only sees
 * questions already saved, so without this a burst of parallel requests could slip past it.
 */
const inflight = new Map<string, number>();
export function acquireSlot(userId: string) {
  const n = inflight.get(userId) ?? 0;
  if (n >= 2) throw new HttpError(429, "One question at a time, please. Let the current answer finish.", "rate_limited");
  inflight.set(userId, n + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const left = (inflight.get(userId) ?? 1) - 1;
    if (left <= 0) inflight.delete(userId);
    else inflight.set(userId, left);
  };
}

export async function checkLimits(userId: string, workspaceId: string, plan: string) {
  const minuteAgo = new Date(Date.now() - 60_000);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.aiMessages)
    .where(and(eq(schema.aiMessages.userId, userId), eq(schema.aiMessages.role, "user"), gte(schema.aiMessages.createdAt, minuteAgo)));
  if (n >= config.ai.perMinute) throw new HttpError(429, "Easy, speed racer. Give it a few seconds and ask again.", "rate_limited");
  const budget = config.ai.dailyTokens[plan] ?? config.ai.dailyTokens.free;
  if (budget > 0) {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const [{ used }] = await db
      .select({ used: sql<number>`coalesce(sum(${schema.aiMessages.promptTokens} + ${schema.aiMessages.completionTokens}), 0)::int` })
      .from(schema.aiMessages)
      .where(and(eq(schema.aiMessages.workspaceId, workspaceId), gte(schema.aiMessages.createdAt, start)));
    if (used >= budget) throw new HttpError(429, "Your workspace has used today's Ask Zelo allowance. It resets at midnight UTC.", "ai_budget");
  }
}

/* ---------- conversations ---------- */

export async function listConversations(userId: string, workspaceId: string) {
  return db
    .select({ id: schema.aiConversations.id, title: schema.aiConversations.title, updatedAt: schema.aiConversations.updatedAt })
    .from(schema.aiConversations)
    .where(and(eq(schema.aiConversations.userId, userId), eq(schema.aiConversations.workspaceId, workspaceId)))
    .orderBy(desc(schema.aiConversations.updatedAt))
    .limit(40);
}

export async function ownConversation(id: string, userId: string, workspaceId: string) {
  const [c] = await db
    .select()
    .from(schema.aiConversations)
    .where(and(eq(schema.aiConversations.id, id), eq(schema.aiConversations.userId, userId), eq(schema.aiConversations.workspaceId, workspaceId)));
  if (!c) throw notFound("That chat doesn't exist.");
  return c;
}

export async function conversationMessages(conversationId: string): Promise<SavedMessage[]> {
  const [msgs, props] = await Promise.all([
    db.select().from(schema.aiMessages).where(eq(schema.aiMessages.conversationId, conversationId)).orderBy(asc(schema.aiMessages.createdAt)),
    db.select().from(schema.aiProposals).where(eq(schema.aiProposals.conversationId, conversationId)).orderBy(asc(schema.aiProposals.createdAt)),
  ]);
  return msgs.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    cards: m.cards,
    createdAt: m.createdAt.toISOString(),
    error: m.error,
    proposals: props.filter((p) => p.messageId === m.id).map(proposalView),
  }));
}

export const proposalView = (p: typeof schema.aiProposals.$inferSelect): ProposalView => ({ id: p.id, title: p.title, lines: p.lines, card: p.card, status: p.status, error: p.error });

/** Earlier turns for the model: text only, with each proposed change and what became of it. */
async function history(conversationId: string): Promise<ChatMessage[]> {
  const msgs = (
    await db
      .select({ id: schema.aiMessages.id, role: schema.aiMessages.role, content: schema.aiMessages.content })
      .from(schema.aiMessages)
      .where(eq(schema.aiMessages.conversationId, conversationId))
      .orderBy(desc(schema.aiMessages.createdAt))
      .limit(HISTORY)
  ).reverse();
  const ids = msgs.filter((m) => m.role === "assistant").map((m) => m.id);
  const props = ids.length ? await db.select().from(schema.aiProposals).where(inArray(schema.aiProposals.messageId, ids)) : [];
  // History must start with the person speaking.
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs.map((m) => {
    if (m.role === "user") return { role: "user", content: m.content.slice(0, 3000) };
    const mine = props.filter((p) => p.messageId === m.id);
    const notes = mine.map((p) => `[change "${p.title}": ${p.status === "pending" ? "not confirmed yet" : p.status}${p.error ? ` — ${p.error}` : ""}]`);
    return { role: "assistant", content: [m.content.slice(0, 3000), ...notes].join("\n") };
  });
}

/* ---------- the loop ---------- */

export async function runAsk(o: {
  workspaceId: string;
  plan: string;
  user: { id: string; name: string; email: string };
  role: Role;
  conversationId?: string | null;
  message: string;
  view: View;
  signal: AbortSignal;
  emit: (e: AskEvent) => void;
}) {
  const product = await productOf(o.workspaceId);
  if (!product) throw notFound("This workspace has no product yet.");

  // Conversation + the question, saved first so nothing is lost if the answer fails.
  let conv = o.conversationId ? await ownConversation(o.conversationId, o.user.id, o.workspaceId) : null;
  if (!conv) {
    const title = o.message.replace(/\s+/g, " ").trim().slice(0, 60) || "New chat";
    [conv] = await db.insert(schema.aiConversations).values({ workspaceId: o.workspaceId, userId: o.user.id, title }).returning();
  }
  const past = await history(conv.id);
  await db.insert(schema.aiMessages).values({ conversationId: conv.id, workspaceId: o.workspaceId, userId: o.user.id, role: "user", content: o.message });
  o.emit({ type: "meta", conversationId: conv.id, title: conv.title });

  // Small tables + cached aggregates only; big tables are read by the tools, query by query.
  const dims = await loadDims(o.workspaceId, product.id);
  const [summary, open] = await Promise.all([boardSummary(product.id, dims.product.version), o.view.selected ? itemById(product.id, o.view.selected.kind, o.view.selected.id) : null]);
  const ctx: ToolCtx = { dims, workspaceId: o.workspaceId, productId: product.id, user: o.user, role: o.role, plan: o.plan, proposals: [], scope: o.view.scope };
  const tools = toolsFor(o.role);
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt({ dims, summary, open, user: o.user, role: o.role, view: o.view, now: new Date() }) }, ...past, { role: "user", content: o.message }];

  const usage = { prompt: 0, completion: 0 };
  const audit: { name: string; args: unknown; ok: boolean }[] = [];
  let model: string | null = null;
  let answer = "";
  let error: string | null = null;

  const turn = async (withTools: boolean) => {
    let streamedAny = false;
    const r = await chat({
      messages,
      tools: withTools ? tools : [],
      signal: o.signal,
      onText: (d) => {
        streamedAny = true;
        o.emit({ type: "delta", text: d });
      },
      onRestart: () => o.emit({ type: "reset" }),
      onWait: (ms) => o.emit({ type: "status", text: `The AI is busy, retrying in ${Math.ceil(ms / 1000)}s` }),
    });
    usage.prompt += r.usage.prompt;
    usage.completion += r.usage.completion;
    model = r.model;
    return { ...r, streamedAny };
  };

  try {
    let done = false;
    for (let round = 0; round < MAX_ROUNDS && !done; round++) {
      const r = await turn(true);
      if (!r.toolCalls.length) {
        answer = r.content;
        done = true;
        break;
      }
      // Text before a tool call is a preamble ("let me check…"): clear it, show progress instead.
      if (r.streamedAny) o.emit({ type: "reset" });
      messages.push({ role: "assistant", content: r.content || null, tool_calls: r.toolCalls });
      for (const call of r.toolCalls) {
        o.emit({ type: "status", text: toolStatus(call.function.name, call.function.arguments) });
        const res = await runTool(call.function.name, call.function.arguments, ctx);
        audit.push({ name: call.function.name, args: res.args, ok: res.ok });
        let content = JSON.stringify(res.result);
        if (content.length > TOOL_RESULT_MAX) content = `${content.slice(0, TOOL_RESULT_MAX)}… [cut: ask a narrower question or use filters]`;
        messages.push({ role: "tool", tool_call_id: call.id, content });
      }
    }
    if (!done) {
      // Out of rounds: answer with what has been gathered.
      messages.push({ role: "user", content: "(System: stop calling tools. Answer now using only the tool results above, and say clearly if something is missing.)" });
      answer = (await turn(false)).content;
    }

    // Guard: keys that don't exist on the board mean the answer made something up. One rewrite.
    answer = normalizeKeys(answer);
    // Keys the person typed themselves are fine to repeat ("PAY-777 doesn't exist").
    const fake = await unknownKeys(dims, product.id, answer, o.message);
    if (fake.length) {
      console.warn("[ai] answer used unknown keys", fake);
      o.emit({ type: "reset" });
      o.emit({ type: "status", text: "Double-checking the facts" });
      messages.push({ role: "assistant", content: answer });
      messages.push({ role: "user", content: `(System check: ${fake.join(", ")} do not exist on this board. Rewrite your answer using only items returned by tools, without those keys. Don't mention this check.)` });
      answer = normalizeKeys((await turn(false)).content);
      const still = await unknownKeys(dims, product.id, answer, o.message);
      if (still.length) answer = answer.replace(KEY_RE, (k) => (still.includes(k) ? "(unknown item)" : k));
    }
    // Guard 2: talking about a confirm card when no change was prepared this turn.
    if (!ctx.proposals.length && CLAIMS_CARD.test(answer.replace(/["“”'‘’]/g, ""))) {
      console.warn("[ai] answer mentioned a card that doesn't exist");
      o.emit({ type: "reset" });
      o.emit({ type: "status", text: "Double-checking the facts" });
      messages.push({ role: "assistant", content: answer });
      messages.push({ role: "user", content: "(System check: no change card was created in this turn, so nothing is waiting for Confirm. Rewrite your answer without saying a card is ready or asking them to press Confirm. If they want a change, ask them to say so. Don't mention this check.)" });
      answer = normalizeKeys((await turn(false)).content);
    }
    if (!answer.trim()) answer = ctx.proposals.length ? "Here's the change, ready for you to confirm:" : "I couldn't put an answer together for that. Could you rephrase it?";
  } catch (e) {
    if (o.signal.aborted) {
      error = "stopped";
      answer = "(Stopped before answering.)";
    } else if (e instanceof AiUnavailable) {
      // Groq is rate-limiting or down. Say so honestly; only use the built-in board engine when it
      // actually matched the question (it answers a fixed set of question types).
      error = e instanceof RateLimited ? "rate_limited" : "ai_unavailable";
      // The built-in engine needs the whole board in memory: only worth it on small boards.
      const fb = summary.totals.tickets <= 3000 ? demoAnswer((await loadGraph(o.workspaceId, product.id)).graph, o.message, o.view.scope) : { text: "", items: [] };
      const secs = e instanceof RateLimited ? Math.max(5, Math.ceil(e.waitMs / 1000)) : 0;
      const busy = e instanceof RateLimited ? `I've hit the AI's speed limit for the moment. Ask again in about ${secs} seconds.` : "The AI isn't reachable right now. Please try again in a minute.";
      answer = fb.items.length ? `${fb.text}\n\n_(${busy} Meanwhile, this is a quick answer straight from the board.)_` : busy;
      o.emit({ type: "reset" });
      o.emit({ type: "delta", text: answer });
      const saved = await save(o, conv.id, answer, fb.items.length ? (fb.items as AiCard[]) : [], [], usage, audit, model, error);
      o.emit({ type: "done", message: saved });
      return;
    } else throw e;
  }

  const cards = await cardsFrom(dims, product.id, answer, ctx.proposals);
  const saved = await save(o, conv.id, answer, cards, ctx.proposals, usage, audit, model, error);
  o.emit({ type: "done", message: saved });
}

/** Phrases that say a confirm card is waiting (English and Hinglish). */
const CLAIMS_CARD = /card (is )?ready|card ready (hai|below)|ready to confirm|ready for you to confirm|confirm (dabao|daba do|kar do below|below|button)|press confirm|click confirm|bas confirm|confirm card/i;

/** Models sometimes write keys with typographic hyphens (PAY‑191); make them plain so they link and get checked. */
const normalizeKeys = (t: string) => t.replace(/[\u00a0\u202f\u2007]/g, " ").replace(/\b([A-Z][A-Z0-9]{1,6})[\u2010-\u2015\u2212\uFE63\uFF0D](\d{2,6})\b/g, "$1-$2");

/**
 * Key-shaped tokens in the answer that don't exist on this board. Only tokens with one of the
 * board's prefixes count (so "COVID-19" isn't flagged), and keys the person typed are allowed
 * ("PAY-777 doesn't exist"). One batched, indexed lookup, whatever the board's size.
 */
async function unknownKeys(dims: Dims, productId: string, answer: string, question: string) {
  const typed = new Set(question.toUpperCase().match(KEY_RE) ?? []);
  const candidates = [...new Set(answer.match(KEY_RE) ?? [])].filter((k) => !typed.has(k) && dims.prefixes.has(k.split("-")[0]));
  if (!candidates.length) return [];
  const found = await itemsByKeys(productId, candidates);
  return candidates.filter((k) => !found.has(k));
}

/** Cards for the items the answer mentions, in order, skipping ones already shown on a proposal. */
async function cardsFrom(dims: Dims, productId: string, text: string, proposals: Proposal[]): Promise<AiCard[]> {
  const keys = [...new Set(text.match(KEY_RE) ?? [])].slice(0, 30);
  if (!keys.length) return [];
  const found = await itemsByKeys(productId, keys);
  const onProposals = new Set(proposals.map((p) => p.card?.go.selected?.id).filter(Boolean));
  const out: AiCard[] = [];
  for (const k of keys) {
    const it = found.get(k);
    if (!it || onProposals.has(it.v.id)) continue;
    out.push(cardOf(dims, it));
    if (out.length >= 12) break;
  }
  return out;
}

async function save(
  o: { workspaceId: string; user: { id: string } },
  conversationId: string,
  content: string,
  cards: AiCard[],
  proposals: Proposal[],
  usage: { prompt: number; completion: number },
  audit: { name: string; args: unknown; ok: boolean }[],
  model: string | null,
  error: string | null,
): Promise<SavedMessage> {
  return db.transaction(async (tx) => {
    const [m] = await tx
      .insert(schema.aiMessages)
      .values({ conversationId, workspaceId: o.workspaceId, userId: o.user.id, role: "assistant", content, cards, tools: audit, model, promptTokens: usage.prompt, completionTokens: usage.completion, error })
      .returning();
    const rows = proposals.length
      ? await tx
          .insert(schema.aiProposals)
          .values(proposals.map((p) => ({ id: p.id, conversationId, messageId: m.id, workspaceId: o.workspaceId, userId: o.user.id, action: p.action as Record<string, unknown>, expect: p.expect, title: p.title, lines: p.lines, card: p.card })))
          .returning()
      : [];
    await tx.update(schema.aiConversations).set({ updatedAt: new Date() }).where(eq(schema.aiConversations.id, conversationId));
    return { id: m.id, role: "assistant" as const, content, cards, proposals: rows.map(proposalView), createdAt: m.createdAt.toISOString(), error };
  });
}
