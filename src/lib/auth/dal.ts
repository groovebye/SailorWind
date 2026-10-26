import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, type SessionUser } from "./session";

export { getSessionUser as getCurrentUser };
export type { SessionUser };

/** Pages: the signed-in user, or a redirect to /login that comes back here. */
export async function requireUser(next = "/"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** Route Handlers: the signed-in user, or null (caller answers 401). */
export async function apiUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

export function unauthorized() {
  return Response.json({ error: "Sign in required" }, { status: 401 });
}

/** `where` for a passage by shortId or id that belongs to the user. */
export function ownedPassage(ref: string, userId: string) {
  return { OR: [{ shortId: ref }, { id: ref }], ownerId: userId };
}

/** The passage's internal id if the user owns it, else null. */
export async function ownedPassageId(ref: string, userId: string): Promise<string | null> {
  const p = await prisma.passage.findFirst({ where: ownedPassage(ref, userId), select: { id: true } });
  return p?.id ?? null;
}

/** The user's default boat (or their first one). */
export function defaultVessel(userId: string) {
  return prisma.vesselProfile.findFirst({
    where: { ownerId: userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}
