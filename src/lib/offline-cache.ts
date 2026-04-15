/**
 * Lightweight offline briefing cache using localStorage.
 *
 * Caches leg brief data so recently viewed legs can render
 * without network. Shows stale indicator when data is old.
 */

const CACHE_PREFIX = "sw_brief_";
const MAX_AGE_MS = 6 * 3600 * 1000; // 6 hours fresh
const STALE_AGE_MS = 24 * 3600 * 1000; // 24 hours max

interface CachedBrief {
  data: unknown;
  cachedAt: number;
  passageId: string;
  legIndex: number;
}

function cacheKey(passageId: string, legIndex: number): string {
  return `${CACHE_PREFIX}${passageId}_${legIndex}`;
}

export function cacheLegBrief(passageId: string, legIndex: number, data: unknown): void {
  try {
    const entry: CachedBrief = { data, cachedAt: Date.now(), passageId, legIndex };
    localStorage.setItem(cacheKey(passageId, legIndex), JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — silent fail
  }
}

export function getCachedLegBrief(passageId: string, legIndex: number): {
  data: unknown;
  cachedAt: Date;
  isFresh: boolean;
  isStale: boolean;
  ageMinutes: number;
} | null {
  try {
    const raw = localStorage.getItem(cacheKey(passageId, legIndex));
    if (!raw) return null;
    const entry: CachedBrief = JSON.parse(raw);
    const age = Date.now() - entry.cachedAt;
    if (age > STALE_AGE_MS) {
      localStorage.removeItem(cacheKey(passageId, legIndex));
      return null;
    }
    return {
      data: entry.data,
      cachedAt: new Date(entry.cachedAt),
      isFresh: age < MAX_AGE_MS,
      isStale: age >= MAX_AGE_MS,
      ageMinutes: Math.round(age / 60000),
    };
  } catch {
    return null;
  }
}

export function clearAllBriefCache(): void {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  } catch {
    // silent
  }
}

/**
 * Get cache status for display
 */
export function getCacheStatus(passageId: string, legIndex: number): {
  available: boolean;
  label: string;
  color: string;
} {
  const cached = getCachedLegBrief(passageId, legIndex);
  if (!cached) return { available: false, label: "Not cached", color: "var(--text-muted)" };
  if (cached.isFresh) return { available: true, label: `Cached ${cached.ageMinutes}min ago`, color: "var(--text-green)" };
  return { available: true, label: `Stale (${Math.round(cached.ageMinutes / 60)}h ago)`, color: "var(--text-yellow)" };
}
