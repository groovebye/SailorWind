/**
 * Tidal prediction for N Spain / Iberia ports — multi-constituent harmonic model.
 *
 * h(t) = Σ Hᵢ·fᵢ·cos( Vᵢ(t) + uᵢ(t) − gᵢ )   over M2, S2, N2, K1, O1
 *
 * - Vᵢ(t) (equilibrium arguments) are computed from the astronomical mean
 *   longitudes (s, h, p) and lunar time τ at the actual date — so predictions
 *   are valid for ANY year (no fixed-epoch propagation, the old model's flaw).
 * - fᵢ, uᵢ are the 18.6-yr nodal corrections (function of the lunar node N).
 * - Per-port amplitudes are DERIVED from the published spring/neap ranges
 *   (M2 = (spring+neap)/4, S2 = (spring−neap)/4) with N2/K1/O1 as typical
 *   semidiurnal-regime ratios.
 * - The M2 phase lag g is CALIBRATED once from the port's known HW timing
 *   (HW Dover + port offset) so HW times match observation; the calibration
 *   date is a reference fact, not a propagation seed.
 *
 * This is approximate (~15–30 min) and ADVISORY. Constants are derived, not
 * official harmonic constants — refine with Puertos del Estado / Admiralty data.
 * For legal/precision use: WorldTides API or Admiralty EasyTide.
 */

// ── Constituents (mean angular speeds, deg/solar-hour) — for reference ─────
// M2 28.9841, S2 30.0000, N2 28.4397, K1 15.0411, O1 13.9430

// Calibration anchor: HW Dover ≈ 06:00 UTC on 2026-04-13. Used ONCE per port to
// derive the M2 phase lag g (a constant); predictions use astronomical args.
const REF_HW_DOVER = Date.UTC(2026, 3, 13, 6, 0, 0);

// Port offset from HW Dover (hours to ADD) — also used to derive M2 phase.
const PORT_OFFSETS: Record<string, number> = {
  gijon: 5.5, candas: 5.5, luanco: 5.5, aviles: 5.58, cudillero: 5.6,
  luarca: 5.67, navia: 5.75, ribadeo: 5.83, foz: 5.88, burela: 5.9,
  viveiro: 5.92, "estaca-de-bares": 5.95, "cabo-ortegal": 5.97, carino: 5.97,
  cedeira: 6.0, ferrol: 5.75, sada: 5.7, "la-coruna": 5.67,
};

// Spring and neap tidal ranges (meters).
const PORT_RANGES: Record<string, { spring: number; neap: number }> = {
  gijon: { spring: 4.9, neap: 2.5 }, candas: { spring: 4.9, neap: 2.5 },
  luanco: { spring: 4.9, neap: 2.5 }, aviles: { spring: 4.9, neap: 2.5 },
  cudillero: { spring: 4.7, neap: 2.4 }, luarca: { spring: 4.5, neap: 2.3 },
  navia: { spring: 4.3, neap: 2.2 }, ribadeo: { spring: 3.7, neap: 1.9 },
  foz: { spring: 3.6, neap: 1.8 }, burela: { spring: 3.5, neap: 1.8 },
  viveiro: { spring: 3.5, neap: 1.8 }, "estaca-de-bares": { spring: 4.0, neap: 2.0 },
  "cabo-ortegal": { spring: 4.0, neap: 2.0 }, carino: { spring: 4.0, neap: 2.0 },
  cedeira: { spring: 4.4, neap: 2.2 }, ferrol: { spring: 4.4, neap: 2.2 },
  sada: { spring: 4.8, neap: 2.4 }, "la-coruna": { spring: 5.0, neap: 2.5 },
};

// Tidal stream rates/directions per key area (unchanged).
export interface TidalStream {
  area: string; floodDir: string; ebbDir: string;
  springRate: number; neapRate: number; notes: string;
}
const TIDAL_STREAMS: Record<string, TidalStream> = {
  "cabo-penas": { area: "Cabo Peñas", floodDir: "E", ebbDir: "W", springRate: 1.0, neapRate: 0.3, notes: "Strongest tidal area in Asturias. E-going flood, W-going ebb." },
  "estaca-de-bares": { area: "Estaca de Bares", floodDir: "E", ebbDir: "W", springRate: 2.0, neapRate: 0.8, notes: "CRITICAL — strongest tidal streams on the route. Wind against tide = dangerous." },
  "cabo-ortegal": { area: "Cabo Ortegal", floodDir: "NE", ebbDir: "SW", springRate: 2.0, neapRate: 0.8, notes: "Strong and unpredictable due to complex seabed. Combined with wind = confused seas." },
  "ribadeo-ria": { area: "Ribadeo Ría entrance", floodDir: "S", ebbDir: "N", springRate: 2.0, neapRate: 0.8, notes: "Strong tidal flow in ría entrance. Flood runs S into ría." },
};

export interface TideExtreme { time: Date; type: "HW" | "LW"; height: number; }
export interface TidePrediction {
  portSlug: string; extremes: TideExtreme[]; range: number;
  isSpring: boolean; nearestStream: TidalStream | null;
}

// ── Astronomy ───────────────────────────────────────────────────────────
const DEG = Math.PI / 180;
const norm360 = (d: number) => ((d % 360) + 360) % 360;

/** Mean longitudes (deg) + lunar time τ at time t. Valid any year. */
function astro(t: number) {
  const d = (t - Date.UTC(2000, 0, 1, 0, 0, 0)) / 86400000; // days since J2000
  const s = norm360(218.316 + 13.176396 * d);   // moon mean longitude
  const h = norm360(280.466 + 0.985647 * d);    // sun mean longitude
  const p = norm360(83.353 + 0.111404 * d);     // lunar perigee
  const N = norm360(125.045 - 0.052954 * d);    // ascending node
  const hourUTC = ((t / 3600000) % 24 + 24) % 24;
  const tau = norm360(15 * hourUTC + h - s);    // mean lunar time
  return { s, h, p, N, tau };
}

type Consti = "M2" | "S2" | "N2" | "K1" | "O1";

/** Equilibrium argument Vᵢ(t) in degrees (relative formulation in s,h,p,τ). */
function equilibrium(c: Consti, a: ReturnType<typeof astro>): number {
  switch (c) {
    case "M2": return 2 * a.tau;
    case "S2": return 2 * a.tau + 2 * (a.s - a.h);
    case "N2": return 2 * a.tau + (a.p - a.s);
    case "K1": return a.tau + 90;
    case "O1": return a.tau - 90;
  }
}

/** Nodal factor f and phase correction u (deg) for a constituent given node N. */
function nodal(c: Consti, N: number): { f: number; u: number } {
  const Nr = N * DEG;
  switch (c) {
    case "M2": case "N2": return { f: 1.0 - 0.037 * Math.cos(Nr), u: -2.14 * Math.sin(Nr) };
    case "S2": return { f: 1.0, u: 0 };
    case "K1": return { f: 1.006 + 0.115 * Math.cos(Nr), u: -8.86 * Math.sin(Nr) };
    case "O1": return { f: 1.009 + 0.187 * Math.cos(Nr), u: 10.80 * Math.sin(Nr) };
  }
}

type PortConstants = { H: Record<Consti, number>; g: Record<Consti, number> };

/** Derive per-port amplitudes (from ranges) and M2-calibrated phase lags. */
function portConstants(slug: string): PortConstants | null {
  const offset = PORT_OFFSETS[slug];
  const ranges = PORT_RANGES[slug];
  if (offset === undefined || !ranges) return null;

  const m2 = Math.max(0, (ranges.spring + ranges.neap) / 4);
  const s2 = Math.max(0, (ranges.spring - ranges.neap) / 4);
  const H: Record<Consti, number> = { M2: m2, S2: s2, N2: 0.19 * m2, K1: 0.06 * m2, O1: 0.05 * m2 };

  // Calibrate g_M2 so M2 peaks (HW) at the port's known reference HW time.
  const tHW = REF_HW_DOVER + offset * 3600000;
  const a = astro(tHW);
  const uM2 = nodal("M2", a.N).u;
  const gM2 = norm360(equilibrium("M2", a) + uM2);
  // Other constituents phase-locked to M2: springs at syzygy, etc. (approx).
  const g: Record<Consti, number> = { M2: gM2, S2: gM2, N2: gM2, K1: gM2, O1: gM2 };
  return { H, g };
}

const CONSTITUENTS: Consti[] = ["M2", "S2", "N2", "K1", "O1"];

/** Tidal height (m, relative to mean level) at time t for given port constants. */
function heightAt(t: number, k: PortConstants): number {
  const a = astro(t);
  let h = 0;
  for (const c of CONSTITUENTS) {
    if (k.H[c] === 0) continue;
    const { f, u } = nodal(c, a.N);
    h += k.H[c] * f * Math.cos((equilibrium(c, a) + u - k.g[c]) * DEG);
  }
  return h;
}

// ── Public API ──────────────────────────────────────────────────────────

/** Tide prediction for a port over a date range (multi-constituent synthesis). */
export function getTidePrediction(portSlug: string, startDate: Date, days: number = 2): TidePrediction | null {
  const k = portConstants(portSlug);
  if (!k) return null;

  const startMs = startDate.getTime();
  const from = startMs - 2 * 86400000; // pad so we bracket extremes around startDate
  const to = startMs + (days + 1) * 86400000;
  const stepMin = 6;
  const stepMs = stepMin * 60000;

  // Sample the curve and pick local maxima (HW) / minima (LW).
  const extremes: TideExtreme[] = [];
  let prev2 = heightAt(from - stepMs, k);
  let prev1 = heightAt(from, k);
  for (let t = from + stepMs; t <= to; t += stepMs) {
    const cur = heightAt(t, k);
    if (prev1 > prev2 && prev1 >= cur) {
      extremes.push({ time: new Date(t - stepMs), type: "HW", height: Math.round(prev1 * 100) / 100 });
    } else if (prev1 < prev2 && prev1 <= cur) {
      extremes.push({ time: new Date(t - stepMs), type: "LW", height: Math.round(prev1 * 100) / 100 });
    }
    prev2 = prev1;
    prev1 = cur;
  }
  extremes.sort((a, b) => a.time.getTime() - b.time.getTime());

  // Current range: largest HW − smallest LW within ~26 h around startDate.
  const win = extremes.filter((e) => Math.abs(e.time.getTime() - startMs) <= 13 * 3600000);
  const hi = Math.max(...win.filter((e) => e.type === "HW").map((e) => e.height), 0);
  const lo = Math.min(...win.filter((e) => e.type === "LW").map((e) => e.height), 0);
  const range = Math.round((hi - lo) * 10) / 10;

  // Spring/neap from synodic phase (moon-sun elongation): syzygy ⇒ springs.
  const a = astro(startMs);
  const beat = Math.cos(2 * (a.s - a.h) * DEG); // +1 at syzygy, −1 at quadrature
  const isSpring = beat > 0.3;

  // Nearest tidal stream (substring match, as before).
  let nearestStream: TidalStream | null = null;
  for (const key of Object.keys(TIDAL_STREAMS)) {
    if (portSlug.includes(key.replace("-", "")) || key.includes(portSlug)) {
      nearestStream = TIDAL_STREAMS[key];
      break;
    }
  }

  return { portSlug, extremes, range, isSpring, nearestStream };
}

/** Tide state (rising/falling, hours to HW/LW, approx height) at a specific time. */
export function tideStateAt(prediction: TidePrediction, time: Date): {
  rising: boolean; hoursToHW: number; hoursToLW: number; approxHeight: number; description: string;
} {
  const t = time.getTime();
  let prevExtreme: TideExtreme | null = null;
  let nextExtreme: TideExtreme | null = null;
  for (const e of prediction.extremes) {
    if (e.time.getTime() <= t) prevExtreme = e;
    if (e.time.getTime() > t && !nextExtreme) nextExtreme = e;
  }

  if (!prevExtreme || !nextExtreme) {
    const nearest = prediction.extremes.reduce<TideExtreme | null>((best, e) =>
      !best || Math.abs(e.time.getTime() - t) < Math.abs(best.time.getTime() - t) ? e : best, null);
    if (nearest) {
      const diff = (nearest.time.getTime() - t) / 3600000;
      return { rising: nearest.type === "HW" ? diff > 0 : diff <= 0, hoursToHW: 0, hoursToLW: 0, approxHeight: 0, description: `Near ${nearest.type} (${Math.abs(diff).toFixed(1)}h ${diff > 0 ? "ahead" : "ago"})` };
    }
    return { rising: true, hoursToHW: 0, hoursToLW: 0, approxHeight: 0, description: "Tide data unavailable" };
  }

  const rising = nextExtreme.type === "HW";
  const elapsed = (t - prevExtreme.time.getTime()) / 3600000;
  const total = (nextExtreme.time.getTime() - prevExtreme.time.getTime()) / 3600000;
  const fraction = total > 0 ? elapsed / total : 0;
  const approxHeight = prevExtreme.height + (nextExtreme.height - prevExtreme.height) * (1 - Math.cos(fraction * Math.PI)) / 2;

  let hoursToHW = Infinity, hoursToLW = Infinity;
  for (const e of prediction.extremes) {
    const diff = (e.time.getTime() - t) / 3600000;
    if (diff > 0) {
      if (e.type === "HW" && diff < hoursToHW) hoursToHW = diff;
      if (e.type === "LW" && diff < hoursToLW) hoursToLW = diff;
    }
  }

  const desc = rising ? `Rising tide, ${hoursToHW.toFixed(1)}h to HW` : `Falling tide, ${hoursToLW.toFixed(1)}h to LW`;
  return {
    rising,
    hoursToHW: Number.isFinite(hoursToHW) ? Math.round(hoursToHW * 10) / 10 : 0,
    hoursToLW: Number.isFinite(hoursToLW) ? Math.round(hoursToLW * 10) / 10 : 0,
    approxHeight: Math.round(approxHeight * 10) / 10,
    description: desc,
  };
}
