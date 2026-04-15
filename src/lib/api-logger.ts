/**
 * Simple API request logger for observability.
 * Logs timing, cache hits, errors to server console.
 */

export function logApi(endpoint: string, params: Record<string, unknown>, result: {
  duration?: number;
  cacheHit?: boolean;
  count?: number;
  error?: string;
}) {
  const parts = [`[API] ${endpoint}`];
  if (params && Object.keys(params).length > 0) {
    parts.push(Object.entries(params).map(([k, v]) => `${k}=${v}`).join(" "));
  }
  if (result.duration !== undefined) parts.push(`${result.duration}ms`);
  if (result.cacheHit !== undefined) parts.push(result.cacheHit ? "CACHE" : "MISS");
  if (result.count !== undefined) parts.push(`${result.count} items`);
  if (result.error) parts.push(`ERROR: ${result.error}`);

  console.log(parts.join(" | "));
}

export function withTiming<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  return fn().then(result => ({ result, durationMs: Date.now() - start }));
}
