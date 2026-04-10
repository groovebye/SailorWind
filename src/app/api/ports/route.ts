import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const segment = req.nextUrl.searchParams.get("segment");

  const where = segment ? { coastSegment: segment } : {};

  const ports = await prisma.port.findMany({
    where,
    orderBy: { coastlineNm: "asc" },
  });

  return NextResponse.json(ports);
}
