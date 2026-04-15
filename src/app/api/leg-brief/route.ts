import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getLegRoute } from "@/lib/leg-route";
import { getTidePrediction, tideStateAt } from "@/lib/tides";
import { buildClientSchedule } from "@/lib/passage-schedule";

/**
 * Aggregated Leg Brief API
 *
 * GET /api/leg-brief?passageId=&legIndex=
 *
 * Returns everything the leg page needs in ONE request:
 * - passage + waypoints
 * - leg schedule (departure/arrival/distance/hours)
 * - leg guide (pilotage, milestones, hazards, fallback)
 * - resolved route (manual or auto)
 * - tides (departure + arrival)
 * - port area + marinas + nearby places
 * - execution (if any)
 *
 * This reduces the current 8+ parallel fetches to 1.
 */
export async function GET(req: NextRequest) {
  const passageId = req.nextUrl.searchParams.get("passageId");
  const legIndex = parseInt(req.nextUrl.searchParams.get("legIndex") || "0", 10);

  if (!passageId) {
    return NextResponse.json({ error: "passageId required" }, { status: 400 });
  }

  const passage = await prisma.passage.findFirst({
    where: { OR: [{ shortId: passageId }, { id: passageId }] },
    include: {
      waypoints: { include: { port: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!passage) {
    return NextResponse.json({ error: "Passage not found" }, { status: 404 });
  }

  // Build schedule
  const stops = passage.waypoints.filter(w => w.isStop);
  const stopPorts = stops.map(s => ({
    name: s.port.name, slug: s.port.slug,
    lat: s.port.lat, lon: s.port.lon,
    coastlineNm: s.port.coastlineNm,
  }));

  const schedule = buildClientSchedule(
    passage.departure, passage.speed,
    passage.mode as "daily" | "nonstop", stopPorts,
  );

  const leg = schedule[legIndex];
  if (!leg) {
    return NextResponse.json({ error: "Leg not found" }, { status: 404 });
  }

  // Parallel data fetching
  const [route, guide, portArea, execution] = await Promise.all([
    // Resolved route
    getLegRoute(passage.id, legIndex,
      { name: leg.from.name, lat: leg.from.lat, lon: leg.from.lon },
      { name: leg.to.name, lat: leg.to.lat, lon: leg.to.lon },
    ).catch(() => null),

    // Leg guide
    prisma.legGuide.findUnique({
      where: { fromSlug_toSlug: { fromSlug: leg.from.slug, toSlug: leg.to.slug } },
    }).catch(() => null),

    // Port area for arrival
    prisma.portArea.findUnique({
      where: { slug: leg.to.slug },
      include: {
        marinas: {
          include: { prices: true, mapFeatures: { orderBy: { sortOrder: "asc" } } },
          orderBy: { berthCount: "desc" },
        },
        nearbyPlaces: {
          orderBy: [{ isRecommended: "desc" }, { sortOrder: "asc" }],
        },
      },
    }).catch(() => null),

    // Execution
    prisma.passageExecution.findFirst({
      where: { passageId: passage.id, legIndex, status: "active" },
      include: {
        checkpoints: { orderBy: { recordedAt: "asc" } },
        observations: { orderBy: { recordedAt: "asc" } },
      },
    }).then(exec => exec || prisma.passageExecution.findFirst({
      where: { passageId: passage.id, legIndex },
      orderBy: { updatedAt: "desc" },
      include: {
        checkpoints: { orderBy: { recordedAt: "asc" } },
        observations: { orderBy: { recordedAt: "asc" } },
      },
    })).catch(() => null),
  ]);

  // Tides
  const depTide = getTidePrediction(leg.from.slug, leg.departTime, 2);
  const arrTide = getTidePrediction(leg.to.slug, leg.arriveTime, 2);

  return NextResponse.json({
    passage: {
      id: passage.id,
      shortId: passage.shortId,
      name: passage.name,
      departure: passage.departure,
      speed: passage.speed,
      mode: passage.mode,
      model: passage.model,
      source: passage.source,
    },
    waypoints: passage.waypoints,
    schedule,
    leg,
    route,
    guide,
    portArea,
    execution,
    tides: {
      departure: depTide ? {
        ...depTide,
        stateAtDate: tideStateAt(depTide, leg.departTime),
        extremes: depTide.extremes.map(e => ({ time: e.time.toISOString(), type: e.type, height: e.height })),
      } : null,
      arrival: arrTide ? {
        ...arrTide,
        stateAtDate: tideStateAt(arrTide, leg.arriveTime),
        extremes: arrTide.extremes.map(e => ({ time: e.time.toISOString(), type: e.type, height: e.height })),
      } : null,
    },
  });
}
