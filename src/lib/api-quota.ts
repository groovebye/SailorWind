/**
 * Persistent app state (DB-backed) for rate-limits and last-run timestamps.
 * Survives container restarts and is shared across instances — unlike the old
 * in-memory Windy counter that reset on every restart.
 */
import { prisma } from "@/lib/db";

const WINDY_KEY = "windy_last_update";
const WINDY_MIN_MS = 6 * 3600000; // min 6 h between Windy refreshes (free tier)

export async function getKv(key: string): Promise<string | null> {
  const row = await prisma.appKv.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setKv(key: string, value: string): Promise<void> {
  await prisma.appKv.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export async function windyStats(): Promise<{ lastUpdate: number | null; canUpdate: boolean; remainingHours: number }> {
  const raw = await getKv(WINDY_KEY);
  const lastUpdate = raw ? Number(raw) : null;
  const elapsed = lastUpdate ? Date.now() - lastUpdate : Infinity;
  const canUpdate = elapsed > WINDY_MIN_MS;
  const remainingHours = Number.isFinite(elapsed) ? Math.max(0, Math.round(((WINDY_MIN_MS - elapsed) / 3600000) * 10) / 10) : 0;
  return { lastUpdate, canUpdate, remainingHours };
}

export async function markWindyUpdate(): Promise<void> {
  await setKv(WINDY_KEY, String(Date.now()));
}
