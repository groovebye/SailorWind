import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { nanoid } from "@/lib/nanoid";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { name, departure, speed, mode, model, waypoints } = body;

  if (!departure || !waypoints?.length) {
    return NextResponse.json({ error: "departure and waypoints required" }, { status: 400 });
  }

  const shortId = nanoid(8);

  const passage = await prisma.passage.create({
    data: {
      shortId,
      name: name || null,
      departure: new Date(departure),
      speed: speed ?? 5.0,
      mode: mode ?? "daily",
      model: model ?? "ecmwf_ifs025",
      waypoints: {
        create: waypoints.map((wp: { portId: string; isStop: boolean; isCape: boolean }, i: number) => ({
          portId: wp.portId,
          sortOrder: i,
          isStop: wp.isStop ?? false,
          isCape: wp.isCape ?? false,
        })),
      },
    },
    include: { waypoints: { include: { port: true }, orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ shortId: passage.shortId, id: passage.id });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  if (!id) {
    const passages = await prisma.passage.findMany({
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        waypoints: { include: { port: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    return NextResponse.json(passages);
  }

  const passage = await prisma.passage.findFirst({
    where: { OR: [{ shortId: id }, { id }] },
    include: {
      waypoints: { include: { port: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!passage) {
    return NextResponse.json({ error: "Passage not found" }, { status: 404 });
  }

  return NextResponse.json(passage);
}
