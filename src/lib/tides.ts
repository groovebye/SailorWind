/**
 * Tidal prediction for N Spain ports.
 *
 * Based on semi-diurnal tide model:
 * - HW Dover as reference
 * - Port offsets from published tidal data
 * - Spring/neap ranges from Admiralty tables
 * - Tidal streams from pilot books
 *
 * This is approximate (~15-30 min accuracy) but operationally useful.
 * For precision, use WorldTides API or Admiralty EasyTide.
 */

// HW period: ~12h 25m
const HW_PERIOD_MS = (12 * 60 + 25) * 60 * 1000;

// Reference: Full Moon April 12 2026 → HW Dover ~06:00 UTC Apr 13
// This shifts ~50 min later each day
const REF_HW_DOVER = new Date("2026-04-13T06:00:00Z").getTime();

// Port offset from HW Dover (hours to ADD)
const PORT_OFFSETS: Record<string, number> = {
  gijon: 5.5,
  candas: 5.5,
  luanco: 5.5,
  aviles: 5.58,
  cudillero: 5.6,
  luarca: 5.67,
  navia: 5.75,
  ribadeo: 5.83,
  foz: 5.88,
  burela: 5.9,
  viveiro: 5.92,
  "estaca-de-bares": 5.95,
  "cabo-ortegal": 5.97,
  carino: 5.97,
  cedeira: 6.0,
  ferrol: 5.75,
  sada: 5.7,
  "la-coruna": 5.67,
};

// Spring and neap tidal ranges (meters)
const PORT_RANGES: Record<string, { spring: number; neap: number }> = {
  gijon: { spring: 4.9, neap: 2.5 },
  candas: { spring: 4.9, neap: 2.5 },
  luanco: { spring: 4.9, neap: 2.5 },
  aviles: { spring: 4.9, neap: 2.5 },
  cudillero: { spring: 4.7, neap: 2.4 },
  luarca: { spring: 4.5, neap: 2.3 },
  navia: { spring: 4.3, neap: 2.2 },
  ribadeo: { spring: 3.7, neap: 1.9 },
  foz: { spring: 3.6, neap: 1.8 },
  burela: { spring: 3.5, neap: 1.8 },
  viveiro: { spring: 3.5, neap: 1.8 },
  "estaca-de-bares": { spring: 4.0, neap: 2.0 },
  "cabo-ortegal": { spring: 4.0, neap: 2.0 },
  carino: { spring: 4.0, neap: 2.0 },
  cedeira: { spring: 4.4, neap: 2.2 },
  ferrol: { spring: 4.4, neap: 2.2 },
  sada: { spring: 4.8, neap: 2.4 },
  "la-coruna": { spring: 5.0, neap: 2.5 },
};

// Tidal stream rates and directions per key area
export interface TidalStream {
  area: string;
  floodDir: string;  // compass direction of flood stream
  ebbDir: string;
  springRate: number; // knots
  neapRate: number;
  notes: string;
}

const TIDAL_STREAMS: Record<string, TidalStream> = {
  "cabo-penas": {
    area: "Cabo Peñas",
    floodDir: "E", ebbDir: "W",
    springRate: 1.0, neapRate: 0.3,
    notes: "Strongest tidal area in Asturias. E-going flood, W-going ebb.",
  },
  "estaca-de-bares": {
    area: "Estaca de Bares",
    floodDir: "E", ebbDir: "W",
    springRate: 2.0, neapRate: 0.8,
    notes: "CRITICAL — strongest tidal streams on the route. Wind against tide = dangerous.",
  },
  "cabo-ortegal": {
    area: "Cabo Ortegal",
    floodDir: "NE", ebbDir: "SW",
    springRate: 2.0, neapRate: 0.8,
    notes: "Strong and unpredictable due to complex seabed. Combined with wind = confused seas.",
  },
  "ribadeo-ria": {
    area: "Ribadeo Ría entrance",
    floodDir: "S", ebbDir: "N",
    springRate: 2.0, neapRate: 0.8,
    notes: "Strong tidal flow in ría entrance. Flood runs S into ría.",
  },
};

export interface TideExtreme {
  time: Date;
  type: "HW" | "LW";
  height: number; // meters above chart datum (approximate)
}

export interface TidePrediction {
  portSlug: string;
  extremes: TideExtreme[];
  range: number;          // current tidal range
  isSpring: boolean;
  nearestStream: TidalStream | null;
}

/**
 * Get HW Dover times for a date range
 */
function hwDoverTimes(startDate: Date, days: number): Date[] {
  const start = startDate.getTime();
  const end = start + days * 86400000;

  // Start 24h before to ensure we have extremes before the target time
  // (port offsets can add up to 6h, and we need prev+next brackets)
  let t = REF_HW_DOVER;
  const lookback = start - 2 * 86400000; // 2 days before
  while (t > lookback) t -= HW_PERIOD_MS;
  while (t < lookback) t += HW_PERIOD_MS;

  const times: Date[] = [];
  while (t < end + 86400000) { // extend 1 day past end too
    times.push(new Date(t));
    t += HW_PERIOD_MS;
  }
  return times;
}

/**
 * Determine if date is near springs or neaps
 * Springs = full/new moon (0, 14.75 day cycle)
 * Neaps = quarter moon (7.4 days from springs)
 */
function springNeapFactor(date: Date): number {
  // Lunar cycle: 29.5 days. Full moon Apr 12 2026
  const fullMoonRef = new Date("2026-04-12T00:00:00Z").getTime();
  const lunarCycle = 29.53 * 86400000;
  const daysSinceFullMoon = ((date.getTime() - fullMoonRef) % lunarCycle + lunarCycle) % lunarCycle / 86400000;

  // Springs at 0, 14.75 days. Neaps at 7.4, 22.1 days
  const phaseAngle = (daysSinceFullMoon / 29.53) * 2 * Math.PI;
  // cos(0) = 1 at springs, cos(PI) = -1 at neaps
  return Math.cos(phaseAngle * 2); // *2 because two springs per cycle
}

/**
 * Get tide prediction for a port on a date range
 */
export function getTidePrediction(portSlug: string, startDate: Date, days: number = 2): TidePrediction | null {
  const offset = PORT_OFFSETS[portSlug];
  const ranges = PORT_RANGES[portSlug];
  if (offset === undefined || !ranges) return null;

  const offsetMs = offset * 3600000;
  const hwDover = hwDoverTimes(startDate, days);

  // Spring/neap factor: 1 = springs, -1 = neaps
  const snFactor = springNeapFactor(startDate);
  const isSpring = snFactor > 0.3;
  const range = ranges.neap + (ranges.spring - ranges.neap) * (snFactor + 1) / 2;
  const hwHeight = range / 2;
  const lwHeight = -range / 2;

  const extremes: TideExtreme[] = [];
  for (const hwD of hwDover) {
    const hwLocal = new Date(hwD.getTime() + offsetMs);
    const lwLocal = new Date(hwLocal.getTime() + HW_PERIOD_MS / 2); // LW ~6h12m after HW

    extremes.push({ time: hwLocal, type: "HW", height: Math.round(hwHeight * 10) / 10 });
    extremes.push({ time: lwLocal, type: "LW", height: Math.round(lwHeight * 10) / 10 });
  }

  // Sort chronologically
  extremes.sort((a, b) => a.time.getTime() - b.time.getTime());

  // Find nearest tidal stream
  let nearestStream: TidalStream | null = null;
  const streamKeys = Object.keys(TIDAL_STREAMS);
  for (const key of streamKeys) {
    if (portSlug.includes(key.replace("-", "")) || key.includes(portSlug)) {
      nearestStream = TIDAL_STREAMS[key];
      break;
    }
  }

  return { portSlug, extremes, range: Math.round(range * 10) / 10, isSpring, nearestStream };
}

/**
 * Get tide state at a specific time
 */
export function tideStateAt(prediction: TidePrediction, time: Date): {
  rising: boolean;
  hoursToHW: number;
  hoursToLW: number;
  approxHeight: number;
  description: string;
} {
  const t = time.getTime();

  // Find surrounding extremes
  let prevExtreme: TideExtreme | null = null;
  let nextExtreme: TideExtreme | null = null;

  for (const e of prediction.extremes) {
    if (e.time.getTime() <= t) prevExtreme = e;
    if (e.time.getTime() > t && !nextExtreme) nextExtreme = e;
  }

  if (!prevExtreme || !nextExtreme) {
    // Fallback: find any nearby extreme and give approximate state
    const nearest = prediction.extremes.reduce<TideExtreme | null>((best, e) => {
      if (!best) return e;
      return Math.abs(e.time.getTime() - t) < Math.abs(best.time.getTime() - t) ? e : best;
    }, null);
    if (nearest) {
      const diff = (nearest.time.getTime() - t) / 3600000;
      return { rising: nearest.type === "HW" ? diff > 0 : diff <= 0, hoursToHW: 0, hoursToLW: 0, approxHeight: 0, description: `Near ${nearest.type} (${diff > 0 ? "in" : ""} ${Math.abs(diff).toFixed(1)}h ${diff > 0 ? "ahead" : "ago"})` };
    }
    return { rising: true, hoursToHW: 0, hoursToLW: 0, approxHeight: 0, description: "Tide data unavailable" };
  }

  const rising = nextExtreme.type === "HW";
  const elapsed = (t - prevExtreme.time.getTime()) / 3600000;
  const total = (nextExtreme.time.getTime() - prevExtreme.time.getTime()) / 3600000;
  const fraction = elapsed / total;

  // Sinusoidal approximation
  const prevH = prevExtreme.height;
  const nextH = nextExtreme.height;
  const approxHeight = prevH + (nextH - prevH) * (1 - Math.cos(fraction * Math.PI)) / 2;

  // Find next HW and LW
  let hoursToHW = Infinity, hoursToLW = Infinity;
  for (const e of prediction.extremes) {
    const diff = (e.time.getTime() - t) / 3600000;
    if (diff > 0) {
      if (e.type === "HW" && diff < hoursToHW) hoursToHW = diff;
      if (e.type === "LW" && diff < hoursToLW) hoursToLW = diff;
    }
  }

  const desc = rising
    ? `Rising tide, ${hoursToHW.toFixed(1)}h to HW`
    : `Falling tide, ${hoursToLW.toFixed(1)}h to LW`;

  return {
    rising,
    hoursToHW: Math.round(hoursToHW * 10) / 10,
    hoursToLW: Math.round(hoursToLW * 10) / 10,
    approxHeight: Math.round(approxHeight * 10) / 10,
    description: desc,
  };
}
