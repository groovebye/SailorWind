import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET: Load cached forecast for a passage + source + model
 * POST: Save forecast data to cache
 */

function cacheKey(source: string, model: string) {
  return `${source}_${model}`;
}

export async function GET(req: NextRequest) {
  const passageId = req.nextUrl.searchParams.get("passageId");
  const source = req.nextUrl.searchParams.get("source");
  const model = req.nextUrl.searchParams.get("model");

  if (!passageId || !source || !model) {
    return NextResponse.json({ error: "passageId, source, model required" }, { status: 400 });
  }

  const passage = await prisma.passage.findFirst({
    where: { OR: [{ shortId: passageId }, { id: passageId }] },
    select: { forecastCache: true },
  });

  if (!passage?.forecastCache) {
    return NextResponse.json({ data: null });
  }

  const cache = passage.forecastCache as Record<string, { data: unknown; cachedAt: string }>;
  const key = cacheKey(source, model);
  const entry = cache[key];

  if (!entry) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({ data: entry.data, cachedAt: entry.cachedAt });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { passageId, source, model, data } = body;

  if (!passageId || !source || !model || !data) {
    return NextResponse.json({ error: "passageId, source, model, data required" }, { status: 400 });
  }

  const passage = await prisma.passage.findFirst({
    where: { OR: [{ shortId: passageId }, { id: passageId }] },
    select: { id: true, forecastCache: true },
  });

  if (!passage) {
    return NextResponse.json({ error: "Passage not found" }, { status: 404 });
  }

  const cache = (passage.forecastCache as Record<string, unknown>) || {};
  const key = cacheKey(source, model);
  cache[key] = { data, cachedAt: new Date().toISOString() };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.passage.update({
    where: { id: passage.id },
    data: { forecastCache: cache as any },
  });

  return NextResponse.json({ ok: true });
}
