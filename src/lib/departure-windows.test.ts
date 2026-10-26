import { describe, it, expect, vi } from "vitest";

// The engine module imports the DB-backed route helper; these tests only use
// the pure context → timeline path, so stub it out (no Prisma client needed).
vi.mock("@/lib/leg-route", () => ({ getLegRoute: vi.fn() }));

import {
  computeDepartureWindows,
  departureCandidates,
  nextAlignedSlot,
  scenarioVessel,
  PLANNING_SCENARIOS,
} from "@/lib/departure-windows";
import { buildForecastSamples, computeLegTimelineFromContext, type LegTimelineContext, type PassageLike, type VesselLike } from "@/lib/passage-computation";
import type { ForecastEntry } from "@/lib/weather";
import { buildCumulativeRoute, type LatLon } from "@/lib/geo";

const H = 3_600_000;
const T0 = Date.parse("2026-10-27T00:00:00Z");

type Wx = { windKt: number; windDirDeg: number; gustKt?: number; waveM?: number };

function series(start: number, hours: number, wx: (t: number) => Wx): ForecastEntry[] {
  return Array.from({ length: hours }, (_, i) => {
    const t = start + i * H;
    const w = wx(t);
    return {
      time: new Date(t).toISOString(),
      windKt: w.windKt, windDirDeg: w.windDirDeg, windDir: "N", beaufort: "F3",
      gustKt: w.gustKt ?? w.windKt + 4,
      waveM: w.waveM ?? 1.0, wavePeriodS: 9, waveDirDeg: 315, waveDir: "NW",
      swellM: w.waveM ?? 1.0, swellPeriodS: 11, swellDirDeg: 315, swellDir: "NW",
      precipMm: 0, cloudPct: 20, weather: "sun", verdict: "GO",
    };
  });
}

/** Straight N→S leg offshore of Portugal, `nm` long, ending near Cascais' latitude. */
function makeContext(nm: number, wx: (t: number) => Wx, forecastHours = 240): LegTimelineContext {
  const endLat = 38.7;
  const startLat = endLat + nm / 60;
  const from = { port: { name: "North", slug: "test-north", lat: startLat, lon: -9.6, coastlineNm: 0, type: "port" }, isStop: true, isCape: false, sortOrder: 0 };
  const to = { port: { name: "South", slug: "test-south", lat: endLat, lon: -9.6, coastlineNm: nm, type: "port" }, isStop: true, isCape: false, sortOrder: 1 };
  const routeGeometry: LatLon[] = [[startLat, -9.6], [endLat, -9.6]];
  const routeCumulative = buildCumulativeRoute(routeGeometry);
  const forecast = series(T0 - 24 * H, forecastHours, wx);
  return {
    leg: { from, to, nm, departTime: new Date(T0), arriveTime: new Date(T0 + (nm / 5) * H), hours: nm / 5 },
    legWaypoints: [from, to],
    capes: [],
    routeGeometry,
    routeCumulative,
    routeDistanceNm: routeCumulative[routeCumulative.length - 1],
    forecasts: { "test-north": forecast, "test-south": forecast },
    streamContexts: [],
    forecastSignature: "f",
    routeSignature: "r",
    vesselSignature: "v",
  };
}

const passage: PassageLike = {
  id: "p1", departure: new Date(T0), speed: 5, mode: "nonstop", model: "test", waypoints: [],
};

// Bossanova as seeded (prisma/seed.ts): assumed polars, Volvo D1-30 burn figures.
const vessel: VesselLike = {
  id: "v1", slug: "bossanova", name: "Bossanova",
  engineCruiseKt: 6.2, fuelBurnLph: 2.5, motorsailBurnLph: 1.75, usableFuelLiters: 55, reserveFuelLiters: 10,
  performanceModel: {
    lightAirMotorThresholdKt: 7, motorsailUpwindThresholdKt: 12, closeHauledMinAngleDeg: 38, efficientRunMinWindKt: 10,
    reef1AtWindKt: 18, reef2AtWindKt: 24, reef1AtGustKt: 22, reef2AtGustKt: 28, harborApproachMotorRadiusNm: 1.2,
    minimumSailingSpeedKt: 3.5, lowEfficiencyThresholdPct: 40, motorsailEfficiencyThresholdPct: 55,
    polarData: {
      twsKnots: [6, 8, 10, 12, 16, 20, 25],
      twaDegrees: [40, 50, 60, 75, 90, 110, 135, 150, 165],
      boatSpeeds: [
        [2.1, 2.8, 3.4, 3.9, 4.4, 4.6, 4.2],
        [2.6, 3.4, 4.2, 4.7, 5.2, 5.3, 4.8],
        [3.0, 3.9, 4.7, 5.3, 5.7, 5.8, 5.3],
        [3.3, 4.2, 5.1, 5.6, 6.0, 6.1, 5.6],
        [3.5, 4.5, 5.4, 5.9, 6.3, 6.3, 5.8],
        [3.3, 4.3, 5.2, 5.7, 6.1, 6.2, 5.7],
        [3.0, 3.9, 4.8, 5.3, 5.8, 5.9, 5.4],
        [2.6, 3.5, 4.3, 4.9, 5.4, 5.5, 5.0],
        [2.2, 3.0, 3.8, 4.4, 4.9, 5.0, 4.5],
      ],
      hullSpeedKt: 6.3, targetUpwindTwaDeg: 42, targetDownwindTwaDeg: 155,
    },
  },
};

const nortada: Wx = { windKt: 15, windDirDeg: 330 }; // N–NW breeze: broad reach on a southbound leg
const calm: Wx = { windKt: 4, windDirDeg: 0 };

describe("departure candidates", () => {
  it("spaces departures by the step", () => {
    const d = departureCandidates(new Date(T0), 4, 6).map((x) => x.toISOString());
    expect(d).toEqual(["2026-10-27T00:00:00.000Z", "2026-10-27T06:00:00.000Z", "2026-10-27T12:00:00.000Z", "2026-10-27T18:00:00.000Z"]);
  });

  it("aligns the default start to the next whole step in UTC", () => {
    expect(nextAlignedSlot(new Date("2026-10-26T19:16:00Z"), 6).toISOString()).toBe("2026-10-27T00:00:00.000Z");
    expect(nextAlignedSlot(new Date("2026-10-26T12:00:00Z"), 6).toISOString()).toBe("2026-10-26T18:00:00.000Z");
  });
});

describe("scenarioVessel", () => {
  it("scales polar and engine without mutating the profile", () => {
    const pess = scenarioVessel(vessel, PLANNING_SCENARIOS.find((s) => s.key === "pessimistic")!);
    expect(pess.engineCruiseKt).toBeCloseTo(5.58, 2);
    expect(pess.performanceModel.polarData!.boatSpeeds[4][4]).toBeCloseTo(6.3 * 0.85, 5);
    expect(vessel.performanceModel.polarData!.boatSpeeds[4][4]).toBe(6.3);
    expect(vessel.engineCruiseKt).toBe(6.2);
  });
});

describe("computeDepartureWindows", () => {
  it("in a sailing breeze, arrivals order optimistic ≤ realistic ≤ pessimistic", () => {
    const res = computeDepartureWindows({
      context: makeContext(120, () => nortada), passage, vessel,
      departures: departureCandidates(new Date(T0), 3, 6),
    });
    expect(res.rows).toHaveLength(3);
    for (const row of res.rows) {
      const { optimistic, realistic, pessimistic } = row.outcomes;
      expect(Date.parse(optimistic.arrival)).toBeLessThanOrEqual(Date.parse(realistic.arrival));
      expect(Date.parse(realistic.arrival)).toBeLessThanOrEqual(Date.parse(pessimistic.arrival));
      // Broad reach in 15 kn on assumed polars: ~5–6 kn, so ~20–24 h for 120 NM.
      expect(realistic.hours).toBeGreaterThan(18);
      expect(realistic.hours).toBeLessThan(26);
      expect(row.dayFit).toBe("overnight");
    }
  });

  it("in marginal wind the optimistic boat sails instead of motoring — less engine, later arrival", () => {
    // 10 kn NW: realistic polar ~4.8 kn sails; at 9 kn the realistic boat drops under the
    // SOG 4.5 kn rule and motors at 6.2 kn, while the +10 % optimistic boat keeps sailing.
    const res = computeDepartureWindows({
      context: makeContext(60, () => ({ windKt: 9, windDirDeg: 315 })), passage, vessel, departures: [new Date(T0)],
    });
    const { optimistic, realistic } = res.rows[0].outcomes;
    expect(optimistic.motoringPct).toBeLessThan(realistic.motoringPct);
    expect(Date.parse(optimistic.arrival)).toBeGreaterThan(Date.parse(realistic.arrival));
  });

  it("re-times each run to its own departure", () => {
    const deps = departureCandidates(new Date(T0), 2, 12);
    const res = computeDepartureWindows({ context: makeContext(60, () => nortada), passage, vessel, departures: deps });
    expect(res.rows.map((r) => r.departure)).toEqual(deps.map((d) => d.toISOString()));
    const [a, b] = res.rows.map((r) => Date.parse(r.outcomes.realistic.arrival));
    expect(b - a).toBeCloseTo(12 * H, -5);
  });

  it("uses a fractional last hour instead of rounding arrival up", () => {
    const res = computeDepartureWindows({ context: makeContext(61, () => calm), passage, vessel, departures: [new Date(T0)] });
    const hours = res.rows[0].outcomes.realistic.hours;
    expect(Number.isInteger(hours)).toBe(false);
  });

  it("calm air means the engine all the way, with fuel to match", () => {
    const res = computeDepartureWindows({ context: makeContext(60, () => calm), passage, vessel, departures: [new Date(T0)] });
    const r = res.rows[0].outcomes.realistic;
    expect(r.motoringPct).toBe(100);
    expect(r.fuelL).toBeCloseTo(r.hours * 2.5, 0); // 2.5 L/h at 2500 rpm, whole way
    expect(res.rows[0].outcomes.pessimistic.hours).toBeGreaterThan(r.hours); // slower engine
  });

  it("a slower boat motors more (pessimistic falls below the SOG 4.5 kn rule)", () => {
    // 10 kn NW on a southbound leg: TWA 135°, polar 4.8 kn → ×0.85 = 4.1 kn → engine.
    const res = computeDepartureWindows({
      context: makeContext(80, () => ({ windKt: 10, windDirDeg: 315 })), passage, vessel, departures: [new Date(T0)],
    });
    const { pessimistic, realistic } = res.rows[0].outcomes;
    expect(pessimistic.motoringPct).toBeGreaterThan(realistic.motoringPct);
    expect(pessimistic.fuelL).toBeGreaterThan(realistic.fuelL);
  });

  it("flags daylight vs after-dark arrival at the destination", () => {
    // ~62 NM under engine ≈ 10 h. Cascais latitude, late Oct: sunrise ~07:00, sunset ~17:40 UTC.
    const res = computeDepartureWindows({
      context: makeContext(62, () => calm), passage, vessel,
      departures: [new Date(T0 + 6 * H), new Date(T0 + 12 * H)],
    });
    const [morning, noon] = res.rows;
    expect(morning.outcomes.realistic.arrivalDaylight).toBe(true);
    expect(morning.outcomes.realistic.minutesBeforeSunset).toBeGreaterThan(0);
    expect(noon.outcomes.realistic.arrivalDaylight).toBe(false);
    expect(noon.outcomes.realistic.minutesBeforeSunset).toBeLessThan(0);
    expect(noon.outcomes.realistic.nightHours).toBeGreaterThan(morning.outcomes.realistic.nightHours);
    expect(morning.dayFit).toBe("long-day");
  });

  it("classifies a short hop as a day sail", () => {
    const res = computeDepartureWindows({ context: makeContext(40, () => nortada), passage, vessel, departures: [new Date(T0 + 8 * H)] });
    expect(res.rows[0].dayFit).toBe("day");
  });

  it("pessimistic envelope raises CAUTION: 2.4 m forecast + 15 % margin", () => {
    const res = computeDepartureWindows({
      context: makeContext(40, () => ({ ...nortada, waveM: 2.4 })), passage, vessel, departures: [new Date(T0)],
    });
    const row = res.rows[0];
    expect(row.outcomes.realistic.maxWaveM).toBe(2.4);
    expect(row.outcomes.pessimistic.maxWaveM).toBe(2.8);
    expect(row.verdict).toBe("CAUTION");
    expect(row.reasons).toContain("sea to 2.8 m (pessimistic)");
  });

  it("but only the realistic run can make it NO-GO (3.3 m swell is CAUTION, not NO-GO)", () => {
    const res = computeDepartureWindows({
      context: makeContext(40, () => ({ ...nortada, waveM: 3.3 })), passage, vessel, departures: [new Date(T0)],
    });
    expect(res.rows[0].outcomes.pessimistic.maxWaveM).toBe(3.8);
    expect(res.rows[0].verdict).toBe("CAUTION");
    expect(res.rows[0].reasons).toContain("sea to 3.3 m");
  });

  it("NO-GO in a gale, and never tagged best", () => {
    const stormFirstDay = (t: number): Wx => (t < T0 + 24 * H ? { windKt: 32, windDirDeg: 330, gustKt: 42, waveM: 4 } : nortada);
    const res = computeDepartureWindows({
      context: makeContext(40, stormFirstDay), passage, vessel,
      departures: [new Date(T0), new Date(T0 + 30 * H)],
    });
    expect(res.rows[0].verdict).toBe("NO-GO");
    expect(res.rows[0].tags).not.toContain("best-balance");
    expect(res.best).toBe(res.rows[1].departure);
  });

  it("tags the window with the least engine time", () => {
    const calmThenBreeze = (t: number): Wx => (t < T0 + 24 * H ? calm : nortada);
    const res = computeDepartureWindows({
      context: makeContext(60, calmThenBreeze), passage, vessel,
      departures: [new Date(T0 + 6 * H), new Date(T0 + 30 * H)],
    });
    expect(res.rows[1].tags).toContain("least-motoring");
    expect(res.rows[1].outcomes.realistic.motoringPct).toBeLessThan(res.rows[0].outcomes.realistic.motoringPct);
  });

  it("marks arrivals past the forecast horizon as low confidence", () => {
    // Forecast runs T0−24h … T0+12h; a 120 NM leg leaving at T0 arrives well after.
    const res = computeDepartureWindows({ context: makeContext(120, () => nortada, 36), passage, vessel, departures: [new Date(T0)] });
    expect(res.forecastHorizon).toBe(new Date(T0 + 11 * H).toISOString());
    expect(res.rows[0].beyondForecast).toBe(true);
  });

  it("reports the resultant mean wind direction", () => {
    const res = computeDepartureWindows({ context: makeContext(40, () => nortada), passage, vessel, departures: [new Date(T0)] });
    expect(res.rows[0].meanWindDirDeg).toBe(330);
    expect(res.rows[0].meanWindKt).toBe(15);
  });
});

describe("forecast samples along the route", () => {
  it("spaces samples ≤ 20 NM apart, both ends included", () => {
    const ctx = makeContext(165, () => nortada);
    const samples = buildForecastSamples(ctx.routeGeometry, ctx.routeCumulative, ctx.routeDistanceNm);
    expect(samples).toHaveLength(10); // 165 NM → 9 gaps of ~18.3 NM
    expect(samples[0]).toMatchObject({ key: "route-0", alongNm: 0, lat: ctx.routeGeometry[0][0] });
    expect(samples.at(-1)!.alongNm).toBeCloseTo(ctx.routeDistanceNm, 6);
    for (let i = 1; i < samples.length; i++) expect(samples[i].alongNm - samples[i - 1].alongNm).toBeLessThanOrEqual(20);
  });

  it("each hour uses the forecast of the nearest sample along-track", () => {
    // Port forecasts say calm; the offshore sample has the breeze.
    const ctx = makeContext(60, () => calm);
    const breeze = series(T0 - 24 * H, 240, () => nortada);
    const withSamples: LegTimelineContext = {
      ...ctx,
      forecasts: { ...ctx.forecasts, "route-0": ctx.forecasts["test-north"], "route-1": breeze, "route-2": breeze },
      forecastSamples: [
        { key: "route-0", lat: 0, lon: 0, alongNm: 0 },
        { key: "route-1", lat: 0, lon: 0, alongNm: 30 },
        { key: "route-2", lat: 0, lon: 0, alongNm: 60 },
      ],
    };
    const portsOnly = computeLegTimelineFromContext(ctx, passage, vessel);
    const sampled = computeLegTimelineFromContext(withSamples, passage, vessel);
    expect(portsOnly.timeline.every((e) => e.windKt === 4)).toBe(true);
    expect(sampled.timeline[0].windKt).toBe(4); // still near the departure sample
    expect(sampled.timeline.filter((e) => e.windKt === 15).length).toBeGreaterThan(sampled.timeline.length / 2);
    expect(sampled.summary.sailHours).toBeGreaterThan(0);
  });
});

describe("fuel against the tank", () => {
  it("flags a window that needs more fuel than the tank holds", () => {
    const res = computeDepartureWindows({
      context: makeContext(165, () => calm), passage,
      vessel: { ...vessel, fuelTankLiters: 60, usableFuelLiters: null, reserveFuelLiters: null },
      departures: [new Date(T0)],
    });
    const row = res.rows[0];
    expect(row.outcomes.pessimistic.fuelL).toBeGreaterThan(60);
    expect(row.verdict).toBe("CAUTION");
    expect(row.reasons.join(" ")).toMatch(/fuel \d+ L > 60 L tank/);
  });

  it("flags eating into the reserve", () => {
    const res = computeDepartureWindows({
      context: makeContext(120, () => calm), passage,
      vessel: { ...vessel, fuelTankLiters: 60, usableFuelLiters: 55, reserveFuelLiters: 10 },
      departures: [new Date(T0)],
    });
    // ~120 NM at 5.6 kn pessimistic ≈ 21 h × 2.5 L/h ≈ 54 L: within 55, but under the 10 L reserve.
    expect(res.rows[0].reasons.join(" ")).toMatch(/leaves < 10 L reserve/);
  });
});
