/**
 * Only allow same-site relative paths as post-login destinations
 * (blocks open redirects like "//evil.com" or "https://evil.com").
 */
export function safeNext(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(raw)) return fallback;
  if (raw === "/login" || raw.startsWith("/login?") || raw === "/signup" || raw.startsWith("/signup?")) return fallback;
  return raw;
}
