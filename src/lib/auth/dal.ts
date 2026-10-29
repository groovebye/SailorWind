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

/** `where` for a passage by shortId or id that the user OWNS (delete, crew, boat). */
export function ownedPassage(ref: string, userId: string) {
  return { OR: [{ shortId: ref }, { id: ref }], ownerId: userId };
}

/** `where`: passages the user can see and edit — their own or ones they are crew on. */
export function visibleTo(userId: string) {
  return { OR: [{ ownerId: userId }, { members: { some: { userId } } }] };
}

/** `where` for a passage by shortId or id that the user owns or is crew on. */
export function crewPassage(ref: string, userId: string) {
  return { AND: [{ OR: [{ shortId: ref }, { id: ref }] }, visibleTo(userId)] };
}

/**
 * A passage's boat: its own (always the owner's), else the owner's default —
 * the same for every crew member.
 */
export async function passageVessel(p: { vesselProfileId: string | null; ownerId: string | null }) {
  if (!p.ownerId) return null;
  const own = p.vesselProfileId
    ? await prisma.vesselProfile.findFirst({ where: { id: p.vesselProfileId, ownerId: p.ownerId } })
    : null;
  return own ?? defaultVessel(p.ownerId);
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
