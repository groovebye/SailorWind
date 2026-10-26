import "server-only";
import { getSessionUser, type SessionUser } from "./session";

/**
 * Route Handler guard: the signed-in user, or a ready-to-return error Response.
 * Mutating requests must also come from our own origin (defence in depth on top
 * of the SameSite=Lax session cookie).
 *
 *   const user = await authed(req);
 *   if (user instanceof Response) return user;
 */
export async function authed(req: Request): Promise<SessionUser | Response> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (origin && host) {
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {}
      if (originHost !== host) return Response.json({ error: "Cross-origin request blocked" }, { status: 403 });
    }
  }
  const user = await getSessionUser();
  return user ?? Response.json({ error: "Sign in required" }, { status: 401 });
}
