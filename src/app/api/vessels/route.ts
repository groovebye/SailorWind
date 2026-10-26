import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authed } from "@/lib/auth/api";

// GET /api/vessels — the signed-in user's boats (default first), for the passage boat selector.
// Boats are created/edited via Server Actions in /settings.
export async function GET(req: Request) {
  const user = await authed(req);
  if (user instanceof Response) return user;
  const vessels = await prisma.vesselProfile.findMany({
    where: { ownerId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true, slug: true, name: true, model: true, isDefault: true,
      loaMeters: true, draftMeters: true, engineCruiseKt: true, fuelTankLiters: true,
    },
  });
  return NextResponse.json(vessels);
}
