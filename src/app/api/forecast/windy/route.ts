import { NextRequest, NextResponse } from "next/server";
import { fetchWindyForecast } from "@/lib/windy";
import { windyStats, markWindyUpdate } from "@/lib/api-quota";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { waypoints } = body;

  if (!waypoints?.length) {
    return NextResponse.json({ error: "waypoints required" }, { status: 400 });
  }

  // Persistent (DB-backed) rate-limit — survives restarts.
  const stats = await windyStats();
  if (!stats.canUpdate) {
    return NextResponse.json({
      error: `Windy update too recent. Wait ~${stats.remainingHours}h between updates.`,
      lastUpdate: stats.lastUpdate,
    }, { status: 429 });
  }

  const result: Record<string, unknown> = {};
  let any = false;
  for (const wp of waypoints) {
    try {
      result[wp.name] = await fetchWindyForecast(wp.lat, wp.lon, wp.isCape ?? false);
      any = true;
    } catch (e) {
      result[wp.name] = [];
      console.error(`Windy fetch failed for ${wp.name}:`, e);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  if (any) await markWindyUpdate();
  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json(await windyStats());
}
