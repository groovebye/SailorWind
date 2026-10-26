import "server-only";
import { prisma } from "@/lib/db";

/**
 * Fixed-window counter in AppKv (persistent across restarts, see api-quota.ts).
 * Returns true while the caller is within `limit` hits per `windowSec`.
 */
export async function rateLimit(bucket: string, id: string, limit: number, windowSec: number): Promise<boolean> {
  const win = Math.floor(Date.now() / 1000 / windowSec);
  const key = `rl:${bucket}:${id.toLowerCase()}:${win}`;
  const rows = await prisma.$queryRaw<{ value: string }[]>`
    INSERT INTO "AppKv" ("key", "value", "updatedAt") VALUES (${key}, '1', now())
    ON CONFLICT ("key") DO UPDATE SET "value" = (("AppKv"."value")::int + 1)::text, "updatedAt" = now()
    RETURNING "value"`;
  if (Math.random() < 0.02) {
    await prisma.appKv
      .deleteMany({ where: { key: { startsWith: "rl:" }, updatedAt: { lt: new Date(Date.now() - 2 * 86400000) } } })
      .catch(() => {});
  }
  return Number(rows[0]?.value ?? 0) <= limit;
}
