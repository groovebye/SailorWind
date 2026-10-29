/**
 * Timeline inputs — load a passage + its vessel from the DB and shape them for
 * the timeline engine (passage-computation). Shared by /api/leg-timeline and
 * /api/departure-windows so both simulate the exact same boat and schedule.
 */

import { prisma } from "@/lib/db";
import { crewPassage, passageVessel } from "@/lib/auth/dal";
import type { PassageLike, VesselLike, VesselPerformanceModel } from "@/lib/passage-computation";

const DEFAULT_PERFORMANCE_MODEL = {
  lightAirMotorThresholdKt: 7,
  motorsailUpwindThresholdKt: 12,
  closeHauledMinAngleDeg: 38,
  efficientRunMinWindKt: 10,
  reef1AtWindKt: 18,
  reef2AtWindKt: 24,
  reef1AtGustKt: 22,
  reef2AtGustKt: 28,
  harborApproachMotorRadiusNm: 1.2,
};

export function parsePerformanceModel(raw: unknown): VesselPerformanceModel {
  const defaults = DEFAULT_PERFORMANCE_MODEL;
  if (!raw || typeof raw !== "object") {
    return defaults;
  }
  const obj = raw as Record<string, unknown>;
  return {
    lightAirMotorThresholdKt: typeof obj.lightAirMotorThresholdKt === "number" ? obj.lightAirMotorThresholdKt : defaults.lightAirMotorThresholdKt,
    motorsailUpwindThresholdKt: typeof obj.motorsailUpwindThresholdKt === "number" ? obj.motorsailUpwindThresholdKt : defaults.motorsailUpwindThresholdKt,
    closeHauledMinAngleDeg: typeof obj.closeHauledMinAngleDeg === "number" ? obj.closeHauledMinAngleDeg : defaults.closeHauledMinAngleDeg,
    efficientRunMinWindKt: typeof obj.efficientRunMinWindKt === "number" ? obj.efficientRunMinWindKt : defaults.efficientRunMinWindKt,
    reef1AtWindKt: typeof obj.reef1AtWindKt === "number" ? obj.reef1AtWindKt : defaults.reef1AtWindKt,
    reef2AtWindKt: typeof obj.reef2AtWindKt === "number" ? obj.reef2AtWindKt : defaults.reef2AtWindKt,
    reef1AtGustKt: typeof obj.reef1AtGustKt === "number" ? obj.reef1AtGustKt : defaults.reef1AtGustKt,
    reef2AtGustKt: typeof obj.reef2AtGustKt === "number" ? obj.reef2AtGustKt : defaults.reef2AtGustKt,
    harborApproachMotorRadiusNm: typeof obj.harborApproachMotorRadiusNm === "number" ? obj.harborApproachMotorRadiusNm : defaults.harborApproachMotorRadiusNm,
    // Polar data — pass through if valid
    polarData: obj.polarData && typeof obj.polarData === "object" ? obj.polarData as {
      twsKnots: number[]; twaDegrees: number[]; boatSpeeds: number[][]; hullSpeedKt?: number;
      targetUpwindTwaDeg?: number; targetDownwindTwaDeg?: number;
    } : undefined,
    // Polar thresholds
    targetBeamReachEfficiencyPct: typeof obj.targetBeamReachEfficiencyPct === "number" ? obj.targetBeamReachEfficiencyPct : undefined,
    lowEfficiencyThresholdPct: typeof obj.lowEfficiencyThresholdPct === "number" ? obj.lowEfficiencyThresholdPct : undefined,
    motorsailEfficiencyThresholdPct: typeof obj.motorsailEfficiencyThresholdPct === "number" ? obj.motorsailEfficiencyThresholdPct : undefined,
    minimumSailingSpeedKt: typeof obj.minimumSailingSpeedKt === "number" ? obj.minimumSailingSpeedKt : undefined,
  };
}

export type TimelineInputs = { passage: PassageLike; vessel: VesselLike };

/**
 * The user's passage (by id or shortId) + its boat, shaped for the timeline engine.
 * The boat is the passage's own or the owner's default boat (same for all crew).
 * Null when the passage doesn't exist or the user isn't on it; "NO_BOAT" when the owner has no boat yet.
 */
export async function loadTimelineInputs(passageRef: string, userId: string): Promise<TimelineInputs | "NO_BOAT" | null> {
  const passage = await prisma.passage.findFirst({
    where: crewPassage(passageRef, userId),
    include: {
      waypoints: {
        include: { port: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!passage) return null;

  // Always the owner's boat, whoever on the crew is looking.
  const vessel = await passageVessel(passage);
  if (!vessel) return "NO_BOAT";

  // Load per-leg departure overrides
  const legRoutes = await prisma.passageLegRoute.findMany({
    where: { passageId: passage.id },
    select: { legIndex: true, departureOverride: true },
  });
  const legDepartureOverrides: Record<number, string> = {};
  for (const r of legRoutes) {
    if (r.departureOverride) legDepartureOverrides[r.legIndex] = r.departureOverride;
  }

  return {
    passage: {
      id: passage.id,
      departure: passage.departure,
      speed: passage.speed,
      mode: passage.mode,
      model: passage.model,
      legDepartureOverrides,
      waypoints: passage.waypoints.map((waypoint) => ({
        port: {
          name: waypoint.port.name,
          slug: waypoint.port.slug,
          lat: waypoint.port.lat,
          lon: waypoint.port.lon,
          coastlineNm: waypoint.port.coastlineNm,
          type: waypoint.port.type,
        },
        isStop: waypoint.isStop,
        isCape: waypoint.isCape,
        sortOrder: waypoint.sortOrder,
      })),
    },
    vessel: {
      id: vessel.id,
      slug: vessel.slug,
      name: vessel.name,
      engineCruiseKt: vessel.engineCruiseKt,
      engineMaxKt: vessel.engineMaxKt,
      fuelBurnLph: vessel.fuelBurnLph ?? 2.5,
      fuelTankLiters: vessel.fuelTankLiters,
      usableFuelLiters: vessel.usableFuelLiters,
      reserveFuelLiters: vessel.reserveFuelLiters,
      motorsailBurnLph: vessel.motorsailBurnLph ?? 1.75,
      performanceModel: parsePerformanceModel(vessel.performanceModel),
    },
  };
}
