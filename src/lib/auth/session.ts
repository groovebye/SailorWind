import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";
import { hashToken, randomToken } from "./tokens";

export const SESSION_COOKIE = "sw_session";
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

export type SessionUser = { id: string; email: string; name: string };

export async function clientIp(): Promise<string> {
  const h = await headers();
  // Caddy sets X-Forwarded-For to the real client address.
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Create a DB session and set the cookie. Server Actions / Route Handlers only. */
export async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const h = await headers();
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ip: await clientIp(),
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Secure check: the cookie token must match a live session row. Memoised per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { expiresAt: true, user: { select: { id: true, email: true, name: true, emailVerifiedAt: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.emailVerifiedAt) return null;
  const { id, email, name } = session.user;
  return { id, email, name };
});

/** Log out this browser. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete(SESSION_COOKIE);
}

/** Log out everywhere (optionally keeping the current browser). */
export async function revokeSessions(userId: string, keepCurrent = false): Promise<void> {
  const token = keepCurrent ? (await cookies()).get(SESSION_COOKIE)?.value : undefined;
  await prisma.session.deleteMany({
    where: { userId, ...(token ? { tokenHash: { not: hashToken(token) } } : {}) },
  });
}
