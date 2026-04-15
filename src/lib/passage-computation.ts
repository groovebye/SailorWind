import { createHash } from "node:crypto";
import { buildSeaRoute, type LatLon } from "@/lib/coastline";
import { getLegRoute } from "@/lib/leg-route";
import { fetchForecast, type ForecastEntry, type WeatherModel } from "@/lib/weather";
import { getTidePrediction, tideStateAt, type TidePrediction, type TidalStream } from "@/lib/tides";

type RoutePoint = { name: string; slug: string; lat: number; lon: number; coastlineNm: number; type: string };
type RouteWaypoint = { port: RoutePoint; isStop: boolean; isCape: boolean; sortOrder: number };
type PassageLike = {
  id: string;
  departure: Date;
  speed: number;
  mode: "daily" | "nonstop";
  model: string;
  waypoints: RouteWaypoint[];
};

type VesselPerformanceModel = {
  lightAirMotorThresholdKt: number;
  motorsailUpwindThresholdKt: number;
  closeHauledMinAngleDeg: number;
  efficientRunMinWindKt: number;
  reef1AtWindKt: number;
  reef2AtWindKt: number;
  reef1AtGustKt: number;
  reef2AtGustKt: number;
  harborApproachMotorRadiusNm: number;
};

type VesselLike = {
  id: string;
  slug: string;
  name: string;
  engineCruiseKt: number;
  engineMaxKt?: number | null;
  fuelBurnLph?: number | null;
  fuelTankLiters?: number | null;
  usableFuelLiters?: number | null;
  reserveFuelLiters?: number | null;
  motorsailBurnLph?: number | null;
  performanceModel: VesselPerformanceModel;
};

export type LegTimelineMode = "sail" | "motor" | "motorsail";
export type ComfortLabel = "Comfortable" | "Moderate" | "Bumpy" | "Demanding" | "Uncomfortable";

export interface TimelineEntry {
  hourIndex: number;
  time: string;
  lat: number;
  lon: number;
  distanceFromStartNm: number;
  distanceToGoNm: number;
  segmentName: string;
  courseTrue: number;
  boatHeading: number;
  windDir: string;
  windDirDeg: number;
  windKt: number;
  gustKt: number;
  waveM: number | null;
  wavePeriodS: number | null;
  swellM: number | null;
  swellPeriodS: number | null;
  currentDir: string | null;
  currentDirDeg: number | null;
  currentKt: number;
  twa: number;
  pointOfSail: string;
  mode: LegTimelineMode;
  tack: "port" | "starboard" | "none";
  sailConfig: string;
  reefLevel: 0 | 1 | 2;
  expectedBoatSpeedKt: number;
  expectedSogKt: number;
  comfortScore: number;
  comfort: ComfortLabel;
  warnings: string[];
  notes: string;
  // Fuel
  engineOn: boolean;
  fuelUsedThisHourL: number;
  cumulativeFuelUsedL: number;
}

export interface TimelineSummary {
  routeDistanceNm: number;
  computedDurationHours: number;
  estimatedArrival: string;
  dominantMode: string;
  sailHours: number;
  motorHours: number;
  motorsailHours: number;
  averageSogKt: number;
  maxWindKt: number;
  maxGustKt: number;
  maxWaveM: number;
  maxCurrentKt: number;
  overallComfortScore: number;
  overallComfort: ComfortLabel;
  worstSegment: string;
  hardestHour: string | null;
  comfortBySegment: Array<{ segment: string; comfort: ComfortLabel; reason: string }>;
  forecastSource: string;
  forecastModel: string;
  // Fuel
  fuelUsedL: number;
  fuelReserveAfterLegL: number | null;
  fuelMarginStatus: "ok" | "low" | "critical" | "unknown";
  engineHoursTotal: number;
}

export interface LegTimelineComputation {
  summary: TimelineSummary;
  timeline: TimelineEntry[];
  warnings: string[];
  forecastSignature: string;
  routeSignature: string;
  vesselSignature: string;
  validUntil: Date;
}

export interface LegTimelineContext {
  leg: {
    from: RouteWaypoint;
    to: RouteWaypoint;
    nm: number;
    departTime: Date;
    arriveTime: Date;
    hours: number;
  };
  legWaypoints: RouteWaypoint[];
  capes: RouteWaypoint[];
  routeGeometry: [number, number][];
  routeCumulative: number[];
  routeDistanceNm: number;
  forecasts: Record<string, ForecastEntry[]>;
  streamContexts: TideContext[];
  forecastSignature: string;
  routeSignature: string;
  vesselSignature: string;
}

type TideContext = {
  prediction: TidePrediction;
  stream: TidalStream;
  fraction: number;
  name: string;
};

const HALF_TIDE_HOURS = 6.2;
const PORT_AREA_NAMES = new Set(["Arrival", "Departure"]);

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function haversineNm(a: [number, number], b: [number, number]) {
  const rKm = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const km = 2 * rKm * Math.asin(Math.sqrt(h));
  return km * 0.539957;
}

function normalizeAngle(deg: number) {
  return ((deg % 360) + 360) % 360;
}

function bearing(from: [number, number], to: [number, number]) {
  const lat1 = toRad(from[0]);
  const lat2 = toRad(to[0]);
  const dLon = toRad(to[1] - from[1]);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return normalizeAngle((Math.atan2(y, x) * 180) / Math.PI);
}

function absoluteAngleDiff(a: number, b: number) {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return diff > 180 ? 360 - diff : diff;
}

function signedAngleDiff(a: number, b: number) {
  const diff = normalizeAngle(a - b);
  return diff > 180 ? diff - 360 : diff;
}

function directionToDegrees(direction: string | null): number | null {
  if (!direction) return null;
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  const idx = dirs.indexOf(direction.toUpperCase());
  return idx >= 0 ? idx * 22.5 : null;
}

function hashValue(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function buildLegs(passage: PassageLike) {
  const stops = passage.waypoints.filter((w) => w.isStop);
  const legs: Array<{
    from: RouteWaypoint;
    to: RouteWaypoint;
    nm: number;
    departTime: Date;
    arriveTime: Date;
    hours: number;
  }> = [];

  const depDate = new Date(passage.departure);
  let currentTime = depDate.getTime();
  const depHour = depDate.getUTCHours();

  for (let i = 0; i < stops.length - 1; i++) {
    const nm = stops[i + 1].port.coastlineNm - stops[i].port.coastlineNm;
    const hours = nm / passage.speed;
    const departTime = new Date(currentTime);
    const arriveTime = new Date(currentTime + hours * 3600000);
    legs.push({ from: stops[i], to: stops[i + 1], nm, departTime, arriveTime, hours });

    if (passage.mode === "daily" && i < stops.length - 2) {
      const nextDay = new Date(arriveTime);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      nextDay.setUTCHours(depHour, 0, 0, 0);
      if (nextDay.getTime() < arriveTime.getTime()) nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      currentTime = nextDay.getTime();
    } else {
      currentTime = arriveTime.getTime();
    }
  }

  return legs;
}

function classifyPointOfSail(twa: number) {
  if (twa < 35) return "Too close";
  if (twa < 55) return "Close-hauled";
  if (twa < 80) return "Close reach";
  if (twa < 115) return "Beam reach";
  if (twa < 150) return "Broad reach";
  return "Run";
}

function classifyComfort(score: number): ComfortLabel {
  if (score >= 85) return "Comfortable";
  if (score >= 70) return "Moderate";
  if (score >= 55) return "Bumpy";
  if (score >= 40) return "Demanding";
  return "Uncomfortable";
}

function comfortColorLabel(score: number) {
  return classifyComfort(score);
}

function closestForecast(entries: ForecastEntry[], time: Date) {
  let best: ForecastEntry | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const entry of entries) {
    const delta = Math.abs(new Date(entry.time).getTime() - time.getTime());
    if (delta < bestDelta) {
      best = entry;
      bestDelta = delta;
    }
  }
  return best;
}

function computeCurrentRate(prediction: TidePrediction, stream: TidalStream, time: Date) {
  const state = tideStateAt(prediction, time);
  const hoursToExtreme = state.rising ? state.hoursToHW : state.hoursToLW;
  const elapsedInHalfCycle = Math.max(0, HALF_TIDE_HOURS - Math.min(HALF_TIDE_HOURS, hoursToExtreme));
  const strengthFactor = Math.sin((elapsedInHalfCycle / HALF_TIDE_HOURS) * Math.PI);
  const maxRate = prediction.isSpring ? stream.springRate : stream.neapRate;
  return {
    dir: state.rising ? stream.floodDir : stream.ebbDir,
    rate: Math.max(0, maxRate * strengthFactor),
    state: state.description,
  };
}

function estimateSailSpeed(windKt: number, twa: number, waveM: number | null, gustKt: number, reefLevel: number) {
  const point = classifyPointOfSail(twa);
  let factor = 0.22;
  let cap = 5.6;

  switch (point) {
    case "Close-hauled":
      factor = 0.23;
      cap = 5.4;
      break;
    case "Close reach":
      factor = 0.28;
      cap = 6.0;
      break;
    case "Beam reach":
      factor = 0.32;
      cap = 6.4;
      break;
    case "Broad reach":
      factor = 0.29;
      cap = 6.1;
      break;
    case "Run":
      factor = 0.24;
      cap = 5.6;
      break;
    default:
      factor = 0.14;
      cap = 4.0;
      break;
  }

  let speed = Math.min(cap, Math.max(2.0, windKt * factor));
  if (windKt < 10) speed *= 0.8;
  if ((waveM ?? 0) > 2) speed -= 0.4;
  if ((waveM ?? 0) > 2.8) speed -= 0.5;
  if (gustKt - windKt > 10) speed -= 0.25;
  if (reefLevel === 1) speed -= 0.2;
  if (reefLevel === 2) speed -= 0.45;
  return Math.max(1.8, speed);
}

function determineReefLevel(model: VesselPerformanceModel, windKt: number, gustKt: number): 0 | 1 | 2 {
  if (windKt >= model.reef2AtWindKt || gustKt >= model.reef2AtGustKt) return 2;
  if (windKt >= model.reef1AtWindKt || gustKt >= model.reef1AtGustKt) return 1;
  return 0;
}

function determineMode(
  model: VesselPerformanceModel,
  windKt: number,
  twa: number,
  pointOfSail: string,
  distanceFromStartNm: number,
  distanceToGoNm: number,
) {
  const nearHarbor = distanceFromStartNm < model.harborApproachMotorRadiusNm || distanceToGoNm < model.harborApproachMotorRadiusNm;
  if (nearHarbor) return "motor" as const;
  if (windKt < model.lightAirMotorThresholdKt) return "motor" as const;
  if (twa < model.closeHauledMinAngleDeg) return windKt >= model.motorsailUpwindThresholdKt ? "motorsail" as const : "motor" as const;
  if (pointOfSail === "Close-hauled" && windKt >= model.motorsailUpwindThresholdKt) return "motorsail" as const;
  if ((pointOfSail === "Broad reach" || pointOfSail === "Run") && windKt < model.efficientRunMinWindKt) return "motorsail" as const;
  return "sail" as const;
}

function determineSailConfig(mode: LegTimelineMode, pointOfSail: string, reefLevel: 0 | 1 | 2, windKt: number) {
  if (mode === "motor") return "Engine only";
  if (mode === "motorsail") {
    if (reefLevel === 2) return "2 reefs + engine";
    if (reefLevel === 1) return "1 reef + engine";
    return "Main steadying sail + engine";
  }

  if (reefLevel === 2) {
    return pointOfSail === "Run" ? "2 reefs + reduced genoa" : "2 reefs + reduced headsail";
  }
  if (reefLevel === 1) {
    return pointOfSail === "Beam reach" ? "1 reef + genoa" : "1 reef + partially furled genoa";
  }
  if (windKt < 10) return "Full main + genoa";
  if (pointOfSail === "Run") return "Full main + genoa, preventer if needed";
  return "Full main + genoa";
}

function estimateComfortScore(params: {
  windKt: number;
  gustKt: number;
  waveM: number | null;
  swellM: number | null;
  mode: LegTimelineMode;
  pointOfSail: string;
  isCape: boolean;
  isArrival: boolean;
  isNight: boolean;
  currentKt: number;
}) {
  let score = 100;
  const reasons: string[] = [];
  const waveM = params.waveM ?? 0;
  const swellM = params.swellM ?? 0;
  const gustSpread = params.gustKt - params.windKt;

  if (waveM > 2.5) { score -= 22; reasons.push(`rough waves ${waveM.toFixed(1)}m`); }
  else if (waveM > 1.8) { score -= 12; reasons.push(`bumpy waves ${waveM.toFixed(1)}m`); }
  else if (waveM > 1.2) { score -= 6; reasons.push(`noticeable motion ${waveM.toFixed(1)}m`); }

  if (swellM > 2.0) { score -= 10; reasons.push(`rolling swell ${swellM.toFixed(1)}m`); }
  else if (swellM > 1.3) { score -= 4; reasons.push(`swell ${swellM.toFixed(1)}m`); }

  if (gustSpread > 14) { score -= 12; reasons.push(`gust spread +${Math.round(gustSpread)}kt`); }
  else if (gustSpread > 8) { score -= 6; reasons.push(`gusty +${Math.round(gustSpread)}kt`); }

  if (params.pointOfSail === "Close-hauled") { score -= 10; reasons.push("close-hauled load"); }
  if (params.pointOfSail === "Too close") { score -= 18; reasons.push("too tight to wind"); }
  if (params.mode === "motor" && waveM > 1.5) { score -= 5; reasons.push("motoring in chop"); }
  if (params.isCape) { score -= 10; reasons.push("cape acceleration zone"); }
  if (params.isArrival) { score -= 4; reasons.push("harbor entry focus"); }
  if (params.isNight) { score -= 10; reasons.push("night / low-light"); }
  if (params.currentKt > 1.2) { score -= 4; reasons.push(`current ${params.currentKt.toFixed(1)}kt`); }

  score = Math.max(0, Math.min(100, score));
  return { score, label: classifyComfort(score), reasons };
}

function signedSide(windFromDeg: number, courseDeg: number): "port" | "starboard" | "none" {
  const signed = signedAngleDiff(windFromDeg, courseDeg);
  if (Math.abs(signed) < 10) return "none";
  return signed > 0 ? "starboard" : "port";
}

function positionAtDistance(route: [number, number][], cumulativeNm: number[], targetNm: number): [number, number] {
  if (route.length === 0) return [0, 0];
  if (targetNm <= 0) return route[0];
  const total = cumulativeNm[cumulativeNm.length - 1] ?? 0;
  if (targetNm >= total) return route[route.length - 1];

  for (let i = 1; i < cumulativeNm.length; i++) {
    if (cumulativeNm[i] >= targetNm) {
      const prev = cumulativeNm[i - 1];
      const next = cumulativeNm[i];
      const ratio = next === prev ? 0 : (targetNm - prev) / (next - prev);
      const [lat1, lon1] = route[i - 1];
      const [lat2, lon2] = route[i];
      return [lat1 + (lat2 - lat1) * ratio, lon1 + (lon2 - lon1) * ratio];
    }
  }
  return route[route.length - 1];
}

function buildCumulativeRoute(route: [number, number][]) {
  const cumulative = [0];
  for (let i = 1; i < route.length; i++) {
    cumulative.push(cumulative[i - 1] + haversineNm(route[i - 1], route[i]));
  }
  return cumulative;
}

function pickSegmentName(fraction: number, remainingNm: number, capes: RouteWaypoint[], from: RouteWaypoint, to: RouteWaypoint) {
  if (fraction < 0.08) return `Departure ${from.port.name}`;
  if (remainingNm < 2) return `Arrival ${to.port.name}`;
  for (const cape of capes) {
    const capeFraction = (cape.port.coastlineNm - from.port.coastlineNm) / (to.port.coastlineNm - from.port.coastlineNm || 1);
    if (Math.abs(fraction - capeFraction) < 0.12) return `${cape.port.name} rounding`;
  }
  return `Offshore ${from.port.name} → ${to.port.name}`;
}

function uniqueWarnings(entries: TimelineEntry[]) {
  const warnings = new Set<string>();
  for (const entry of entries) {
    entry.warnings.forEach((warning) => warnings.add(warning));
  }
  return [...warnings];
}

function buildTimelineNote(mode: LegTimelineMode, pointOfSail: string, comfort: ComfortLabel, warnings: string[]) {
  const modeText =
    mode === "motor" ? "Motor likely" :
    mode === "motorsail" ? "Motor-sail likely" :
    "Sailing likely";
  const comfortText =
    comfort === "Comfortable" ? "should feel settled" :
    comfort === "Moderate" ? "some motion expected" :
    comfort === "Bumpy" ? "noticeably lively ride" :
    comfort === "Demanding" ? "crew workload rises" :
    "hard work for crew and boat";
  const warningText = warnings.length > 0 ? ` Watch for ${warnings.slice(0, 2).join(", ")}.` : "";
  return `${modeText} on a ${pointOfSail.toLowerCase()}, ${comfortText}.${warningText}`;
}

function buildSummary(
  timeline: TimelineEntry[],
  routeDistanceNm: number,
  estimatedArrival: Date,
  forecastModel: string,
  vessel: VesselLike,
) : TimelineSummary {
  // Compute cumulative fuel
  let cumulativeFuel = 0;
  for (const entry of timeline) {
    cumulativeFuel += entry.fuelUsedThisHourL;
    entry.cumulativeFuelUsedL = Math.round(cumulativeFuel * 10) / 10;
  }

  const sailHours = timeline.filter((entry) => entry.mode === "sail").length;
  const motorHours = timeline.filter((entry) => entry.mode === "motor").length;
  const motorsailHours = timeline.filter((entry) => entry.mode === "motorsail").length;
  const maxWindKt = Math.max(...timeline.map((entry) => entry.windKt), 0);
  const maxGustKt = Math.max(...timeline.map((entry) => entry.gustKt), 0);
  const maxWaveM = Math.max(...timeline.map((entry) => entry.waveM ?? 0), 0);
  const maxCurrentKt = Math.max(...timeline.map((entry) => entry.currentKt), 0);
  const averageSogKt = timeline.length > 0 ? timeline.reduce((sum, entry) => sum + entry.expectedSogKt, 0) / timeline.length : 0;
  const overallComfortScore = timeline.length > 0 ? timeline.reduce((sum, entry) => sum + entry.comfortScore, 0) / timeline.length : 0;
  const overallComfort = comfortColorLabel(overallComfortScore);
  const worstEntry = [...timeline].sort((a, b) => a.comfortScore - b.comfortScore)[0];

  const comfortBySegment = Array.from(
    timeline.reduce((map, entry) => {
      if (PORT_AREA_NAMES.has(entry.segmentName)) return map;
      const current = map.get(entry.segmentName) ?? { scores: [] as number[], reasons: [] as string[] };
      current.scores.push(entry.comfortScore);
      current.reasons.push(...entry.warnings);
      map.set(entry.segmentName, current);
      return map;
    }, new Map<string, { scores: number[]; reasons: string[] }>())
  ).map(([segment, data]) => {
    const avgScore = data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length;
    return {
      segment,
      comfort: classifyComfort(avgScore),
      reason: data.reasons[0] ?? "Stable conditions",
    };
  });

  return {
    routeDistanceNm: Math.round(routeDistanceNm * 10) / 10,
    computedDurationHours: Math.round(timeline.length * 10) / 10,
    estimatedArrival: estimatedArrival.toISOString(),
    dominantMode:
      sailHours >= motorHours && sailHours >= motorsailHours ? "Mostly sail" :
      motorHours >= motorsailHours ? "Mostly motor" :
      "Mixed / motor-sail",
    sailHours,
    motorHours,
    motorsailHours,
    averageSogKt: Math.round(averageSogKt * 10) / 10,
    maxWindKt: Math.round(maxWindKt),
    maxGustKt: Math.round(maxGustKt),
    maxWaveM: Math.round(maxWaveM * 10) / 10,
    maxCurrentKt: Math.round(maxCurrentKt * 10) / 10,
    overallComfortScore: Math.round(overallComfortScore),
    overallComfort,
    worstSegment: worstEntry?.segmentName ?? "N/A",
    hardestHour: worstEntry?.time ?? null,
    comfortBySegment,
    forecastSource: "Open-Meteo + static tide model",
    forecastModel,
    // Fuel
    fuelUsedL: Math.round(cumulativeFuel * 10) / 10,
    fuelReserveAfterLegL: vessel.usableFuelLiters != null ? Math.round((vessel.usableFuelLiters - cumulativeFuel) * 10) / 10 : null,
    fuelMarginStatus: vessel.usableFuelLiters == null ? "unknown" :
      (vessel.usableFuelLiters - cumulativeFuel) > (vessel.reserveFuelLiters ?? 10) ? "ok" :
      (vessel.usableFuelLiters - cumulativeFuel) > 0 ? "low" : "critical",
    engineHoursTotal: motorHours + motorsailHours,
  };
}

function collectForecastsHash(forecasts: Record<string, ForecastEntry[]>) {
  const compact = Object.fromEntries(
    Object.entries(forecasts).map(([name, entries]) => [
      name,
      entries.slice(0, 12).map((entry) => [
        entry.time,
        Math.round(entry.windKt),
        Math.round(entry.gustKt),
        entry.waveM,
        entry.swellM,
      ]),
    ])
  );
  return hashValue(compact);
}

function buildStreamContexts(from: RouteWaypoint, to: RouteWaypoint, capes: RouteWaypoint[], time: Date) {
  const refs = [
    { waypoint: from, fraction: 0, name: `Departure ${from.port.name}` },
    ...capes.map((cape) => ({
      waypoint: cape,
      fraction: (cape.port.coastlineNm - from.port.coastlineNm) / (to.port.coastlineNm - from.port.coastlineNm || 1),
      name: cape.port.name,
    })),
    { waypoint: to, fraction: 1, name: `Arrival ${to.port.name}` },
  ];

  return refs.flatMap((ref) => {
    const prediction = getTidePrediction(ref.waypoint.port.slug, time, 2);
    if (!prediction?.nearestStream) return [];
    return [{
      prediction,
      stream: prediction.nearestStream,
      fraction: ref.fraction,
      name: ref.name,
    } satisfies TideContext];
  });
}

function nearestStreamContext(streams: TideContext[], fraction: number) {
  let best: TideContext | null = null;
  let delta = Number.POSITIVE_INFINITY;
  for (const stream of streams) {
    const nextDelta = Math.abs(stream.fraction - fraction);
    if (nextDelta < delta) {
      best = stream;
      delta = nextDelta;
    }
  }
  return delta <= 0.35 ? best : null;
}

export async function resolveLegTimelineContext(
  passage: PassageLike,
  legIndex: number,
  vessel: VesselLike,
): Promise<LegTimelineContext> {
  const legs = buildLegs(passage);
  const leg = legs[legIndex];
  if (!leg) {
    throw new Error(`Leg ${legIndex} not found`);
  }

  const legWaypoints = passage.waypoints.filter(
    (waypoint) =>
      waypoint.port.coastlineNm >= leg.from.port.coastlineNm - 0.1 &&
      waypoint.port.coastlineNm <= leg.to.port.coastlineNm + 0.1
  );
  const capes = legWaypoints.filter((waypoint) => waypoint.isCape);

  const routeAnchors = [
    { name: leg.from.port.name, lat: leg.from.port.lat, lon: leg.from.port.lon },
    ...capes.map((cape) => ({
      name: `${cape.port.name} Rounding`,
      lat: cape.port.lat,
      lon: cape.port.lon,
    })),
    { name: leg.to.port.name, lat: leg.to.port.lat, lon: leg.to.port.lon },
  ];

  // Check for manual route override
  const manualRoute = await getLegRoute(
    passage.id, legIndex,
    { name: leg.from.port.name, lat: leg.from.port.lat, lon: leg.from.port.lon },
    { name: leg.to.port.name, lat: leg.to.port.lat, lon: leg.to.port.lon },
  );

  let routeGeometry: LatLon[];
  if (manualRoute.mode === "manual") {
    routeGeometry = manualRoute.points.map(p => [p.lat, p.lon] as LatLon);
  } else {
    routeGeometry = routeAnchors.flatMap((anchor, index) => {
      if (index === routeAnchors.length - 1) return [];
      const segment = buildSeaRoute(anchor, routeAnchors[index + 1]);
      return index === 0 ? segment : segment.slice(1);
    });
  }

  const routeCumulative = buildCumulativeRoute(routeGeometry);
  const routeDistanceNm = routeCumulative[routeCumulative.length - 1] ?? leg.nm;

  const forecasts = Object.fromEntries(
    await Promise.all(
      legWaypoints.map(async (waypoint) => [
        waypoint.port.slug,
        await fetchForecast(
          waypoint.port.lat,
          waypoint.port.lon,
          passage.model as WeatherModel,
          waypoint.isCape,
          false
        ),
      ])
    )
  );

  const streamContexts = buildStreamContexts(leg.from, leg.to, capes, leg.departTime);
  const forecastSignature = collectForecastsHash(forecasts);
  const routeSignature = hashValue({
    routeAnchors,
    routeDistanceNm: Math.round(routeDistanceNm * 100) / 100,
    departure: leg.departTime.toISOString(),
    passageSpeed: passage.speed,
    mode: passage.mode,
  });
  const vesselSignature = hashValue({
    slug: vessel.slug,
    engineCruiseKt: vessel.engineCruiseKt,
    engineMaxKt: vessel.engineMaxKt,
    performanceModel: vessel.performanceModel,
  });

  return {
    leg,
    legWaypoints,
    capes,
    routeGeometry,
    routeCumulative,
    routeDistanceNm,
    forecasts,
    streamContexts,
    forecastSignature,
    routeSignature,
    vesselSignature,
  };
}

export function computeLegTimelineFromContext(
  context: LegTimelineContext,
  passage: PassageLike,
  vessel: VesselLike,
): LegTimelineComputation {
  const { leg, legWaypoints, capes, routeGeometry, routeCumulative, routeDistanceNm, forecasts, streamContexts } = context;
  const timeline: TimelineEntry[] = [];
  let elapsedHours = 0;
  let distanceFromStartNm = 0;
  let guard = 0;

  while (distanceFromStartNm < routeDistanceNm - 0.1 && guard < 72) {
    const sampleTime = new Date(leg.departTime.getTime() + elapsedHours * 3600000);
    const position = positionAtDistance(routeGeometry, routeCumulative, distanceFromStartNm);
    const ahead = positionAtDistance(routeGeometry, routeCumulative, Math.min(routeDistanceNm, distanceFromStartNm + 0.5));
    const courseTrue = bearing(position, ahead);
    const fraction = routeDistanceNm > 0 ? distanceFromStartNm / routeDistanceNm : 0;
    const nearestWaypoint = legWaypoints.reduce((best, waypoint) => {
      const waypointFraction = (waypoint.port.coastlineNm - leg.from.port.coastlineNm) / (leg.to.port.coastlineNm - leg.from.port.coastlineNm || 1);
      if (!best) return waypoint;
      const bestFraction = (best.port.coastlineNm - leg.from.port.coastlineNm) / (leg.to.port.coastlineNm - leg.from.port.coastlineNm || 1);
      return Math.abs(waypointFraction - fraction) < Math.abs(bestFraction - fraction) ? waypoint : best;
    }, legWaypoints[0]);

    const forecastEntry = closestForecast(forecasts[nearestWaypoint.port.slug] ?? [], sampleTime);
    if (!forecastEntry) {
      throw new Error(`Missing forecast for ${nearestWaypoint.port.name}`);
    }

    const twa = absoluteAngleDiff(forecastEntry.windDirDeg, courseTrue);
    const pointOfSail = classifyPointOfSail(twa);
    const reefLevel = determineReefLevel(vessel.performanceModel, forecastEntry.windKt, forecastEntry.gustKt);
    const mode = determineMode(
      vessel.performanceModel,
      forecastEntry.windKt,
      twa,
      pointOfSail,
      distanceFromStartNm,
      routeDistanceNm - distanceFromStartNm
    );
    const baseSailSpeed = estimateSailSpeed(forecastEntry.windKt, twa, forecastEntry.waveM, forecastEntry.gustKt, reefLevel);
    const expectedBoatSpeedKt =
      mode === "motor" ? (distanceFromStartNm < vessel.performanceModel.harborApproachMotorRadiusNm || routeDistanceNm - distanceFromStartNm < vessel.performanceModel.harborApproachMotorRadiusNm ? Math.max(4.8, vessel.engineCruiseKt - 0.5) : vessel.engineCruiseKt) :
      mode === "motorsail" ? Math.min(vessel.engineCruiseKt + 0.2, Math.max(vessel.engineCruiseKt * 0.9, baseSailSpeed + 0.7)) :
      baseSailSpeed;

    const streamContext = nearestStreamContext(streamContexts, fraction);
    const currentState = streamContext ? computeCurrentRate(streamContext.prediction, streamContext.stream, sampleTime) : null;
    const currentDirDeg = currentState ? directionToDegrees(currentState.dir) : null;
    const currentAlongTrack =
      currentState && currentDirDeg !== null
        ? currentState.rate * Math.cos(toRad(absoluteAngleDiff(currentDirDeg, courseTrue)))
        : 0;
    let expectedSogKt = Math.max(1.5, expectedBoatSpeedKt + currentAlongTrack);

    // If SOG drops below 4.5kt under sail, switch to motor — Bossanova rule
    let actualMode = mode;
    if (actualMode === "sail" && expectedSogKt < 4.5) {
      actualMode = "motor";
      expectedSogKt = vessel.engineCruiseKt;
    } else if (actualMode === "motorsail" && expectedSogKt < 4.5) {
      actualMode = "motor";
      expectedSogKt = vessel.engineCruiseKt;
    }

    const isNight = sampleTime.getUTCHours() >= 20 || sampleTime.getUTCHours() < 6;
    const segmentName = pickSegmentName(fraction, routeDistanceNm - distanceFromStartNm, capes, leg.from, leg.to);
    const comfort = estimateComfortScore({
      windKt: forecastEntry.windKt,
      gustKt: forecastEntry.gustKt,
      waveM: forecastEntry.waveM,
      swellM: forecastEntry.swellM,
      mode: actualMode,
      pointOfSail,
      isCape: segmentName.includes("rounding"),
      isArrival: segmentName.startsWith("Arrival"),
      isNight,
      currentKt: currentState?.rate ?? 0,
    });

    const warnings: string[] = [];
    if (forecastEntry.gustKt > 22) warnings.push("gusty");
    if ((forecastEntry.waveM ?? 0) > 1.8) warnings.push("rougher sea");
    if (segmentName.includes("rounding")) warnings.push("cape acceleration");
    if (actualMode !== "sail") warnings.push(actualMode === "motor" ? "engine likely" : "motor-sail likely");
    if (reefLevel > 0) warnings.push(`reef ${reefLevel} likely`);
    if (isNight) warnings.push("low-light");
    if (segmentName.startsWith("Arrival")) warnings.push("prepare harbor entry");
    if ((currentState?.rate ?? 0) > 1.2) warnings.push("strong current");

    timeline.push({
      hourIndex: guard,
      time: sampleTime.toISOString(),
      lat: Math.round(position[0] * 10000) / 10000,
      lon: Math.round(position[1] * 10000) / 10000,
      distanceFromStartNm: Math.round(distanceFromStartNm * 10) / 10,
      distanceToGoNm: Math.max(0, Math.round((routeDistanceNm - distanceFromStartNm) * 10) / 10),
      segmentName,
      courseTrue: Math.round(courseTrue),
      boatHeading: Math.round(courseTrue),
      windDir: forecastEntry.windDir,
      windDirDeg: forecastEntry.windDirDeg,
      windKt: Math.round(forecastEntry.windKt * 10) / 10,
      gustKt: Math.round(forecastEntry.gustKt * 10) / 10,
      waveM: forecastEntry.waveM !== null ? Math.round(forecastEntry.waveM * 10) / 10 : null,
      wavePeriodS: forecastEntry.wavePeriodS !== null ? Math.round(forecastEntry.wavePeriodS * 10) / 10 : null,
      swellM: forecastEntry.swellM !== null ? Math.round(forecastEntry.swellM * 10) / 10 : null,
      swellPeriodS: forecastEntry.swellPeriodS !== null ? Math.round(forecastEntry.swellPeriodS * 10) / 10 : null,
      currentDir: currentState?.dir ?? null,
      currentDirDeg,
      currentKt: Math.round((currentState?.rate ?? 0) * 10) / 10,
      twa: Math.round(twa),
      pointOfSail,
      mode: actualMode,
      tack: actualMode === "motor" ? "none" : signedSide(forecastEntry.windDirDeg, courseTrue),
      sailConfig: determineSailConfig(actualMode, pointOfSail, reefLevel, forecastEntry.windKt),
      reefLevel,
      expectedBoatSpeedKt: Math.round(expectedBoatSpeedKt * 10) / 10,
      expectedSogKt: Math.round(expectedSogKt * 10) / 10,
      comfortScore: comfort.score,
      comfort: comfort.label,
      warnings,
      notes: buildTimelineNote(mode, pointOfSail, comfort.label, warnings),
      // Fuel
      engineOn: actualMode === "motor" || actualMode === "motorsail",
      fuelUsedThisHourL: actualMode === "motor" ? (vessel.fuelBurnLph ?? 3.0) : actualMode === "motorsail" ? (vessel.motorsailBurnLph ?? vessel.fuelBurnLph ?? 2.0) * 0.7 : 0,
      cumulativeFuelUsedL: 0, // computed below
    });

    distanceFromStartNm += expectedSogKt;
    elapsedHours += 1;
    guard += 1;
  }

  const estimatedArrival = new Date(leg.departTime.getTime() + timeline.length * 3600000);
  const summary = buildSummary(timeline, routeDistanceNm, estimatedArrival, passage.model, vessel);
  const warnings = uniqueWarnings(timeline);

  return {
    summary,
    timeline,
    warnings,
    forecastSignature: context.forecastSignature,
    routeSignature: context.routeSignature,
    vesselSignature: context.vesselSignature,
    validUntil: new Date(Date.now() + 3 * 3600000),
  };
}

export async function computeLegTimeline(
  passage: PassageLike,
  legIndex: number,
  vessel: VesselLike,
): Promise<LegTimelineComputation> {
  const context = await resolveLegTimelineContext(passage, legIndex, vessel);
  return computeLegTimelineFromContext(context, passage, vessel);
}
