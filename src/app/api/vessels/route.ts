import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** List vessel profiles (for the passage vessel selector). */
export async function GET() {
  const vessels = await prisma.vesselProfile.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, slug: true, name: true,
      loaMeters: true, draftMeters: true,
      engineCruiseKt: true, fuelTankLiters: true,
    },
  });
  return NextResponse.json(vessels);
}
