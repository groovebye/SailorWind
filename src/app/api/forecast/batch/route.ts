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
  const errors: Record<string, string> = {};

  // Sequential by design (Open-Meteo throttles parallel calls → 429), but one
  // waypoint failing must not blank out the whole passage: collect partials.
  for (const wp of waypoints) {
    try {
      result[wp.name] = await fetchForecast(wp.lat, wp.lon, model, wp.isCape ?? false, force);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      errors[wp.name] = msg;
      result[wp.name] = [];
      console.error(`[forecast/batch] ${wp.name} failed: ${msg}`);
    }
  }

  // Only a hard failure (nothing fetched at all) is an error response; partial
  // failures return 200 with [] for the failed waypoints (logged above), so the
  // rest of the passage still renders.
  if (Object.keys(errors).length === waypoints.length) {
    return NextResponse.json(
      { error: "All forecast fetches failed", details: errors },
      { status: 502 },
    );
  }

  // Contract preserved: response is strictly { [waypointName]: ForecastEntry[] }.
  return NextResponse.json(result);
}
