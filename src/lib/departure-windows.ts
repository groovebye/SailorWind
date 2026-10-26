/**
 * Departure-window planner — "when should we leave?"
 *
 * Runs the hourly leg timeline engine (passage-computation) for a series of
 * candidate departure times, each under three planning scenarios
 * (pessimistic / realistic / optimistic), and condenses every run into the row
 * a skipper compares: arrival, hours, motoring share, wind, sea state, fuel,
 * daylight arrival. Deterministic — the same forecast in gives the same table
 * out; nothing here calls a network or a model.
 *
 * Scenarios are boat-performance and forecast-error envelopes, not different
 * forecasts: the polar is scaled for the sail-speed factor (so a slower boat
 * also motors more, via the engine's SOG < 4.5 kt rule), the engine speed is
 * scaled, and the reported max wind/gust/Hs get a forecast-error margin.
 * "Optimistic" means the boat sails better, not that it arrives first: in
 * marginal wind it keeps sailing at ~5 kn where the realistic boat motors at
 * ~6, so the arrival range is min/max across scenarios, not opt/pess.
 */

import {
  computeLegTimelineFromContext,
  retimeLegTimelineContext,
  type LegTimelineComputation,
  type LegTimelineContext,
  type PassageLike,
  type VesselLike,
} from "@/lib/passage-computation";
import { isDaylight, sunTimes } from "@/lib/astro";
import { toRad, toDeg, normalizeAngle } from "@/lib/geo";

export type ScenarioKey = "pessimistic" | "realistic" | "optimistic";

export interface PlanningScenario {
  key: ScenarioKey;
  label: string;
  /** Multiplier on polar boat speed under sail. */
  sailSpeedFactor: number;
  /** Multiplier on engine cruise speed. */
  engineSpeedFactor: number;
  /** Forecast-error margin on the reported max wind / gust / Hs. */
  conditionsMargin: number;
}

export const PLANNING_SCENARIOS: PlanningScenario[] = [
  { key: "pessimistic", label: "Pessimistic", sailSpeedFactor: 0.85, engineSpeedFactor: 0.9, conditionsMargin: 1.15 },
  { key: "realistic", label: "Realistic", sailSpeedFactor: 1, engineSpeedFactor: 1, conditionsMargin: 1 },
  { key: "optimistic", label: "Optimistic", sailSpeedFactor: 1.1, engineSpeedFactor: 1, conditionsMargin: 1 },
];

/** Skipper's day: ~9 h target, 11 h hard ceiling before it's an overnight. */
export interface DayLimits {
  targetHours: number;
  maxHours: number;
}

export const DEFAULT_DAY_LIMITS: DayLimits = { targetHours: 9, maxHours: 11 };

// Open-water GO/CAUTION/NO-GO thresholds — same numbers as goNogo() in weather.ts.
const CAUTION = { windKt: 20, waveM: 2.5 };
const NO_GO = { windKt: 30, gustKt: 35, waveM: 3.5 };

export type WindowVerdict = "GO" | "CAUTION" | "NO-GO";
export type DayFit = "day" | "long-day" | "overnight";
export type WindowTag = "best-balance" | "least-motoring" | "calmest-sea" | "fastest";

export interface ScenarioOutcome {
  scenario: ScenarioKey;
  arrival: string;
  hours: number;
  /** Share of hours with the engine on (motor + motor-sail), 0–100. */
  motoringPct: number;
  fuelL: number;
  arrivalDaylight: boolean;
  /** Minutes from arrival to sunset at the destination; negative = after sunset. */
  minutesBeforeSunset: number | null;
  /** Hours underway between sunset and sunrise (sun computed at each hourly position). */
  nightHours: number;
  maxWindKt: number;
  maxGustKt: number;
  maxWaveM: number;
  /** The engine's simulation cap was hit before arrival. */
  truncated: boolean;
}

export interface DepartureWindowRow {
  departure: string;
  outcomes: Record<ScenarioKey, ScenarioOutcome>;
  /** Realistic run: mean wind speed and resultant (speed-weighted) direction. */
  meanWindKt: number;
  meanWindDirDeg: number | null;
  comfortScore: number;
  /** NO-GO on the realistic run; CAUTION also when the pessimistic envelope or fuel breaks a limit. */
  verdict: WindowVerdict;
  reasons: string[];
  dayFit: DayFit;
  /** Pessimistic arrival is past the last forecast hour — low confidence. */
  beyondForecast: boolean;
  score: number;
  tags: WindowTag[];
}

export interface DepartureWindowsResult {
  rows: DepartureWindowRow[];
  scenarios: PlanningScenario[];
  dayLimits: DayLimits;
  forecastHorizon: string | null;
  best: string | null;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** `count` departures from `start`, every `stepHours`. */
export function departureCandidates(start: Date, count: number, stepHours: number): Date[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => new Date(start.getTime() + i * stepHours * 3_600_000));
}

/** First UTC instant after `now` on a whole `stepHours` boundary (00/06/12/18 for 6 h). */
export function nextAlignedSlot(now: Date, stepHours: number): Date {
  const stepMs = stepHours * 3_600_000;
  return new Date(Math.floor(now.getTime() / stepMs) * stepMs + stepMs);
}

/** The vessel as the scenario sees it: scaled polar + scaled engine. */
export function scenarioVessel(vessel: VesselLike, scenario: PlanningScenario): VesselLike {
  const polar = vessel.performanceModel.polarData;
  return {
    ...vessel,
    engineCruiseKt: vessel.engineCruiseKt * scenario.engineSpeedFactor,
    performanceModel: {
      ...vessel.performanceModel,
      polarData: polar
        ? { ...polar, boatSpeeds: polar.boatSpeeds.map((row) => row.map((v) => v * scenario.sailSpeedFactor)) }
        : polar,
    },
  };
}

function summarizeRun(
  run: LegTimelineComputation,
  departure: Date,
  scenario: PlanningScenario,
  dest: { lat: number; lon: number },
): ScenarioOutcome {
  const { timeline, summary } = run;
  const last = timeline[timeline.length - 1];
  // The engine steps whole hours; only part of the last hour is needed, so
  // hours, engine share and fuel all weight that hour by the fraction used.
  const lastFraction = last && last.expectedSogKt > 0 ? Math.min(1, last.distanceToGoNm / last.expectedSogKt) : 1;
  const truncated = !!last && last.distanceToGoNm - last.expectedSogKt > 0.1;
  const weight = (i: number) => (i === timeline.length - 1 ? lastFraction : 1);
  const hours = timeline.reduce((sum, _e, i) => sum + weight(i), 0);
  const engineHours = timeline.reduce((sum, e, i) => sum + (e.engineOn ? weight(i) : 0), 0);
  const fuelL = timeline.reduce((sum, e, i) => sum + e.fuelUsedThisHourL * weight(i), 0);
  const arrivalMs = departure.getTime() + hours * 3_600_000;

  const sun = sunTimes(dest.lat, dest.lon, arrivalMs);
  const nightHours = timeline.filter((e) => {
    const t = Date.parse(e.time);
    const s = sunTimes(e.lat, e.lon, t);
    return !isDaylight(t, s.sunrise, s.sunset);
  }).length;

  return {
    scenario: scenario.key,
    arrival: new Date(arrivalMs).toISOString(),
    hours: round1(hours),
    motoringPct: hours > 0 ? Math.round((engineHours / hours) * 100) : 0,
    fuelL: round1(fuelL),
    arrivalDaylight: isDaylight(arrivalMs, sun.sunrise, sun.sunset),
    minutesBeforeSunset: sun.sunset != null ? Math.round((sun.sunset - arrivalMs) / 60_000) : null,
    nightHours,
    maxWindKt: Math.round(summary.maxWindKt * scenario.conditionsMargin),
    maxGustKt: Math.round(summary.maxGustKt * scenario.conditionsMargin),
    maxWaveM: round1(summary.maxWaveM * scenario.conditionsMargin),
    truncated,
  };
}

/** Usable fuel (falls back to tank size) and the reserve to keep, as the engine's fuel summary does. */
function fuelLimits(vessel: VesselLike) {
  return { capacityL: vessel.usableFuelLiters ?? vessel.fuelTankLiters ?? null, reserveL: vessel.reserveFuelLiters ?? 10 };
}

/**
 * NO-GO only when the realistic run breaks a NO-GO limit. The pessimistic
 * envelope (slower boat + forecast-error margin) can raise CAUTION but never
 * veto on its own — a margin on top of a margin would flag ordinary 3 m
 * Atlantic swell as dangerous.
 */
function judge(realistic: ScenarioOutcome, worst: ScenarioOutcome, fuel: ReturnType<typeof fuelLimits>): { verdict: WindowVerdict; reasons: string[] } {
  const reasons: string[] = [];
  let level = 0; // 0 GO, 1 CAUTION, 2 NO-GO
  const check = (label: string, unit: string, real: number, pess: number, caution: number, noGo: number) => {
    if (real > noGo) { level = 2; reasons.push(`${label} to ${real} ${unit}`); }
    else if (real > caution) { level = Math.max(level, 1); reasons.push(`${label} to ${real} ${unit}`); }
    else if (pess > caution) { level = Math.max(level, 1); reasons.push(`${label} to ${pess} ${unit} (pessimistic)`); }
  };
  check("wind", "kn", realistic.maxWindKt, worst.maxWindKt, CAUTION.windKt, NO_GO.windKt);
  check("gusts", "kn", realistic.maxGustKt, worst.maxGustKt, NO_GO.gustKt, NO_GO.gustKt);
  check("sea", "m", realistic.maxWaveM, worst.maxWaveM, CAUTION.waveM, NO_GO.waveM);
  if (fuel.capacityL != null && worst.fuelL > fuel.capacityL - fuel.reserveL) {
    level = Math.max(level, 1);
    reasons.push(worst.fuelL > fuel.capacityL
      ? `fuel ${Math.round(worst.fuelL)} L > ${fuel.capacityL} L tank${realistic.fuelL > fuel.capacityL ? "" : " (pessimistic)"}`
      : `fuel ${Math.round(worst.fuelL)} L leaves < ${fuel.reserveL} L reserve`);
  }
  if (realistic.truncated) { level = 2; reasons.push("does not arrive within the simulation cap"); }
  return { verdict: level === 2 ? "NO-GO" : level === 1 ? "CAUTION" : "GO", reasons };
}

function meanWind(run: LegTimelineComputation): { kt: number; dirDeg: number | null } {
  const tl = run.timeline;
  if (tl.length === 0) return { kt: 0, dirDeg: null };
  let x = 0, y = 0, sum = 0;
  for (const e of tl) {
    sum += e.windKt;
    x += e.windKt * Math.sin(toRad(e.windDirDeg));
    y += e.windKt * Math.cos(toRad(e.windDirDeg));
  }
  const dirDeg = x === 0 && y === 0 ? null : Math.round(normalizeAngle(toDeg(Math.atan2(x, y))));
  return { kt: round1(sum / tl.length), dirDeg };
}

function dayFitFor(hours: number, limits: DayLimits): DayFit {
  if (hours <= limits.targetHours) return "day";
  if (hours <= limits.maxHours) return "long-day";
  return "overnight";
}

/**
 * Higher is better. Comfort (0–100) is the base; engine time, a night
 * arrival, a CAUTION/NO-GO verdict and a beyond-forecast arrival cost points.
 * Weights are deliberately simple so the ranking is explainable: a daylight
 * arrival is worth ~50 % less motoring.
 */
function scoreRow(realistic: ScenarioOutcome, comfort: number, verdict: WindowVerdict, beyondForecast: boolean): number {
  let score = comfort - 0.3 * realistic.motoringPct;
  if (!realistic.arrivalDaylight) score -= 15;
  if (verdict === "CAUTION") score -= 10;
  if (verdict === "NO-GO") score -= 100;
  if (beyondForecast) score -= 20;
  return round1(score);
}

function forecastHorizonMs(context: LegTimelineContext): number | null {
  const ends = Object.values(context.forecasts)
    .filter((entries) => entries.length > 0)
    .map((entries) => Date.parse(entries[entries.length - 1].time));
  return ends.length ? Math.min(...ends) : null;
}

function tagRows(rows: DepartureWindowRow[]) {
  if (rows.length < 2) return;
  const candidates = rows.filter((r) => r.verdict !== "NO-GO");
  const pick = (list: DepartureWindowRow[], key: (r: DepartureWindowRow) => number, tag: WindowTag) => {
    if (list.length === 0) return;
    const best = list.reduce((a, b) => (key(b) < key(a) ? b : a));
    best.tags.push(tag);
  };
  pick(candidates, (r) => -r.score, "best-balance");
  pick(candidates, (r) => r.outcomes.realistic.motoringPct, "least-motoring");
  pick(candidates, (r) => r.outcomes.realistic.maxWaveM, "calmest-sea");
  pick(candidates, (r) => r.outcomes.realistic.hours, "fastest");
}

export function computeDepartureWindows(input: {
  context: LegTimelineContext;
  passage: PassageLike;
  vessel: VesselLike;
  departures: Date[];
  scenarios?: PlanningScenario[];
  dayLimits?: DayLimits;
}): DepartureWindowsResult {
  const scenarios = input.scenarios ?? PLANNING_SCENARIOS;
  const dayLimits = input.dayLimits ?? DEFAULT_DAY_LIMITS;
  const dest = { lat: input.context.leg.to.port.lat, lon: input.context.leg.to.port.lon };
  const horizon = forecastHorizonMs(input.context);
  const fuel = fuelLimits(input.vessel);
  const vessels = scenarios.map((s) => ({ scenario: s, vessel: scenarioVessel(input.vessel, s) }));

  const rows: DepartureWindowRow[] = input.departures.map((departure) => {
    const context = retimeLegTimelineContext(input.context, departure);
    const runs = vessels.map(({ scenario, vessel }) => ({
      scenario,
      run: computeLegTimelineFromContext(context, input.passage, vessel),
    }));
    const outcomes = Object.fromEntries(
      runs.map(({ scenario, run }) => [scenario.key, summarizeRun(run, departure, scenario, dest)]),
    ) as Record<ScenarioKey, ScenarioOutcome>;

    const realisticRun = runs.find((r) => r.scenario.key === "realistic")?.run ?? runs[0].run;
    const realistic = outcomes.realistic ?? outcomes[runs[0].scenario.key];
    const worst = outcomes.pessimistic ?? realistic;
    const { verdict, reasons } = judge(realistic, worst, fuel);
    const wind = meanWind(realisticRun);
    const comfortScore = realisticRun.summary.overallComfortScore;
    const latestArrival = Math.max(...Object.values(outcomes).map((o) => Date.parse(o.arrival)));
    const beyondForecast = horizon != null && latestArrival > horizon;

    return {
      departure: departure.toISOString(),
      outcomes,
      meanWindKt: wind.kt,
      meanWindDirDeg: wind.dirDeg,
      comfortScore,
      verdict,
      reasons,
      dayFit: dayFitFor(realistic.hours, dayLimits),
      beyondForecast,
      score: scoreRow(realistic, comfortScore, verdict, beyondForecast),
      tags: [],
    };
  });

  tagRows(rows);

  return {
    rows,
    scenarios,
    dayLimits,
    forecastHorizon: horizon != null ? new Date(horizon).toISOString() : null,
    best: rows.find((r) => r.tags.includes("best-balance"))?.departure ?? null,
  };
}
