import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Always reflect the live Port table (e.g. after catalog syncs) — never cache.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const segment = req.nextUrl.searchParams.get("segment");

  const where = segment ? { coastSegment: segment } : {};

  const ports = await prisma.port.findMany({
    where,
    orderBy: { coastlineNm: "asc" },
  });

  return NextResponse.json(ports, { headers: { "Cache-Control": "no-store" } });
}
