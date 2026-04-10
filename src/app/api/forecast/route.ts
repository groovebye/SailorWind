import { NextRequest, NextResponse } from "next/server";
import { fetchForecast, clearCache, type WeatherModel } from "@/lib/weather";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = parseFloat(sp.get("lat") ?? "0");
  const lon = parseFloat(sp.get("lon") ?? "0");
  const model = (sp.get("model") ?? "ecmwf_ifs025") as WeatherModel;
  const isCape = sp.get("cape") === "1";
  const force = sp.get("force") === "1";

  if (!lat || !lon) {
    return NextResponse.json({ error: "lat and lon required" }, { status: 400 });
  }

  if (force) clearCache();

  try {
    const forecasts = await fetchForecast(lat, lon, model, isCape, force);
    return NextResponse.json(forecasts);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
