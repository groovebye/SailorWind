import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeLegTimelineFromContext, resolveLegTimelineContext } from "@/lib/passage-computation";
import { Prisma } from "@/generated/prisma/client";

function parsePerformanceModel(raw: unknown) {
  const defaults = {
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

export async function GET(req: NextRequest) {
  try {
    const passageRef = req.nextUrl.searchParams.get("passageId") ?? req.nextUrl.searchParams.get("id");
    const legIndexRaw = req.nextUrl.searchParams.get("legIndex");
    const force = req.nextUrl.searchParams.get("force") === "1";

    if (!passageRef || legIndexRaw === null) {
      return NextResponse.json({ error: "passageId and legIndex are required" }, { status: 400 });
    }

    const legIndex = Number.parseInt(legIndexRaw, 10);
    if (Number.isNaN(legIndex)) {
      return NextResponse.json({ error: "legIndex must be a number" }, { status: 400 });
    }

    const passage = await prisma.passage.findFirst({
      where: { OR: [{ id: passageRef }, { shortId: passageRef }] },
      include: {
        waypoints: {
          include: { port: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!passage) {
      return NextResponse.json({ error: "Passage not found" }, { status: 404 });
    }

    let vessel = await prisma.vesselProfile.findUnique({ where: { slug: "bossanova" } });
    if (!vessel) {
      vessel = await prisma.vesselProfile.create({
        data: {
          slug: "bossanova",
          name: "Bossanova",
          loaMeters: 9.5,
          draftMeters: 1.45,
          engineCruiseKt: 6.2,
          engineMaxKt: 6.8,
          fuelBurnLph: 2.5,
          motorsailBurnLph: 1.75,
          notes: "Hallberg-Rassy Monsun 31 — Bossanova polar assumptions (conservative cruising model)",
          performanceModel: {
            lightAirMotorThresholdKt: 7,
            motorsailUpwindThresholdKt: 12,
            closeHauledMinAngleDeg: 38,
            efficientRunMinWindKt: 10,
            reef1AtWindKt: 18,
            reef2AtWindKt: 24,
            reef1AtGustKt: 22,
            reef2AtGustKt: 28,
            harborApproachMotorRadiusNm: 1.2,
          },
        },
      });
    }

    const context = await resolveLegTimelineContext(
      {
        id: passage.id,
        departure: passage.departure,
        speed: passage.speed,
        mode: passage.mode,
        model: passage.model,
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
      legIndex,
      {
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
      }
    );

    const existing = await prisma.legComputation.findUnique({
      where: {
        passageId_legIndex_forecastSignature_routeSignature_vesselSignature: {
          passageId: passage.id,
          legIndex,
          forecastSignature: context.forecastSignature,
          routeSignature: context.routeSignature,
          vesselSignature: context.vesselSignature,
        },
      },
    });

    if (!force && existing && (!existing.validUntil || existing.validUntil.getTime() > Date.now())) {
      return NextResponse.json({
        source: "cache",
        computedAt: existing.computedAt,
        validUntil: existing.validUntil,
        summary: existing.summary,
        timeline: existing.timeline,
        warnings: existing.warnings,
      });
    }

    const computation = computeLegTimelineFromContext(context, {
      id: passage.id,
      departure: passage.departure,
      speed: passage.speed,
      mode: passage.mode,
      model: passage.model,
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
    }, {
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
    });

    if (existing) {
      const updated = await prisma.legComputation.update({
        where: { id: existing.id },
        data: {
          summary: computation.summary as unknown as Prisma.InputJsonValue,
          timeline: computation.timeline as unknown as Prisma.InputJsonValue,
          warnings: computation.warnings as unknown as Prisma.InputJsonValue,
          computedAt: new Date(),
          validUntil: computation.validUntil,
          status: "ready",
        },
      });

      return NextResponse.json({
        source: "recomputed",
        computedAt: updated.computedAt,
        validUntil: updated.validUntil,
        summary: updated.summary,
        timeline: updated.timeline,
        warnings: updated.warnings,
      });
    }

    const created = await prisma.legComputation.create({
      data: {
        passageId: passage.id,
        legIndex,
        vesselProfileId: vessel.id,
        forecastSignature: computation.forecastSignature,
        routeSignature: computation.routeSignature,
        vesselSignature: computation.vesselSignature,
        summary: computation.summary as unknown as Prisma.InputJsonValue,
        timeline: computation.timeline as unknown as Prisma.InputJsonValue,
        warnings: computation.warnings as unknown as Prisma.InputJsonValue,
        validUntil: computation.validUntil,
        status: "ready",
      },
    });

    return NextResponse.json({
      source: "created",
      computedAt: created.computedAt,
      validUntil: created.validUntil,
      summary: created.summary,
      timeline: created.timeline,
      warnings: created.warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
