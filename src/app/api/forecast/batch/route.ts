import { NextRequest, NextResponse } from "next/server";
import { fetchForecast, clearCache, type WeatherModel } from "@/lib/weather";

interface WaypointReq {
  name: string;
  lat: number;
  lon: number;
  isCape?: boolean;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const waypoints: WaypointReq[] = body.waypoints ?? [];
  const model = (body.model ?? "ecmwf_ifs025") as WeatherModel;
  const force = body.force === true;

  if (!waypoints.length) {
    return NextResponse.json({ error: "waypoints required" }, { status: 400 });
  }

  if (force) clearCache();

  const result: Record<string, Awaited<ReturnType<typeof fetchForecast>>> = {};

  // Fetch all in parallel (Open-Meteo has generous limits)
  const promises = waypoints.map(async (wp) => {
    const data = await fetchForecast(wp.lat, wp.lon, model, wp.isCape ?? false, force);
    result[wp.name] = data;
  });

  try {
    await Promise.all(promises);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
