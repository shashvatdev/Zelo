import { z } from "zod";
import { shuttingDown } from "./realtime";

/** An error the client is allowed to see: status code + a human message + optional field. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
    public field?: string,
  ) {
    super(message);
  }
}

export const bad = (message: string, field?: string) => new HttpError(400, message, "invalid", field);
export const unauthorized = (message = "Please log in.") => new HttpError(401, message, "unauthorized");
export const forbidden = (message = "You don't have access to do that.") => new HttpError(403, message, "forbidden");
export const notFound = (message = "Not found.") => new HttpError(404, message, "not_found");
export const conflict = (message: string, field?: string) => new HttpError(409, message, "conflict", field);

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });
}

/**
 * Rejects cross-site writes: state-changing requests must come from our own origin.
 * (Cookies are SameSite=Lax as well; this is the second lock.)
 */
function checkOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (tests, curl) don't send it; they also can't carry a victim's cookie
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw forbidden("Cross-site request blocked.");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw forbidden("Cross-site request blocked.");
  }
}

/** Friendly messages for unique-constraint clashes. */
const DUPLICATE: Record<string, string> = {
  releases_version_key: "That version already exists.",
  modules_name_key: "A module with that name already exists.",
  workspaces_slug_key: "That workspace URL is taken.",
  users_email_key: "There is already an account with this email.",
};

/** Wraps a route handler: origin check, JSON errors, and no stack traces leaking to clients. */
export function route<C>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => closeIfShuttingDown(await handle(fn, req, ctx));
}

/**
 * While this server shuts down, ask the browser to drop the connection after each response,
 * so its next request (e.g. the live stream reconnecting) goes to a server that is staying up.
 */
function closeIfShuttingDown(res: Response) {
  if (!shuttingDown()) return res;
  const headers = new Headers(res.headers);
  headers.set("Connection", "close");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function handle<C>(fn: (req: Request, ctx: C) => Promise<Response>, req: Request, ctx: C) {
  {
    try {
      checkOrigin(req);
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, code: e.code, field: e.field }, { status: e.status });
      if (e instanceof z.ZodError) {
        const issue = e.issues[0];
        return json({ error: issue?.message ?? "Invalid request.", code: "invalid", field: issue?.path.join(".") }, { status: 400 });
      }
      // Drizzle wraps driver errors; the Postgres code lives on the error or its cause.
      const pg = ((e as { cause?: unknown })?.cause ?? e) as { code?: string; constraint?: string };
      if (pg?.code === "23505") return json({ error: DUPLICATE[pg.constraint ?? ""] ?? "That already exists.", code: "conflict", field: pg.constraint }, { status: 409 });
      if (pg?.code === "23503") return json({ error: "Something it depends on was just removed. Refresh and try again.", code: "conflict" }, { status: 409 });
      console.error("[api]", req.method, new URL(req.url).pathname, e);
      return json({ error: "Something went wrong on our side. Please try again.", code: "server_error" }, { status: 500 });
    }
  }
}

export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw bad("Send a JSON body.");
  }
  return schema.parse(data);
}

export const zEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Enter a valid email.");
export const zName = z.string().trim().min(1, "Enter a name.").max(80, "Keep it under 80 characters.");
export const zPassword = z.string().min(8, "Use at least 8 characters.").max(200);
export const zUuid = z.uuid("Bad id.");
