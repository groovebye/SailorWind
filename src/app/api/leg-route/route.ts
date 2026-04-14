import { NextRequest, NextResponse } from "next/server";
import { getLegRoute, saveManualRoute, resetToAutoRoute } from "@/lib/leg-route";
import { prisma } from "@/lib/db";

// GET /api/leg-route?passageId=&legIndex=&fromName=&fromLat=&fromLon=&toName=&toLat=&toLon=
export async function GET(req: NextRequest) {
  const passageId = req.nextUrl.searchParams.get("passageId");
  const legIndex = parseInt(req.nextUrl.searchParams.get("legIndex") || "0", 10);
  const fromName = req.nextUrl.searchParams.get("fromName") || "";
  const fromLat = parseFloat(req.nextUrl.searchParams.get("fromLat") || "0");
  const fromLon = parseFloat(req.nextUrl.searchParams.get("fromLon") || "0");
  const toName = req.nextUrl.searchParams.get("toName") || "";
  const toLat = parseFloat(req.nextUrl.searchParams.get("toLat") || "0");
  const toLon = parseFloat(req.nextUrl.searchParams.get("toLon") || "0");

  if (!passageId) {
    return NextResponse.json({ error: "passageId required" }, { status: 400 });
  }

  const passage = await prisma.passage.findFirst({
    where: { OR: [{ shortId: passageId }, { id: passageId }] },
  });
  if (!passage) {
    return NextResponse.json({ error: "Passage not found" }, { status: 404 });
  }

  const result = await getLegRoute(
    passage.id, legIndex,
    { name: fromName, lat: fromLat, lon: fromLon },
    { name: toName, lat: toLat, lon: toLon },
  );

  return NextResponse.json(result);
}

// POST /api/leg-route — save manual route
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { passageId, legIndex, points, notes } = body;

  if (!passageId || legIndex === undefined || !points?.length) {
    return NextResponse.json({ error: "passageId, legIndex, points required" }, { status: 400 });
  }

  if (points.length < 2) {
    return NextResponse.json({ error: "At least 2 points required" }, { status: 400 });
  }

  const passage = await prisma.passage.findFirst({
    where: { OR: [{ shortId: passageId }, { id: passageId }] },
  });
  if (!passage) {
    return NextResponse.json({ error: "Passage not found" }, { status: 404 });
  }

  await saveManualRoute(passage.id, legIndex, points, notes);
  return NextResponse.json({ ok: true });
}

// DELETE /api/leg-route?passageId=&legIndex= — reset to auto
export async function DELETE(req: NextRequest) {
  const passageId = req.nextUrl.searchParams.get("passageId");
  const legIndex = parseInt(req.nextUrl.searchParams.get("legIndex") || "0", 10);

  if (!passageId) {
    return NextResponse.json({ error: "passageId required" }, { status: 400 });
  }

  const passage = await prisma.passage.findFirst({
    where: { OR: [{ shortId: passageId }, { id: passageId }] },
  });
  if (!passage) {
    return NextResponse.json({ error: "Passage not found" }, { status: 404 });
  }

  await resetToAutoRoute(passage.id, legIndex);
  return NextResponse.json({ ok: true });
}
