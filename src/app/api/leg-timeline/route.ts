import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeLegTimelineFromContext, resolveLegTimelineContext } from "@/lib/passage-computation";
import { Prisma } from "@/generated/prisma/client";

function parsePerformanceModel(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return {
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
  }
  return raw as {
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
          notes: "Hallberg-Rassy Monsun 31 heuristics",
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
