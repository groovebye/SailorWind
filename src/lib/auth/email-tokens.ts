import "server-only";
import { prisma } from "@/lib/db";
import { hashToken, randomToken } from "./tokens";

export type EmailTokenType = "verify_email" | "reset_password";

const TTL_MS: Record<EmailTokenType, number> = {
  verify_email: 48 * 3600 * 1000,
  reset_password: 60 * 60 * 1000,
};

/** Issue a fresh single-use token; earlier unused ones of the same type die. */
export async function issueEmailToken(userId: string, type: EmailTokenType): Promise<string> {
  const token = randomToken();
  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } }),
    prisma.authToken.create({
      data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TTL_MS[type]) },
    }),
  ]);
  return token;
}

/** Atomically consume a token; returns the owner's id or null if invalid/expired/used. */
export async function consumeEmailToken(token: string, type: EmailTokenType): Promise<string | null> {
  const tokenHash = hashToken(token);
  const row = await prisma.authToken.findUnique({ where: { tokenHash }, select: { userId: true, type: true } });
  if (!row || row.type !== type) return null;
  const { count } = await prisma.authToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  return count === 1 ? row.userId : null;
}

/** Peek (no consume) — lets a page say "link expired" before showing the form. */
export async function emailTokenValid(token: string, type: EmailTokenType): Promise<boolean> {
  const row = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { type: true, usedAt: true, expiresAt: true },
  });
  return !!row && row.type === type && !row.usedAt && row.expiresAt > new Date();
}
