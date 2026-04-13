/**
 * Windy Point Forecast API client
 * https://api.windy.com/point-forecast/docs
 *
 * Free tier: GFS model, basic parameters (wind, waves, precip)
 * API key: WINDY_API_KEY env var
 */

import type { ForecastEntry } from "./weather";

const WINDY_API_URL = "https://api.windy.com/api/point-forecast/v2";

// Track daily token usage (in-memory, resets on restart)
let dailyRequests = 0;
let lastResetDay = new Date().toISOString().slice(0, 10);
let lastWindyUpdate: number | null = null;

function resetDailyIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== lastResetDay) {
    dailyRequests = 0;
    lastResetDay = today;
  }
}

export function getWindyStats() {
  resetDailyIfNeeded();
  return {
    dailyRequests,
    lastUpdate: lastWindyUpdate,
    canUpdate: !lastWindyUpdate || (Date.now() - lastWindyUpdate) > 6 * 3600000,
  };
}

function beaufortScale(kt: number): string {
  if (kt < 1) return "F0";
  if (kt < 4) return "F1";
  if (kt < 7) return "F2";
  if (kt < 11) return "F3";
  if (kt < 17) return "F4";
  if (kt < 22) return "F5";
  if (kt < 28) return "F6";
  if (kt < 34) return "F7";
  if (kt < 41) return "F8";
  if (kt < 48) return "F9";
  if (kt < 56) return "F10";
  if (kt < 64) return "F11";
  return "F12";
}

function windDirection(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function weatherFromClouds(cloudPct: number, precipMm: number): string {
  if (precipMm > 5) return "heavy_rain";
  if (precipMm > 0.5) return "rain";
  if (cloudPct > 80) return "cloudy";
  if (cloudPct > 40) return "partly";
  return "sun";
}

function goNogo(windKt: number, gustKt: number, waveM: number, isCape: boolean): string {
  const wCaution = isCape ? 15 : 20;
  const wNogo = isCape ? 25 : 30;
  const gNogo = isCape ? 30 : 35;
  const waveCaution = isCape ? 2.0 : 2.5;
  const waveNogo = isCape ? 3.0 : 3.5;

  const reasons: string[] = [];
  if (windKt > wNogo) reasons.push(`wind ${windKt.toFixed(0)}kt`);
  if (gustKt > gNogo) reasons.push(`gusts ${gustKt.toFixed(0)}kt`);
  if (waveM > waveNogo) reasons.push(`waves ${waveM}m`);
  if (reasons.length) return `NO-GO: ${reasons.join(", ")}`;

  const cautions: string[] = [];
  if (windKt > wCaution) cautions.push(`wind ${windKt.toFixed(0)}kt`);
  if (waveM > waveCaution) cautions.push(`waves ${waveM}m`);
  if (cautions.length) return `CAUTION: ${cautions.join(", ")}`;

  return "GO";
}

export async function fetchWindyForecast(
  lat: number, lon: number, isCape: boolean = false
): Promise<ForecastEntry[]> {
  const apiKey = process.env.WINDY_API_KEY;
  if (!apiKey) throw new Error("WINDY_API_KEY not set");

  resetDailyIfNeeded();

  // Request 1: GFS model for wind, gusts, precip, clouds
  const windRes = await fetch(WINDY_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: apiKey, lat, lon, model: "gfs",
      parameters: ["wind", "windGust", "precip", "lclouds", "mclouds", "hclouds", "temp"],
      levels: ["surface"],
    }),
  });
  if (!windRes.ok) throw new Error(`Windy GFS ${windRes.status}: ${await windRes.text()}`);

  // Request 2: gfsWave model for waves and swell (same API key)
  const waveRes = await fetch(WINDY_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: apiKey, lat, lon, model: "gfsWave",
      parameters: ["waves", "swell1"],
      levels: ["surface"],
    }),
  });
  if (!waveRes.ok) throw new Error(`Windy gfsWave ${waveRes.status}: ${await waveRes.text()}`);

  dailyRequests += 2;
  lastWindyUpdate = Date.now();

  const windyData = await windRes.json();
  const waveData = await waveRes.json();

  // No need for Open-Meteo marine fallback — gfsWave has full wave data
  const waveTimestamps: number[] = waveData.ts || [];
  // Build wave lookup by timestamp
  const waveLookup = new Map<number, {
    waveH: number; waveP: number; waveD: number;
    swellH: number; swellP: number; swellD: number;
  }>();
  for (let i = 0; i < waveTimestamps.length; i++) {
    waveLookup.set(waveTimestamps[i], {
      waveH: waveData["waves_height-surface"]?.[i] ?? 0,
      waveP: waveData["waves_period-surface"]?.[i] ?? 0,
      waveD: waveData["waves_direction-surface"]?.[i] ?? 0,
      swellH: waveData["swell1_height-surface"]?.[i] ?? 0,
      swellP: waveData["swell1_period-surface"]?.[i] ?? 0,
      swellD: waveData["swell1_direction-surface"]?.[i] ?? 0,
    });
  }

  // Windy timestamps (ms since epoch)
  const timestamps: number[] = windyData.ts || [];
  const entries: ForecastEntry[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const time = new Date(timestamps[i]).toISOString();

    // Wind: u/v components → speed + direction (m/s → knots)
    const u = windyData["wind_u-surface"]?.[i] || 0;
    const v = windyData["wind_v-surface"]?.[i] || 0;
    const windSpeedMs = Math.sqrt(u * u + v * v);
    const windKt = windSpeedMs * 1.944;
    const windDirDeg = ((270 - Math.atan2(v, u) * 180 / Math.PI) % 360 + 360) % 360;

    const gustMs = windyData["gust-surface"]?.[i] || windSpeedMs * 1.3;
    const gustKt = gustMs * 1.944;

    // Precip & clouds
    const precipMm = windyData["past3hprecip-surface"]?.[i] || 0;
    const cloudPct = Math.max(
      windyData["lclouds-surface"]?.[i] || 0,
      windyData["mclouds-surface"]?.[i] || 0,
      windyData["hclouds-surface"]?.[i] || 0
    ) * 100; // Windy returns 0-1, convert to %

    // Wave data from gfsWave model — match by timestamp
    const ts = timestamps[i];
    const wave = waveLookup.get(ts);
    const waveH = wave?.waveH ?? 0;
    const waveP = wave?.waveP ?? 0;
    const waveD = wave?.waveD ?? 0;
    const swellH = wave?.swellH ?? 0;
    const swellP = wave?.swellP ?? 0;
    const swellD = wave?.swellD ?? 0;

    entries.push({
      time,
      windKt: Math.round(windKt * 10) / 10,
      windDirDeg: Math.round(windDirDeg),
      windDir: windDirection(windDirDeg),
      beaufort: beaufortScale(windKt),
      gustKt: Math.round(gustKt * 10) / 10,
      waveM: Math.round(waveH * 10) / 10,
      wavePeriodS: Math.round(waveP * 10) / 10,
      waveDirDeg: Math.round(waveD),
      waveDir: windDirection(waveD),
      swellM: Math.round(swellH * 10) / 10,
      swellPeriodS: Math.round(swellP * 10) / 10,
      swellDirDeg: Math.round(swellD),
      swellDir: windDirection(swellD),
      precipMm: Math.round(precipMm * 10) / 10,
      cloudPct: Math.round(cloudPct),
      weather: weatherFromClouds(cloudPct, precipMm),
      verdict: goNogo(windKt, gustKt, waveH, isCape),
    });
  }

  // Filter to 3-hour intervals
  return entries.filter((_, i) => i % 3 === 0 || i === 0);
}
