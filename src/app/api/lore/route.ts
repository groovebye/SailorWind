import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Voyage Companion lore near a bounding box (the leg's route extent + margin).
 * GET /api/lore?minLat&maxLat&minLon&maxLon  -> POIs whose position falls in the box.
 * The client further filters by distance-to-route < radiusNm and orders along the leg.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const num = (k: string) => {
    const v = q.get(k);
    return v == null ? null : Number(v);
  };
  const minLat = num("minLat"), maxLat = num("maxLat"), minLon = num("minLon"), maxLon = num("maxLon");
  if ([minLat, maxLat, minLon, maxLon].some((v) => v == null || Number.isNaN(v))) {
    return NextResponse.json({ error: "minLat, maxLat, minLon, maxLon required" }, { status: 400 });
  }

  const pois = await prisma.pointOfInterest.findMany({
    where: {
      lat: { gte: minLat!, lte: maxLat! },
      lon: { gte: minLon!, lte: maxLon! },
    },
    take: 80,
  });
  return NextResponse.json(pois);
}
