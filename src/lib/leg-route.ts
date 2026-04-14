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
    };
  }

  // Fall back to auto-route
  const autoRoute = buildSeaRoute(
    { name: fromPort.name, lat: fromPort.lat, lon: fromPort.lon },
    { name: toPort.name, lat: toPort.lat, lon: toPort.lon },
  );

  const pts = autoRoute.map(([lat, lon]: LatLon) => ({ lat, lon }));
  return {
    mode: "auto",
    points: pts,
    distanceNm: polylineDistanceNm(pts),
    hasManualOverride: !!manual,
  };
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
