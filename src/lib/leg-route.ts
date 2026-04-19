/**
 * Leg route helper — resolves route geometry for a leg.
 * Uses manual override if saved, otherwise falls back to auto-route.
 */

import { prisma } from "@/lib/db";
import { buildSeaRoute, type LatLon } from "@/lib/coastline";

export interface LegRouteResult {
  mode: "auto" | "manual";
  points: { lat: number; lon: number; label?: string; kind?: string }[];
  distanceNm: number;
  hasManualOverride: boolean;
  departureOverride?: string | null;
}

/**
 * Haversine distance in NM between two points.
 */
function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth radius in NM
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function polylineDistanceNm(points: { lat: number; lon: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineNm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
  }
  return Math.round(total * 10) / 10;
}

/**
 * Get resolved route geometry for a leg.
 */
export async function getLegRoute(
  passageId: string,
  legIndex: number,
  fromPort: { name: string; lat: number; lon: number },
  toPort: { name: string; lat: number; lon: number },
): Promise<LegRouteResult> {
  // Check for manual override
  const manual = await prisma.passageLegRoute.findUnique({
    where: { passageId_legIndex: { passageId, legIndex } },
    include: { points: { orderBy: { sortOrder: "asc" } } },
  });

  if (manual && manual.mode === "manual" && manual.points.length >= 2) {
    const pts = manual.points.map(p => ({
      lat: p.lat, lon: p.lon, label: p.label || undefined, kind: p.kind || undefined,
    }));
    return {
      mode: "manual",
      points: pts,
      distanceNm: manual.distanceNm || polylineDistanceNm(pts),
      hasManualOverride: true,
      departureOverride: manual.departureOverride,
    };
  }

  // Fall back to auto-route, using the same from -> capes -> to anchor model as
  // the leg page and timeline so all route-dependent calculations stay aligned.
  const passage = await prisma.passage.findUnique({
    where: { id: passageId },
    include: {
      waypoints: {
        include: { port: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  let pts: { lat: number; lon: number }[];
  if (passage) {
    const stops = passage.waypoints.filter((w) => w.isStop);
    const leg = stops[legIndex] && stops[legIndex + 1]
      ? { from: stops[legIndex], to: stops[legIndex + 1] }
      : null;

    if (leg) {
      const capes = passage.waypoints.filter(
        (w) =>
          w.isCape &&
          w.port.coastlineNm >= leg.from.port.coastlineNm - 0.1 &&
          w.port.coastlineNm <= leg.to.port.coastlineNm + 0.1
      );

      const routeAnchors = [
        { name: leg.from.port.name, lat: leg.from.port.lat, lon: leg.from.port.lon },
        ...capes.map((cape) => ({
          name: `${cape.port.name} Rounding`,
          lat: cape.port.lat,
          lon: cape.port.lon,
        })),
        { name: leg.to.port.name, lat: leg.to.port.lat, lon: leg.to.port.lon },
      ];

      const merged: { lat: number; lon: number }[] = [];
      for (let i = 0; i < routeAnchors.length - 1; i++) {
        const segment = buildSeaRoute(routeAnchors[i], routeAnchors[i + 1]);
        const mapped = segment.map(([lat, lon]: LatLon) => ({ lat, lon }));
        if (merged.length > 0) merged.push(...mapped.slice(1));
        else merged.push(...mapped);
      }
      pts = merged;
    } else {
      pts = buildSeaRoute(
        { name: fromPort.name, lat: fromPort.lat, lon: fromPort.lon },
        { name: toPort.name, lat: toPort.lat, lon: toPort.lon },
      ).map(([lat, lon]: LatLon) => ({ lat, lon }));
    }
  } else {
    pts = buildSeaRoute(
      { name: fromPort.name, lat: fromPort.lat, lon: fromPort.lon },
      { name: toPort.name, lat: toPort.lat, lon: toPort.lon },
    ).map(([lat, lon]: LatLon) => ({ lat, lon }));
  }

  return {
    mode: "auto",
    points: pts,
    distanceNm: polylineDistanceNm(pts),
    hasManualOverride: !!manual,
    departureOverride: manual?.departureOverride ?? null,
  };
}

/**
 * Save just the departure override for a leg (without changing route geometry).
 * If passing null, clears the override.
 */
export async function saveDepartureOverride(
  passageId: string,
  legIndex: number,
  departureOverride: string | null,
): Promise<void> {
  await prisma.passageLegRoute.upsert({
    where: { passageId_legIndex: { passageId, legIndex } },
    create: { passageId, legIndex, mode: "auto", departureOverride },
    update: { departureOverride, updatedAt: new Date() },
  });

  // Invalidate cached LegComputation
  await prisma.legComputation.deleteMany({
    where: { passageId, legIndex },
  });
}

/**
 * Save manual route override.
 */
export async function saveManualRoute(
  passageId: string,
  legIndex: number,
  points: { lat: number; lon: number; label?: string; kind?: string }[],
  notes?: string,
): Promise<void> {
  const distanceNm = polylineDistanceNm(points);

  // Upsert route
  const route = await prisma.passageLegRoute.upsert({
    where: { passageId_legIndex: { passageId, legIndex } },
    create: { passageId, legIndex, mode: "manual", distanceNm, notes },
    update: { mode: "manual", distanceNm, notes, updatedAt: new Date() },
  });

  // Replace all points
  await prisma.passageLegRoutePoint.deleteMany({ where: { routeId: route.id } });
  await prisma.passageLegRoutePoint.createMany({
    data: points.map((p, i) => ({
      routeId: route.id,
      sortOrder: i,
      lat: p.lat,
      lon: p.lon,
      label: p.label,
      kind: p.kind || (i === 0 ? "departure" : i === points.length - 1 ? "arrival" : "manual"),
    })),
  });

  // Invalidate cached LegComputation
  await prisma.legComputation.deleteMany({
    where: { passageId, legIndex },
  });
}

/**
 * Reset leg route to auto (remove manual override).
 */
export async function resetToAutoRoute(
  passageId: string,
  legIndex: number,
): Promise<void> {
  await prisma.passageLegRoute.deleteMany({
    where: { passageId, legIndex },
  });

  // Invalidate cached LegComputation
  await prisma.legComputation.deleteMany({
    where: { passageId, legIndex },
  });
}
