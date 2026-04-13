import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");

  if (slug) {
    const area = await prisma.portArea.findUnique({
      where: { slug },
      include: {
        marinas: {
          include: { prices: true, mapFeatures: { orderBy: { sortOrder: "asc" } } },
          orderBy: { berthCount: "desc" },
        },
        nearbyPlaces: {
          orderBy: [{ isRecommended: "desc" }, { sortOrder: "asc" }],
        },
      },
    });
    if (!area) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(area);
  }

  const areas = await prisma.portArea.findMany({
    orderBy: { name: "asc" },
    include: {
      marinas: {
        include: { prices: { where: { loaMeters: 9.5 } } },
        orderBy: { berthCount: "desc" },
      },
      nearbyPlaces: {
        where: { isRecommended: true },
        take: 3,
      },
    },
  });

  return NextResponse.json(areas);
}
