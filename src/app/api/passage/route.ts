import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { nanoid } from "@/lib/nanoid";
import { authed } from "@/lib/auth/api";
import { defaultVessel, ownedPassage } from "@/lib/auth/dal";

/** A boat id is only accepted if it belongs to the user. */
async function ownedVesselId(userId: string, vesselProfileId: unknown): Promise<string | null | undefined> {
  if (typeof vesselProfileId !== "string" || !vesselProfileId) return null;
  const v = await prisma.vesselProfile.findFirst({ where: { id: vesselProfileId, ownerId: userId }, select: { id: true } });
  return v ? v.id : undefined; // undefined = not theirs
}

export async function POST(req: NextRequest) {
  const user = await authed(req);
  if (user instanceof Response) return user;
  const body = await req.json();

  const { name, departure, speed, mode, model, waypoints, vesselProfileId } = body;

  if (!departure || !waypoints?.length) {
    return NextResponse.json({ error: "departure and waypoints required" }, { status: 400 });
  }

  let vesselId = await ownedVesselId(user.id, vesselProfileId);
  if (vesselId === undefined) return NextResponse.json({ error: "Boat not found" }, { status: 404 });
  vesselId ??= (await defaultVessel(user.id))?.id ?? null;

  const shortId = nanoid(8);

  const passage = await prisma.passage.create({
    data: {
      shortId,
      ownerId: user.id,
      vesselProfileId: vesselId,
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
  const user = await authed(req);
  if (user instanceof Response) return user;
  const id = req.nextUrl.searchParams.get("id");

  if (!id) {
    const passages = await prisma.passage.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        waypoints: { include: { port: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    return NextResponse.json(passages);
  }

  const passage = await prisma.passage.findFirst({
    where: ownedPassage(id, user.id),
    include: {
      waypoints: { include: { port: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!passage) {
    return NextResponse.json({ error: "Passage not found" }, { status: 404 });
  }

  return NextResponse.json(passage);
}

export async function PATCH(req: NextRequest) {
  const user = await authed(req);
  if (user instanceof Response) return user;
  const body = await req.json();
  const { id, departure, speed, mode, model, source, vesselProfileId } = body;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const passage = await prisma.passage.findFirst({ where: ownedPassage(id, user.id) });

  if (!passage) {
    return NextResponse.json({ error: "Passage not found" }, { status: 404 });
  }

  let vesselId: string | null | undefined;
  if (vesselProfileId !== undefined) {
    vesselId = await ownedVesselId(user.id, vesselProfileId);
    if (vesselId === undefined) return NextResponse.json({ error: "Boat not found" }, { status: 404 });
  }

  const updated = await prisma.passage.update({
    where: { id: passage.id },
    data: {
      ...(departure !== undefined && { departure: new Date(departure) }),
      ...(speed !== undefined && { speed }),
      ...(mode !== undefined && { mode }),
      ...(model !== undefined && { model }),
      ...(source !== undefined && { source }),
      ...(vesselProfileId !== undefined && { vesselProfileId: vesselId }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const user = await authed(req);
  if (user instanceof Response) return user;
  const id = req.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const passage = await prisma.passage.findFirst({ where: ownedPassage(id, user.id) });

  if (!passage) {
    return NextResponse.json({ error: "Passage not found" }, { status: 404 });
  }

  await prisma.passageWaypoint.deleteMany({ where: { passageId: passage.id } });
  await prisma.passage.delete({ where: { id: passage.id } });

  return NextResponse.json({ ok: true });
}
