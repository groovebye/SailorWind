import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/leg?from=gijon&to=luarca — get leg guide
export async function GET(req: NextRequest) {
  const fromSlug = req.nextUrl.searchParams.get("from");
  const toSlug = req.nextUrl.searchParams.get("to");

  if (!fromSlug || !toSlug) {
    return NextResponse.json({ error: "from and to slugs required" }, { status: 400 });
  }

  const guide = await prisma.legGuide.findUnique({
    where: { fromSlug_toSlug: { fromSlug, toSlug } },
  });

  if (!guide) {
    return NextResponse.json({ guide: null });
  }

  return NextResponse.json({ guide });
}
