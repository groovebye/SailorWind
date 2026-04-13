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

  // Free tier: wind, gusts, precip, clouds, temp only (no waves/swell)
  // Marine data (waves, swell) requires paid plan ($720/yr)
  const res = await fetch(WINDY_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: apiKey,
      lat,
      lon,
      model: "gfs",
      parameters: ["wind", "windGust", "precip", "lclouds", "mclouds", "hclouds", "temp"],
      levels: ["surface"],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Windy API ${res.status}: ${text}`);
  }

  dailyRequests++;
  lastWindyUpdate = Date.now();

  const windyData = await res.json();

  // Also fetch marine data (waves/swell) from Open-Meteo (free)
  // Use offshore coords — ports inside rías return null in marine model
  const marineLat = Math.min(lat + 0.05, 44.0);
  let marineData: Record<string, number[]> = {};
  try {
    const marineRes = await fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${marineLat}&longitude=${lon}` +
      `&hourly=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction` +
      `&timezone=UTC&forecast_days=14`
    );
    if (marineRes.ok) {
      const mj = await marineRes.json();
      marineData = mj.hourly || {};
    }
  } catch { /* marine data optional */ }

  // Windy timestamps (ms since epoch)
  const timestamps: number[] = windyData.ts || [];
  const entries: ForecastEntry[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const time = new Date(timestamps[i]).toISOString();
    const timeHour = new Date(timestamps[i]).toISOString().slice(0, 13);

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

    // Marine data from Open-Meteo — match by hour
    let hasMarine = false;
    let waveM: number | null = null, wavePeriodS: number | null = null, waveDirDeg2 = 0;
    let swellM: number | null = null, swellPeriodS: number | null = null, swellDirDeg2 = 0;

    if (marineData.time) {
      const marineIdx = (marineData.time as unknown as string[]).findIndex(
        (t: string) => t.slice(0, 13) === timeHour
      );
      if (marineIdx >= 0 && marineData.wave_height?.[marineIdx] != null) {
        hasMarine = true;
        waveM = marineData.wave_height[marineIdx] || 0;
        wavePeriodS = marineData.wave_period?.[marineIdx] || 0;
        waveDirDeg2 = marineData.wave_direction?.[marineIdx] || 0;
        swellM = marineData.swell_wave_height?.[marineIdx] || 0;
        swellPeriodS = marineData.swell_wave_period?.[marineIdx] || 0;
        swellDirDeg2 = marineData.swell_wave_direction?.[marineIdx] || 0;
      }
    }

    entries.push({
      time,
      windKt: Math.round(windKt * 10) / 10,
      windDirDeg: Math.round(windDirDeg),
      windDir: windDirection(windDirDeg),
      beaufort: beaufortScale(windKt),
      gustKt: Math.round(gustKt * 10) / 10,
      waveM: hasMarine ? Math.round(waveM! * 10) / 10 : null,
      wavePeriodS: hasMarine ? Math.round(wavePeriodS! * 10) / 10 : null,
      waveDirDeg: Math.round(waveDirDeg2),
      waveDir: windDirection(waveDirDeg2),
      swellM: hasMarine ? Math.round(swellM! * 10) / 10 : null,
      swellPeriodS: hasMarine ? Math.round(swellPeriodS! * 10) / 10 : null,
      swellDirDeg: Math.round(swellDirDeg2),
      swellDir: windDirection(swellDirDeg2),
      precipMm: Math.round(precipMm * 10) / 10,
      cloudPct: Math.round(cloudPct),
      weather: weatherFromClouds(cloudPct, precipMm),
      verdict: hasMarine
        ? goNogo(windKt, gustKt, waveM!, isCape)
        : goNogo(windKt, gustKt, 0, isCape) + (windKt > 0 ? " (no wave data)" : ""),
    });
  }

  // Filter to 3-hour intervals
  return entries.filter((_, i) => i % 3 === 0 || i === 0);
}
