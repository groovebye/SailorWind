/**
 * Client-side forecast sampling for the passage cockpit. Pulls real Open-Meteo
 * wind/gust (forecast API) + wave/swell (marine API) for every waypoint in one
 * batched multi-location call, then samples each waypoint's series at its ETA.
 * Planning-level verdict/power heuristics follow the design spec; the deep
 * per-leg analysis (polars, reefing, tides) stays on the leg pages.
 */
import { haversineNm } from "@/lib/geo";
import { beaufort, type VerdictV } from "@/components/design/helpers";

export type WP = {
  name: string; slug: string; lat: number; lon: number;
  isStop: boolean; isCape: boolean; orcaRisk: string | null;
};

export type LocSeries = {
  time: number[];               // epoch ms, hourly, ascending
  wind: number[]; gust: number[];
  wave: (number | null)[]; period: (number | null)[];
  swell: (number | null)[]; swellPeriod: (number | null)[];
};

export function modelParam(model: string): string | null {
  if (model === "gfs") return "gfs_seamless";
  if (model === "ecmwf") return "ecmwf_ifs025";
  return null; // "ens" → best_match blend
}

/** Cumulative nm to each waypoint + total. */
export function buildLegs(wps: WP[]): { cum: number[]; totalNm: number } {
  const cum = [0];
  for (let i = 1; i < wps.length; i++) {
    cum[i] = cum[i - 1] + haversineNm([wps[i - 1].lat, wps[i - 1].lon], [wps[i].lat, wps[i].lon]);
  }
  return { cum, totalNm: cum[cum.length - 1] ?? 0 };
}

function toEpoch(t: string): number {
  // Open-Meteo (timezone=GMT) gives "2026-05-31T14:00" — treat as UTC.
  return Date.parse(t.length <= 16 ? t + ":00Z" : t.endsWith("Z") ? t : t + "Z");
}

export async function fetchSeries(wps: WP[], model: string): Promise<LocSeries[]> {
  const lat = wps.map((w) => w.lat.toFixed(4)).join(",");
  const lon = wps.map((w) => w.lon.toFixed(4)).join(",");
  const mp = modelParam(model);
  const fcUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=wind_speed_10m,wind_gusts_10m&wind_speed_unit=kn&forecast_days=4&timezone=GMT` +
    (mp ? `&models=${mp}` : "");
  const marUrl =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}` +
    `&hourly=wave_height,wave_period,swell_wave_height,swell_wave_period&forecast_days=4&timezone=GMT`;

  const [fcRes, marRes] = await Promise.allSettled([
    fetch(fcUrl).then((r) => r.json()),
    fetch(marUrl).then((r) => r.json()),
  ]);
  if (fcRes.status !== "fulfilled") throw new Error("forecast fetch failed");
  const fcArr = Array.isArray(fcRes.value) ? fcRes.value : [fcRes.value];
  const marArr =
    marRes.status === "fulfilled" ? (Array.isArray(marRes.value) ? marRes.value : [marRes.value]) : [];

  return wps.map((_, i) => {
    const f = fcArr[i] ?? fcArr[0];
    const m = marArr[i] ?? null;
    const time: number[] = (f?.hourly?.time ?? []).map(toEpoch);
    // marine grid → map by epoch for safe alignment
    const marByT = new Map<number, { wave: number | null; period: number | null; swell: number | null; sp: number | null }>();
    if (m?.hourly?.time) {
      m.hourly.time.forEach((t: string, k: number) => {
        marByT.set(toEpoch(t), {
          wave: m.hourly.wave_height?.[k] ?? null,
          period: m.hourly.wave_period?.[k] ?? null,
          swell: m.hourly.swell_wave_height?.[k] ?? null,
          sp: m.hourly.swell_wave_period?.[k] ?? null,
        });
      });
    }
    return {
      time,
      wind: (f?.hourly?.wind_speed_10m ?? []).map((x: number) => Math.round(x)),
      gust: (f?.hourly?.wind_gusts_10m ?? []).map((x: number) => Math.round(x)),
      wave: time.map((t) => marByT.get(t)?.wave ?? null),
      period: time.map((t) => marByT.get(t)?.period ?? null),
      swell: time.map((t) => marByT.get(t)?.swell ?? null),
      swellPeriod: time.map((t) => marByT.get(t)?.sp ?? null),
    };
  });
}

/** Index of the hourly sample nearest a target epoch. */
export function nearestIdx(time: number[], target: number): number {
  if (!time.length) return -1;
  let lo = 0, hi = time.length - 1;
  if (target <= time[0]) return 0;
  if (target >= time[hi]) return hi;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (time[mid] < target) lo = mid + 1; else hi = mid;
  }
  return lo > 0 && target - time[lo - 1] < time[lo] - target ? lo - 1 : lo;
}

export function fmtMS(h: number | null, s: number | null): string {
  if (h == null) return "—";
  return `${h.toFixed(1)}m${s != null ? ` / ${Math.round(s)}s` : ""}`;
}

/** Planning verdict for a cruising yacht from wind/gust/wave. */
export function verdictFor(wind: number, gust: number, wave: number | null): VerdictV {
  const w = wave ?? 0;
  if (wind >= 28 || gust >= 34 || w >= 3.5) return "NOGO";
  if (wind >= 22 || gust >= 28 || w >= 2.5) return "CAUTION";
  return "GO";
}

/** Comfort/exposure index 0..~14 (design spec blend). */
export function powerFor(wind: number, gust: number, wave: number | null): number {
  const p = 0.5 * wind + 0.25 * gust + 2.5 * (wave ?? 0);
  return Math.max(0, Math.min(14, Math.round(p * 10) / 10));
}

export type TimelineHour = {
  h: number; epoch: number; label: string; wind: number; gust: number;
  score: number; verdict: VerdictV; tod: number;
};

/** 48h departure-window scores at the start point (design spec formula). */
export function buildTimeline(start: LocSeries, base: number): TimelineHour[] {
  const out: TimelineHour[] = [];
  for (let h = 0; h < 48; h++) {
    const epoch = base + h * 3600_000;
    const i = nearestIdx(start.time, epoch);
    if (i < 0) break;
    const wind = start.wind[i] ?? 0;
    const gust = start.gust[i] ?? wind + 4;
    const d = new Date(epoch);
    const tod = d.getUTCHours();
    let score = 10 - Math.max(0, wind - 12) * 0.9 - Math.max(0, gust - 22) * 0.5;
    if (tod >= 22 || tod < 5) score -= 1.6;
    score = Math.max(0.5, Math.min(10, score));
    const verdict: VerdictV = score >= 7 ? "GO" : score >= 4.5 ? "CAUTION" : "NOGO";
    const label = d.toLocaleString("en-GB", {
      timeZone: "UTC", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
    });
    out.push({ h, epoch, label, wind, gust, score: Math.round(score * 10) / 10, verdict, tod });
  }
  return out;
}

export function bestWindow(timeline: TimelineHour[]) {
  let best: { start: number; end: number; len: number; mean: number; quality: number } | null = null;
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].verdict === "NOGO") continue;
    let j = i, sum = 0;
    while (j < timeline.length && timeline[j].verdict !== "NOGO") { sum += timeline[j].score; j++; }
    const len = j - i, mean = sum / len, quality = mean * Math.min(len, 8);
    if (!best || quality > best.quality) best = { start: i, end: j - 1, len, mean, quality };
    i = j;
  }
  return best;
}

export { beaufort };
