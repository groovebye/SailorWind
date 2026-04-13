import { NextRequest, NextResponse } from "next/server";
import { fetchWindyForecast, getWindyStats } from "@/lib/windy";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { waypoints } = body;

  if (!waypoints?.length) {
    return NextResponse.json({ error: "waypoints required" }, { status: 400 });
  }

  const stats = getWindyStats();
  if (!stats.canUpdate) {
    return NextResponse.json({
      error: "Windy update too recent. Please wait 6 hours between updates.",
      lastUpdate: stats.lastUpdate,
    }, { status: 429 });
  }

  const result: Record<string, unknown> = {};
  for (const wp of waypoints) {
    try {
      result[wp.name] = await fetchWindyForecast(wp.lat, wp.lon, wp.isCape ?? false);
    } catch (e) {
      result[wp.name] = [];
      console.error(`Windy fetch failed for ${wp.name}:`, e);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json(getWindyStats());
}
