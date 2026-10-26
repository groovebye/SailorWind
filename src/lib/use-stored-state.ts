"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Small per-device settings (map layers, saved-plan markers) kept in
 * localStorage. Server render and hydration see the fallback; the stored value
 * takes over right after. Falls back to memory when storage is blocked
 * (private mode), so the setting still works for the session.
 */

const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function read(key: string): string | null {
  try {
    const v = localStorage.getItem(key);
    if (v != null) return v;
  } catch { /* blocked */ }
  return memory.get(key) ?? null;
}

function write(key: string, raw: string) {
  memory.set(key, raw);
  try { localStorage.setItem(key, raw); } catch { /* blocked: memory only */ }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
}

/** `fallback` must be a stable (module-level) object; stored fields are merged over it. */
export function useStoredState<T extends object>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  const value = useMemo<T>(() => {
    if (!raw) return fallback;
    try { return { ...fallback, ...JSON.parse(raw) }; } catch { return fallback; }
  }, [raw, fallback]);
  const set = useCallback((next: T | ((prev: T) => T)) => {
    const cur = (() => { const r = read(key); try { return r ? { ...fallback, ...JSON.parse(r) } : fallback; } catch { return fallback; } })();
    write(key, JSON.stringify(typeof next === "function" ? (next as (p: T) => T)(cur) : next));
  }, [key, fallback]);
  return [value, set];
}
