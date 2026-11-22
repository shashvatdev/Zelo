import { cookies } from "next/headers";
import { newToken } from "@/server/auth";
import { config } from "@/server/config";
import { HttpError, route } from "@/server/http";

/** Starts Google sign-in (only when GOOGLE_CLIENT_ID/SECRET are configured). */
export const GET = route(async (req) => {
  if (!config.google) throw new HttpError(404, "Google sign-in isn't set up on this server.", "not_configured");
  const next = new URL(req.url).searchParams.get("next") ?? "/app";
  const state = newToken();
  (await cookies()).set("zelo_oauth", JSON.stringify({ state, next: next.startsWith("/") ? next : "/app" }), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.search = new URLSearchParams({ client_id: config.google.id, redirect_uri: `${config.appUrl}/api/auth/google/callback`, response_type: "code", scope: "openid email profile", state, prompt: "select_account" }).toString();
  return Response.redirect(u.toString(), 302);
});
