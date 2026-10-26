/**
 * Gridded wind and waves for the hub map's weather layers.
 *
 * The visible map area is snapped to a lattice (step chosen so it never has
 * more than GRID_MAX_PER_AXIS nodes per side), and every node is fetched from
 * Open-Meteo in one multi-location call per API (forecast + marine). Snapping
 * keeps URLs stable, so the server cache and the service worker reuse them
 * while you pan a little.
 *
 * Pure functions only; /api/weather-grid does the fetching.
 */

export type Bounds = { south: number; west: number; north: number; east: number };

export type Lattice = Bounds & { step: number; lats: number[]; lons: number[] };

export const GRID_STEPS = [0.1, 0.2, 0.25, 0.5, 1, 2, 4] as const;
export const GRID_MAX_PER_AXIS = 12;

export const WEATHER_MODELS = {
  best_match: "Best match",
  ecmwf_ifs025: "ECMWF",
  gfs_seamless: "GFS",
  icon_seamless: "ICON",
} as const;
export type WeatherGridModel = keyof typeof WEATHER_MODELS;

export const isWeatherGridModel = (m: string | null | undefined): m is WeatherGridModel =>
  !!m && Object.prototype.hasOwnProperty.call(WEATHER_MODELS, m);

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

function axis(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  const a = Math.floor(r4(lo / step)), b = Math.ceil(r4(hi / step));
  for (let k = a; k <= b; k++) out.push(r4(k * step));
  return out;
}

/** The visible bounds snapped outward to the coarsest-needed step. */
export function latticeFor(b: Bounds): Lattice {
  const south = Math.max(-85, Math.min(b.south, b.north));
  const north = Math.min(85, Math.max(b.south, b.north));
  const west = Math.max(-180, b.west);
  const east = Math.min(180, Math.max(b.east, west));
  for (const step of GRID_STEPS) {
    const lats = axis(south, north, step);
    const lons = axis(west, east, step);
    if (lats.length <= GRID_MAX_PER_AXIS && lons.length <= GRID_MAX_PER_AXIS) {
      return { step, lats, lons, south: lats[0], north: lats[lats.length - 1], west: lons[0], east: lons[lons.length - 1] };
    }
  }
  // Wider than ~44° — sample the middle instead of the whole view.
  const step = GRID_STEPS[GRID_STEPS.length - 1];
  const half = ((GRID_MAX_PER_AXIS - 1) * step) / 2;
  const cLat = (south + north) / 2, cLon = (west + east) / 2;
  return latticeFor({ south: cLat - half, north: cLat + half - step / 2, west: cLon - half, east: cLon + half - step / 2 });
}

/** Canonical query string for /api/weather-grid — the cache key on both sides. */
export function weatherGridQuery(l: Bounds, model: WeatherGridModel = "best_match"): string {
  return `south=${r4(l.south)}&west=${r4(l.west)}&north=${r4(l.north)}&east=${r4(l.east)}&model=${model}`;
}

/** Lattice nodes, row by row from the south-west corner. */
export function latticePoints(l: Lattice): { lat: number; lon: number }[] {
  return l.lats.flatMap((lat) => l.lons.map((lon) => ({ lat, lon })));
}

export const GRID_FORECAST_DAYS = 4;

export function openMeteoGridUrls(l: Lattice, model: WeatherGridModel): { forecast: string; marine: string } {
  const pts = latticePoints(l);
  const lat = pts.map((p) => p.lat).join(",");
  const lon = pts.map((p) => p.lon).join(",");
  return {
    forecast:
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kn` +
      `&forecast_days=${GRID_FORECAST_DAYS}&timezone=GMT` +
      (model === "best_match" ? "" : `&models=${model}`),
    marine:
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}` +
      `&hourly=wave_height,wave_direction,wave_period&forecast_days=${GRID_FORECAST_DAYS}&timezone=GMT`,
  };
}

export type GridPoint = {
  lat: number;
  lon: number;
  /** Wind speed, direction (from, °T) and gust in kn, per entry of `times`. */
  ws: (number | null)[];
  wd: (number | null)[];
  wg: (number | null)[];
  /** Significant wave height (m), direction (from, °T), period (s). Null over land / near shore. */
  hs: (number | null)[];
  hd: (number | null)[];
  tp: (number | null)[];
};

export type WeatherGrid = Bounds & {
  step: number;
  model: WeatherGridModel;
  /** Epoch ms (UTC), hourly. */
  times: number[];
  points: GridPoint[];
  fetchedAt: string;
};

/** Open-Meteo with timezone=GMT returns "2026-10-26T14:00" — UTC. */
export function parseOpenMeteoTime(t: string): number {
  return Date.parse(t.length <= 16 ? `${t}:00Z` : t.endsWith("Z") ? t : `${t}Z`);
}

type OmHourly = Record<string, (number | null)[] | string[] | undefined>;
type OmLocation = { hourly?: OmHourly } | null | undefined;

const asList = (j: unknown): OmLocation[] => (Array.isArray(j) ? j : j ? [j as OmLocation] : []);
const num = (v: unknown, dp: number): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10 ** dp) / 10 ** dp : null;

/**
 * Join the forecast and marine multi-location responses onto the lattice.
 * Marine values are matched by timestamp, not index; a missing marine
 * response just leaves the wave fields null.
 */
export function parseOpenMeteoGrid(
  l: Lattice, forecastJson: unknown, marineJson: unknown, model: WeatherGridModel, fetchedAt: Date,
): WeatherGrid {
  const pts = latticePoints(l);
  const fc = asList(forecastJson);
  const mar = asList(marineJson);
  const times = ((fc[0]?.hourly?.time ?? []) as string[]).map(parseOpenMeteoTime);

  const points: GridPoint[] = pts.map((p, i) => {
    const f = fc[i]?.hourly ?? {};
    const m = mar[i]?.hourly;
    const marIdx = new Map<number, number>();
    ((m?.time ?? []) as string[]).forEach((t, k) => marIdx.set(parseOpenMeteoTime(t), k));
    const fv = (key: string, k: number, dp: number) => num((f[key] as (number | null)[] | undefined)?.[k], dp);
    const mv = (key: string, t: number, dp: number) => {
      const k = marIdx.get(t);
      return k == null ? null : num((m?.[key] as (number | null)[] | undefined)?.[k], dp);
    };
    return {
      lat: p.lat,
      lon: p.lon,
      ws: times.map((_, k) => fv("wind_speed_10m", k, 0)),
      wd: times.map((_, k) => fv("wind_direction_10m", k, 0)),
      wg: times.map((_, k) => fv("wind_gusts_10m", k, 0)),
      hs: times.map((t) => mv("wave_height", t, 1)),
      hd: times.map((t) => mv("wave_direction", t, 0)),
      tp: times.map((t) => mv("wave_period", t, 1)),
    };
  });

  return {
    south: l.south, west: l.west, north: l.north, east: l.east,
    step: l.step, model, times, points, fetchedAt: fetchedAt.toISOString(),
  };
}

/** Index of the time nearest `t` (0 for an empty list). */
export function timeIndexNear(times: number[], t: number): number {
  let best = 0;
  for (let i = 1; i < times.length; i++) if (Math.abs(times[i] - t) < Math.abs(times[best] - t)) best = i;
  return best;
}

/** Wind-barb feathers for a speed: pennant 50 kn, full 10 kn, half 5 kn, rounded to 5 kn. */
export function barbParts(kt: number): { calm: boolean; pennants: number; full: number; half: number } {
  let r = Math.round(Math.max(0, kt) / 5) * 5;
  if (r === 0) return { calm: true, pennants: 0, full: 0, half: 0 };
  const pennants = Math.floor(r / 50); r -= pennants * 50;
  const full = Math.floor(r / 10); r -= full * 10;
  return { calm: false, pennants, full, half: r >= 5 ? 1 : 0 };
}

/**
 * Wind barb as inline SVG (36×36). The staff points into the wind
 * (direction FROM, °T), feathers on the clockwise side as in the northern
 * hemisphere — the convention of GRIB viewers such as OpenCPN.
 */
export function barbSvg(kt: number, dirFromDeg: number, color: string): string {
  const c = 18, tip = 3, sp = 3.4;
  const p = barbParts(kt);
  const ink = `stroke="${color}" stroke-width="1.6" stroke-linecap="round" fill="none"`;
  if (p.calm) {
    return `<svg width="36" height="36" viewBox="0 0 36 36"><circle cx="${c}" cy="${c}" r="4" ${ink}/></svg>`;
  }
  const parts: string[] = [`<line x1="${c}" y1="${c}" x2="${c}" y2="${tip}" ${ink}/>`];
  let y = tip;
  for (let i = 0; i < p.pennants; i++) {
    parts.push(`<polygon points="${c},${y} ${c + 8},${y + 1.5} ${c},${y + 4}" fill="${color}" stroke="none"/>`);
    y += 4.6;
  }
  for (let i = 0; i < p.full; i++) {
    parts.push(`<line x1="${c}" y1="${y}" x2="${c + 8}" y2="${y - 3}" ${ink}/>`);
    y += sp;
  }
  if (p.half) {
    if (p.pennants === 0 && p.full === 0) y += sp; // a lone half barb sits off the tip
    parts.push(`<line x1="${c}" y1="${y}" x2="${c + 4.5}" y2="${y - 1.7}" ${ink}/>`);
  }
  parts.push(`<circle cx="${c}" cy="${c}" r="1.6" fill="${color}"/>`);
  return `<svg width="36" height="36" viewBox="0 0 36 36"><g transform="rotate(${Math.round(dirFromDeg)} ${c} ${c})">${parts.join("")}</g></svg>`;
}

/** Hs colour bands, matching the go/no-go thresholds (2.5 m caution, 3.5 m no-go). */
export function waveColor(hs: number): string {
  if (hs < 0.5) return "#1e4fa3";
  if (hs < 1) return "#2f7fe6";
  if (hs < 1.5) return "#2ec6c6";
  if (hs < 2.5) return "#ffd400";
  if (hs < 3.5) return "#ff8a00";
  return "#e11d2e";
}

export const WAVE_LEGEND: { label: string; color: string }[] = [
  { label: "<0.5", color: waveColor(0) },
  { label: "1", color: waveColor(0.7) },
  { label: "1.5", color: waveColor(1.2) },
  { label: "2.5", color: waveColor(2) },
  { label: "3.5", color: waveColor(3) },
  { label: "3.5+", color: waveColor(4) },
];
