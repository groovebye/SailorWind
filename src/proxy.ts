import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth redirects only (cookie presence, no DB) — the real check is
 * getSessionUser() in pages, Server Actions and Route Handlers.
 */
const SESSION_COOKIE = "sw_session"; // keep in sync with src/lib/auth/session.ts
const PROTECTED = ["/new", "/p", "/port", "/map", "/settings"];

export default function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSession && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon|icon|apple-icon|manifest|sw\\.js|.*\\.(?:png|svg|jpg|webp|ico|geojson|json|txt|xml)$).*)"],
};
