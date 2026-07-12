import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { haversineNm } from "@/lib/geo";

// Always reflect the live Port table (e.g. after catalog syncs) — never cache.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const segment = req.nextUrl.searchParams.get("segment");

  const where = segment ? { coastSegment: segment } : {};

  const ports = await prisma.port.findMany({
    where,
    orderBy: { coastlineNm: "asc" },
  });

  // Attach the two quality flags that live on PortArea (not Port): whether it's
  // a curated major hub and whether it's documented in the Reeds Almanac.
  // Match by slug, falling back to nearest catalogued area within 0.5 nm.
  const areas = await prisma.portArea.findMany({
    select: { slug: true, lat: true, lon: true, isMajor: true, inReeds: true },
  });
  const bySlug = new Map(areas.map((a) => [a.slug, a]));
  const enriched = ports.map((p) => {
    let a = bySlug.get(p.slug);
    if (!a) {
      let bestNm = 0.5;
      for (const ar of areas) {
        const d = haversineNm([p.lat, p.lon], [ar.lat, ar.lon]);
        if (d < bestNm) { bestNm = d; a = ar; }
      }
    }
    return { ...p, isMajor: a?.isMajor ?? false, inReeds: a?.inReeds ?? false };
  });

  return NextResponse.json(enriched, { headers: { "Cache-Control": "no-store" } });
}
