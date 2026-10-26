import { NextRequest, NextResponse } from "next/server";
import {
  isWeatherGridModel, latticeFor, openMeteoGridUrls, parseOpenMeteoGrid,
  weatherGridQuery, type WeatherGrid, type WeatherGridModel,
} from "@/lib/weather-grid";

/**
 * Weather grid for the hub map's wind and wave layers.
 * GET /api/weather-grid?south=&west=&north=&east=&model=
 *
 * The box is snapped to a lattice of at most 12×12 nodes (lib/weather-grid);
 * one Open-Meteo forecast call and one marine call cover all nodes. Results
 * are kept for an hour in memory — the models update every few hours, and
 * panning around the same area shouldn't spend the free tier's quota.
 */

const TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 60;
const cache = new Map<string, { at: number; data: WeatherGrid }>();

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const [south, west, north, east] = ["south", "west", "north", "east"].map((k) => parseFloat(sp.get(k) ?? ""));
  if (![south, west, north, east].every(Number.isFinite) || north <= south || east <= west) {
    return NextResponse.json({ error: "south, west, north, east required (north > south, east > west)" }, { status: 400 });
  }
  const modelParam = sp.get("model");
  const model: WeatherGridModel = isWeatherGridModel(modelParam) ? modelParam : "best_match";

  const lattice = latticeFor({ south, west, north, east });
  const key = weatherGridQuery(lattice, model);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.data);

  const urls = openMeteoGridUrls(lattice, model);
  try {
    const [fc, mar] = await Promise.allSettled([
      fetch(urls.forecast).then(async (r) => { if (!r.ok) throw new Error(`forecast ${r.status}: ${(await r.text()).slice(0, 200)}`); return r.json(); }),
      fetch(urls.marine).then(async (r) => { if (!r.ok) throw new Error(`marine ${r.status}`); return r.json(); }),
    ]);
    if (fc.status === "rejected") throw fc.reason;
    const data = parseOpenMeteoGrid(lattice, fc.value, mar.status === "fulfilled" ? mar.value : null, model, new Date());

    cache.set(key, { at: Date.now(), data });
    if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    return NextResponse.json(data);
  } catch (e) {
    console.error("weather-grid:", e);
    if (hit) return NextResponse.json(hit.data); // stale beats nothing
    return NextResponse.json({ error: "Weather service unavailable" }, { status: 502 });
  }
}
