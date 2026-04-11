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

  const res = await fetch(WINDY_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: apiKey,
      lat,
      lon,
      model: "gfs",
      parameters: ["wind", "windGust", "temp", "precip", "clouds", "waves", "swell1"],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Windy API ${res.status}: ${text}`);
  }

  dailyRequests++;
  lastWindyUpdate = Date.now();

  const data = await res.json();

  // Windy returns arrays indexed by timestamp
  const timestamps: string[] = data.ts || [];
  const entries: ForecastEntry[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const time = new Date(timestamps[i]).toISOString();

    // Wind: m/s → knots (×1.944)
    const windSpeedMs = data["wind_u-surface"] && data["wind_v-surface"]
      ? Math.sqrt(data["wind_u-surface"][i] ** 2 + data["wind_v-surface"][i] ** 2)
      : 0;
    const windKt = windSpeedMs * 1.944;
    const windDirDeg = data["wind_u-surface"] && data["wind_v-surface"]
      ? (270 - Math.atan2(data["wind_v-surface"][i], data["wind_u-surface"][i]) * 180 / Math.PI) % 360
      : 0;

    const gustMs = data["gust-surface"]?.[i] || windSpeedMs * 1.3;
    const gustKt = gustMs * 1.944;

    // Waves
    const waveM = data["waves_height-surface"]?.[i] || 0;
    const wavePeriodS = data["waves_period-surface"]?.[i] || 0;
    const waveDirDeg = data["waves_direction-surface"]?.[i] || 0;

    // Swell
    const swellM = data["swell1_height-surface"]?.[i] || 0;
    const swellPeriodS = data["swell1_period-surface"]?.[i] || 0;
    const swellDirDeg = data["swell1_direction-surface"]?.[i] || 0;

    // Precip & clouds
    const precipMm = data["past3hprecip-surface"]?.[i] || data["precip-surface"]?.[i] || 0;
    const cloudPct = data["lclouds-surface"]?.[i] || data["mclouds-surface"]?.[i] || 0;

    entries.push({
      time,
      windKt: Math.round(windKt * 10) / 10,
      windDirDeg: Math.round(windDirDeg),
      windDir: windDirection(windDirDeg),
      beaufort: beaufortScale(windKt),
      gustKt: Math.round(gustKt * 10) / 10,
      waveM: Math.round(waveM * 10) / 10,
      wavePeriodS: Math.round(wavePeriodS * 10) / 10,
      waveDirDeg: Math.round(waveDirDeg),
      waveDir: windDirection(waveDirDeg),
      swellM: Math.round(swellM * 10) / 10,
      swellPeriodS: Math.round(swellPeriodS * 10) / 10,
      swellDirDeg: Math.round(swellDirDeg),
      swellDir: windDirection(swellDirDeg),
      precipMm: Math.round(precipMm * 10) / 10,
      cloudPct: Math.round(cloudPct),
      weather: weatherFromClouds(cloudPct, precipMm),
      verdict: goNogo(windKt, gustKt, waveM, isCape),
    });
  }

  // Filter to 3-hour intervals like Open-Meteo
  return entries.filter((_, i) => i % 3 === 0 || i === 0);
}
