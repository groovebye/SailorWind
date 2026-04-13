const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";

export type WeatherModel =
  | "ecmwf_ifs025"
  | "gfs_seamless"
  | "icon_eu"
  | "icon_seamless"
  | "arome_france";

export interface ForecastEntry {
  time: string;
  windKt: number;
  windDirDeg: number;
  windDir: string;
  beaufort: string;
  gustKt: number;
  waveM: number | null;      // null = no marine data available
  wavePeriodS: number | null;
  waveDirDeg: number;
  waveDir: string;
  swellM: number | null;
  swellPeriodS: number | null;
  swellDirDeg: number;
  swellDir: string;
  precipMm: number;
  cloudPct: number;
  weather: string;
  verdict: string;
}

// ── In-memory cache ──────────────────────────────────────────────

const cache = new Map<string, { data: RawData; ts: number }>();
const CACHE_TTL = 3 * 3600 * 1000; // 3 hours

interface RawData {
  weather: Record<string, unknown>;
  marine: Record<string, unknown>;
}

function cacheKey(lat: number, lon: number, model: string) {
  return `${model}_${lat.toFixed(4)}_${lon.toFixed(4)}`;
}

// ── Helpers ──────────────────────────────────────────────────────

const COMPASS = [
  "N","NNE","NE","ENE","E","ESE","SE","SSE",
  "S","SSW","SW","WSW","W","WNW","NW","NNW",
];
function dirName(deg: number) {
  return COMPASS[Math.round(deg / 22.5) % 16];
}

function kmhToKt(kmh: number) {
  return kmh * 0.539957;
}

/**
 * Shift coordinates slightly offshore for marine API.
 * Ports inside rías return null wave data because they're on "land"
 * in the marine model grid. Moving ~0.05° (~3NM) northward puts us
 * in open water where marine data is available.
 */
function offshoreCoords(lat: number, lon: number): { lat: number; lon: number } {
  // North Spain coast faces N — shift north for open water
  return { lat: Math.min(lat + 0.05, 44.0), lon };
}

function beaufort(kt: number): string {
  const t: [number, string][] = [
    [1,"F0"],[4,"F1"],[7,"F2"],[11,"F3"],[17,"F4"],[22,"F5"],
    [28,"F6"],[34,"F7"],[41,"F8"],[48,"F9"],[56,"F10"],[64,"F11"],
  ];
  for (const [limit, label] of t) if (kt < limit) return label;
  return "F12";
}

function wmoToWeather(code: number): string {
  if (code <= 1) return "sun";
  if (code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ([51, 53, 56, 61].includes(code)) return "rain";
  if ([55, 57, 63, 65, 66, 67].includes(code)) return "heavy_rain";
  if ([71, 73, 75, 77, 80, 81, 82, 85, 86].includes(code)) return "rain";
  if ([95, 96, 99].includes(code)) return "storm";
  return "partly";
}

function goNogo(
  windKt: number,
  gustKt: number,
  waveM: number,
  isCape: boolean
): string {
  const issues: string[] = [];
  const wCaution = isCape ? 15 : 20;
  const wNogo = isCape ? 25 : 30;
  const waveCaution = isCape ? 2.0 : 2.5;
  const waveNogo = isCape ? 3.0 : 3.5;
  const gNogo = isCape ? 30 : 35;

  if (windKt > wNogo) issues.push(`Wind ${windKt.toFixed(0)}kt DANGEROUS`);
  else if (windKt > wCaution) issues.push(`Wind ${windKt.toFixed(0)}kt strong`);
  if (gustKt > gNogo) issues.push(`Gusts ${gustKt.toFixed(0)}kt DANGEROUS`);
  if (waveM > waveNogo) issues.push(`Waves ${waveM.toFixed(1)}m DANGEROUS`);
  else if (waveM > waveCaution) issues.push(`Waves ${waveM.toFixed(1)}m rough`);
  if (isCape && windKt > 15) issues.push("CAPE acceleration zone");

  if (!issues.length) return "GO";
  if (issues.some((i) => i.includes("DANGEROUS")))
    return "NO-GO: " + issues.join("; ");
  return "CAUTION: " + issues.join("; ");
}

// ── API fetch ────────────────────────────────────────────────────

async function fetchRaw(
  lat: number,
  lon: number,
  model: WeatherModel,
  force: boolean
): Promise<RawData> {
  const key = cacheKey(lat, lon, model);

  if (!force) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
  }

  async function fetchWithRetry(url: string, label: string, retries = 3): Promise<Response> {
    for (let attempt = 0; attempt < retries; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt));
      const res = await fetch(url);
      if (res.ok) return res;
      if (res.status === 429 && attempt < retries - 1) continue;
      throw new Error(`${label}: ${res.status}`);
    }
    throw new Error(`${label}: max retries`);
  }

  const weatherRes = await fetchWithRetry(
    `${FORECAST_URL}?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cloud_cover,weather_code&timezone=UTC&forecast_days=10&models=${model}`,
    "Weather API"
  );
  // Use offshore coords for marine data — ports inside rías return null
  const marine = offshoreCoords(lat, lon);
  const marineRes = await fetchWithRetry(
    `${MARINE_URL}?latitude=${marine.lat}&longitude=${marine.lon}&hourly=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction&timezone=UTC&forecast_days=10`,
    "Marine API"
  );

  const data: RawData = {
    weather: await weatherRes.json(),
    marine: await marineRes.json(),
  };

  cache.set(key, { data, ts: Date.now() });
  return data;
}

// ── Main export ──────────────────────────────────────────────────

export async function fetchForecast(
  lat: number,
  lon: number,
  model: WeatherModel = "ecmwf_ifs025",
  isCape: boolean = false,
  force: boolean = false
): Promise<ForecastEntry[]> {
  const raw = await fetchRaw(lat, lon, model, force);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = (raw.weather as any).hourly;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (raw.marine as any).hourly;

  const timesW: string[] = w.time ?? [];
  const timesM: string[] = m.time ?? [];

  // Build marine lookup
  const marineLookup = new Map<string, {
    waveH: number; waveP: number; waveD: number;
    swellH: number; swellP: number; swellD: number;
  }>();

  let lastMarine = { waveH: 0, waveP: 0, waveD: 0, swellH: 0, swellP: 0, swellD: 0 };

  for (let i = 0; i < timesM.length; i++) {
    const wh = m.wave_height?.[i];
    const sh = m.swell_wave_height?.[i];
    if (wh == null && sh == null) continue;
    const entry = {
      waveH: wh ?? 0, waveP: m.wave_period?.[i] ?? 0, waveD: m.wave_direction?.[i] ?? 0,
      swellH: sh ?? 0, swellP: m.swell_wave_period?.[i] ?? 0, swellD: m.swell_wave_direction?.[i] ?? 0,
    };
    marineLookup.set(timesM[i], entry);
    lastMarine = entry;
  }

  const entries: ForecastEntry[] = [];

  for (let i = 0; i < timesW.length; i++) {
    const dt = new Date(timesW[i] + "Z");
    if (dt.getUTCHours() % 3 !== 0) continue;

    const windKmh = w.wind_speed_10m?.[i] ?? 0;
    const windDeg = w.wind_direction_10m?.[i] ?? 0;
    const gustKmh = w.wind_gusts_10m?.[i] ?? 0;
    const precip = w.precipitation?.[i] ?? 0;
    const cloud = w.cloud_cover?.[i] ?? 0;
    const wmo = w.weather_code?.[i] ?? 0;

    const wKt = kmhToKt(windKmh);
    const gKt = kmhToKt(gustKmh);
    const mr = marineLookup.get(timesW[i]);
    const hasMarine = !!mr;

    entries.push({
      time: dt.toISOString(),
      windKt: Math.round(wKt * 10) / 10,
      windDirDeg: Math.round(windDeg),
      windDir: dirName(windDeg),
      beaufort: beaufort(wKt),
      gustKt: Math.round(gKt * 10) / 10,
      waveM: hasMarine ? Math.round(mr.waveH * 10) / 10 : null,
      wavePeriodS: hasMarine ? Math.round(mr.waveP) : null,
      waveDirDeg: Math.round(mr?.waveD ?? 0),
      waveDir: dirName(mr?.waveD ?? 0),
      swellM: hasMarine ? Math.round(mr.swellH * 10) / 10 : null,
      swellPeriodS: hasMarine ? Math.round(mr.swellP) : null,
      swellDirDeg: Math.round(mr?.swellD ?? 0),
      swellDir: dirName(mr?.swellD ?? 0),
      precipMm: Math.round(precip * 100) / 100,
      cloudPct: Math.round(cloud),
      weather: wmoToWeather(wmo),
      verdict: hasMarine
        ? goNogo(wKt, gKt, mr.waveH, isCape)
        : goNogo(wKt, gKt, 0, isCape) + (wKt > 0 ? " (no wave data)" : ""),
    });
  }

  return entries;
}

export function clearCache() {
  cache.clear();
}
