import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/execution?passageId=&legIndex=
export async function GET(req: NextRequest) {
  const passageId = req.nextUrl.searchParams.get("passageId");
  const legIndex = parseInt(req.nextUrl.searchParams.get("legIndex") || "0", 10);

  if (!passageId) return NextResponse.json({ error: "passageId required" }, { status: 400 });

  const passage = await prisma.passage.findFirst({
    where: { OR: [{ shortId: passageId }, { id: passageId }] },
  });
  if (!passage) return NextResponse.json({ error: "Passage not found" }, { status: 404 });

  // Find active execution first, then latest
  let execution = await prisma.passageExecution.findFirst({
    where: { passageId: passage.id, legIndex, status: "active" },
    include: {
      checkpoints: { orderBy: { recordedAt: "asc" } },
      observations: { orderBy: { recordedAt: "asc" } },
      trackPoints: { orderBy: { recordedAt: "asc" }, take: 100 },
    },
  });

  if (!execution) {
    execution = await prisma.passageExecution.findFirst({
      where: { passageId: passage.id, legIndex },
      orderBy: { updatedAt: "desc" },
      include: {
        checkpoints: { orderBy: { recordedAt: "asc" } },
        observations: { orderBy: { recordedAt: "asc" } },
        trackPoints: { orderBy: { recordedAt: "asc" }, take: 100 },
      },
    });
  }

  return NextResponse.json({ execution });
}

// POST /api/execution — dispatch by action
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  switch (action) {
    case "start": return handleStart(body);
    case "stop": return handleStop(body);
    case "track-point": return handleTrackPoint(body);
    case "checkpoint": return handleCheckpoint(body);
    case "observation": return handleObservation(body);
    default: return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

async function resolvePassageId(passageId: string): Promise<string | null> {
  const p = await prisma.passage.findFirst({ where: { OR: [{ shortId: passageId }, { id: passageId }] } });
  return p?.id || null;
}

async function handleStart(body: Record<string, unknown>) {
  const pid = await resolvePassageId(body.passageId as string);
  if (!pid) return NextResponse.json({ error: "Passage not found" }, { status: 404 });

  const execution = await prisma.passageExecution.create({
    data: {
      passageId: pid,
      legIndex: body.legIndex as number,
      status: "active",
      startedAt: new Date(),
      name: (body.name as string) || undefined,
    },
  });

  return NextResponse.json({ execution });
}

async function handleStop(body: Record<string, unknown>) {
  const exec = await prisma.passageExecution.findUnique({ where: { id: body.executionId as string } });
  if (!exec) return NextResponse.json({ error: "Execution not found" }, { status: 404 });

  const updated = await prisma.passageExecution.update({
    where: { id: exec.id },
    data: {
      status: (body.status as string) || "completed",
      endedAt: new Date(),
      notes: (body.note as string) || exec.notes,
    },
  });

  return NextResponse.json({ execution: updated });
}

async function handleTrackPoint(body: Record<string, unknown>) {
  const tp = await prisma.passageExecutionTrackPoint.create({
    data: {
      executionId: body.executionId as string,
      recordedAt: new Date(),
      lat: body.lat as number,
      lon: body.lon as number,
      sogKt: body.sogKt as number | undefined,
      cogDeg: body.cogDeg as number | undefined,
      mode: body.mode as string | undefined,
      engineOn: body.engineOn as boolean | undefined,
      reefLevel: body.reefLevel as number | undefined,
      note: body.note as string | undefined,
    },
  });

  return NextResponse.json({ trackPoint: tp });
}

async function handleCheckpoint(body: Record<string, unknown>) {
  const cp = await prisma.passageExecutionCheckpoint.create({
    data: {
      executionId: body.executionId as string,
      recordedAt: new Date(),
      lat: body.lat as number | undefined,
      lon: body.lon as number | undefined,
      type: body.type as string,
      title: body.title as string,
      note: body.note as string | undefined,
    },
  });

  return NextResponse.json({ checkpoint: cp });
}

async function handleObservation(body: Record<string, unknown>) {
  const obs = await prisma.passageExecutionObservation.create({
    data: {
      executionId: body.executionId as string,
      recordedAt: new Date(),
      lat: body.lat as number | undefined,
      lon: body.lon as number | undefined,
      observedWindKt: body.observedWindKt as number | undefined,
      observedWindDirDeg: body.observedWindDirDeg as number | undefined,
      observedWaveM: body.observedWaveM as number | undefined,
      observedSwellM: body.observedSwellM as number | undefined,
      seaStateText: body.seaStateText as string | undefined,
      visibilityNm: body.visibilityNm as number | undefined,
      barometerHpa: body.barometerHpa as number | undefined,
      sailConfig: body.sailConfig as string | undefined,
      comfort: body.comfort as string | undefined,
      note: body.note as string | undefined,
    },
  });

  return NextResponse.json({ observation: obs });
}
