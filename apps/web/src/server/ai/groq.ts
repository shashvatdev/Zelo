import { config } from "../config";

/**
 * Groq chat completions (OpenAI-compatible), streamed.
 * - Retries rate limits and server errors with backoff, then moves to the fallback model.
 * - A malformed tool call from the model (Groq's `tool_use_failed`) is retried once, then falls back.
 * - The caller's AbortSignal cancels the upstream request, so a closed chat stops costing tokens.
 */

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
export type ToolDef = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };

export type Turn = {
  content: string;
  toolCalls: ToolCall[];
  finish: string;
  model: string;
  usage: { prompt: number; completion: number };
};

export class AiUnavailable extends Error {}

/** Per-model knobs: hide reasoning from the answer stream, keep it thoughtful but quick. */
function modelParams(model: string): Record<string, unknown> {
  if (model.startsWith("openai/gpt-oss")) return { include_reasoning: false, reasoning_effort: "medium" };
  if (model.startsWith("qwen/")) return { reasoning_format: "hidden" };
  return {};
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    if (signal?.aborted) return rej(signal.reason ?? new Error("aborted"));
    const t = setTimeout(res, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      rej(signal.reason ?? new Error("aborted"));
    });
  });

async function streamOnce(
  model: string,
  messages: ChatMessage[],
  tools: ToolDef[],
  onText: (delta: string) => void,
  signal?: AbortSignal,
): Promise<Turn> {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort);
  // No first byte in 25s, or the whole call over 90s: give up on this attempt.
  const firstByte = setTimeout(() => ctrl.abort(new Error("timeout")), 25_000);
  const total = setTimeout(() => ctrl.abort(new Error("timeout")), 90_000);
  try {
    const res = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.ai.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        ...(tools.length ? { tools, tool_choice: "auto" } : {}),
        stream: true,
        temperature: 0.4,
        max_completion_tokens: 1800,
        ...modelParams(model),
      }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      const err = new UpstreamError(res.status, text.slice(0, 500), Number(res.headers.get("retry-after")) || 0);
      throw err;
    }
    clearTimeout(firstByte);

    const out: Turn = { content: "", toolCalls: [], finish: "", model, usage: { prompt: 0, completion: 0 } };
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        let chunk: StreamChunk;
        try {
          chunk = JSON.parse(data) as StreamChunk;
        } catch {
          continue;
        }
        if (chunk.error) throw new UpstreamError(500, JSON.stringify(chunk.error).slice(0, 500), 0);
        const usage = chunk.usage ?? chunk.x_groq?.usage;
        if (usage) out.usage = { prompt: usage.prompt_tokens ?? 0, completion: usage.completion_tokens ?? 0 };
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        const d = choice.delta ?? {};
        if (d.content) {
          out.content += d.content;
          onText(d.content);
        }
        for (const tc of d.tool_calls ?? []) {
          const slot = (out.toolCalls[tc.index ?? 0] ??= { id: "", type: "function", function: { name: "", arguments: "" } });
          if (tc.id) slot.id = tc.id;
          if (tc.function?.name) slot.function.name += tc.function.name;
          if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
        }
        if (choice.finish_reason) out.finish = choice.finish_reason;
      }
    }
    out.toolCalls = out.toolCalls.filter(Boolean).map((t, i) => ({ ...t, id: t.id || `call_${i}` }));
    return out;
  } finally {
    clearTimeout(firstByte);
    clearTimeout(total);
    signal?.removeEventListener("abort", onAbort);
  }
}

type StreamChunk = {
  error?: unknown;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  x_groq?: { usage?: { prompt_tokens?: number; completion_tokens?: number } };
  choices?: { delta?: { content?: string | null; tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] }; finish_reason?: string | null }[];
};

export class UpstreamError extends Error {
  constructor(
    public status: number,
    public body: string,
    public retryAfter: number,
  ) {
    super(`Groq ${status}: ${body}`);
  }
}

const retryable = (e: unknown) => e instanceof UpstreamError && (e.status === 429 || e.status >= 500 || /tool_use_failed|output_parse_failed/.test(e.body));
const isTimeout = (e: unknown) => e instanceof Error && /timeout/i.test(e.message);

/** How long Groq asks us to wait on a 429: the Retry-After header, or "try again in 1.2s" in the body. */
function waitFor(e: UpstreamError) {
  if (e.retryAfter) return e.retryAfter * 1000;
  const m = /try again in (?:(\d+)m)?([\d.]+)(ms|s)/i.exec(e.body);
  if (!m) return 2000;
  return (Number(m[1] ?? 0) * 60 + Number(m[2]) / (m[3] === "ms" ? 1000 : 1)) * 1000 + 250;
}

export class RateLimited extends AiUnavailable {
  constructor(public waitMs: number) {
    super("rate limited");
  }
}

/**
 * One model turn with retries and fallback. `onText` gets answer text as it streams; `onRestart`
 * is called when a retry begins after text was already streamed, so the client can clear it.
 * Rate limits: wait as long as Groq asks (up to 12s per wait, 25s in total per turn) on each model,
 * telling the person through `onWait`, before trying the next model.
 */
export async function chat(opts: { messages: ChatMessage[]; tools: ToolDef[]; onText: (d: string) => void; onRestart: () => void; onWait?: (ms: number) => void; signal?: AbortSignal }): Promise<Turn> {
  if (!config.ai.key) throw new AiUnavailable("GROQ_API_KEY is not set");
  const models = [...new Set([config.ai.model, ...config.ai.fallbackModels].filter(Boolean))];
  let last: unknown;
  let waited = 0;
  let minWait = Infinity;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let streamed = false;
      try {
        return await streamOnce(
          model,
          opts.messages,
          opts.tools,
          (d) => {
            streamed = true;
            opts.onText(d);
          },
          opts.signal,
        );
      } catch (e) {
        if (opts.signal?.aborted) throw e;
        last = e;
        if (streamed) opts.onRestart();
        console.warn("[ai]", model, "attempt", attempt + 1, "failed:", e instanceof Error ? e.message.slice(0, 200) : e);
        if (e instanceof UpstreamError && e.status === 429) {
          const ms = waitFor(e);
          minWait = Math.min(minWait, ms);
          // A long wait on this model: try the next one right away instead.
          if (attempt > 0 || ms > 12_000 || waited + ms > 25_000) break;
          opts.onWait?.(ms);
          waited += ms;
          await sleep(ms, opts.signal);
          continue;
        }
        if (!retryable(e) && !isTimeout(e)) break; // e.g. the model was removed: go to the next model
        if (attempt === 0) await sleep(600, opts.signal);
      }
    }
  }
  if (last instanceof UpstreamError && last.status === 429) throw new RateLimited(Number.isFinite(minWait) ? minWait : 20_000);
  throw new AiUnavailable(last instanceof Error ? last.message : "AI unavailable");
}
