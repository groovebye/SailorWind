/**
 * "Save offline" for a passage plan. Builds the exact URLs the app requests
 * for a passage (pages and their GET APIs) and hands them to the service
 * worker, which stores them in a cache that is never trimmed and survives app
 * updates (public/sw.js, PLANS). The URL builders are shared with the pages
 * that fetch them, so the saved copies are the ones found offline.
 */

export type PlanPort = { name: string; lat: number; lon: number };
export type PlanLeg = { index: number; from: PlanPort; to: PlanPort };

export function legRouteUrl(passageId: string, leg: PlanLeg): string {
  const { from: f, to: t } = leg;
  return `/api/leg-route?passageId=${passageId}&legIndex=${leg.index}` +
    `&fromName=${encodeURIComponent(f.name)}&fromLat=${f.lat}&fromLon=${f.lon}` +
    `&toName=${encodeURIComponent(t.name)}&toLat=${t.lat}&toLon=${t.lon}`;
}

/** Defaults match the departure-windows section's initial view (every 6 h, 3 days). */
export function departureWindowsUrl(passageId: string, legIndex: number, stepHours = 6, count = 13): string {
  return `/api/departure-windows?passageId=${passageId}&legIndex=${legIndex}&stepHours=${stepHours}&count=${count}`;
}

export function exportUrl(passageId: string, legIndex?: number): string {
  return `/api/export?passageId=${passageId}${legIndex == null ? "" : `&legIndex=${legIndex}`}`;
}

export function mapUrl(passageId: string): string {
  return `/map?p=${passageId}`;
}

export function planOfflineUrls(passageId: string, legs: PlanLeg[]): string[] {
  const urls = [
    `/p/${passageId}`,
    mapUrl(passageId),
    `/api/passage?id=${passageId}`,
    exportUrl(passageId),
    ...legs.flatMap((leg) => [
      `/p/${passageId}/leg/${leg.index}`,
      legRouteUrl(passageId, leg),
      exportUrl(passageId, leg.index),
      departureWindowsUrl(passageId, leg.index),
    ]),
  ];
  return [...new Set(urls)];
}

export type SavedPlan = { savedAt: number; ok: number; failed: string[] };

async function askServiceWorker<T>(msg: object, timeoutMs = 120_000): Promise<T> {
  if (!("serviceWorker" in navigator)) throw new Error("No service worker in this browser");
  const reg = await navigator.serviceWorker.ready;
  const sw = navigator.serviceWorker.controller ?? reg.active;
  if (!sw) throw new Error("Service worker not active yet — reload and try again");
  return new Promise<T>((resolve, reject) => {
    const ch = new MessageChannel();
    const timer = setTimeout(() => reject(new Error("Service worker did not answer")), timeoutMs);
    ch.port1.onmessage = (e) => { clearTimeout(timer); resolve(e.data as T); };
    sw.postMessage(msg, [ch.port2]);
  });
}

export async function savePlanOffline(passageId: string, legs: PlanLeg[]): Promise<SavedPlan> {
  const urls = planOfflineUrls(passageId, legs);
  // Ask for persistent storage so iOS/Safari doesn't evict the plan under pressure.
  try { await navigator.storage?.persist?.(); } catch { /* best effort */ }
  return askServiceWorker<SavedPlan>({ type: "save-plan", urls });
}

export async function dropPlanOffline(passageId: string, legs: PlanLeg[]): Promise<void> {
  await askServiceWorker({ type: "drop-plan", urls: planOfflineUrls(passageId, legs) });
}
