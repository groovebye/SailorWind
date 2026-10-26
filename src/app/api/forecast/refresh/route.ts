import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchForecast, type WeatherModel } from "@/lib/weather";
import { setKv, getKv } from "@/lib/api-quota";
import { timingSafeEqual } from "node:crypto";

/**
 * Background forecast refresh — pre-warms Open-Meteo forecasts for recently-used
 * passages into Passage.forecastCache so the UI reads cache instantly (no upstream
 * call in the request path). Intended to be hit by the server cron, e.g.:
 *
 *   0 *\/3 * * * curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" http://127.0.0.1:3001/api/forecast/refresh >/dev/null
 *
 * Requires the CRON_SECRET env var to match the x-cron-secret header.
 *
 * Open-Meteo only (free, no quota). Windy stays on-demand behind its rate-limit.
 */
const MAX_PASSAGES = 25;
const RECENT_DAYS = 14;

function cronAllowed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("x-cron-secret");
  if (!secret || !given) return false;
  const a = Buffer.from(secret), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!cronAllowed(req)) return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  const since = new Date(Date.now() - RECENT_DAYS * 86400000);
  const passages = await prisma.passage.findMany({
    where: { updatedAt: { gte: since } },
    orderBy: { updatedAt: "desc" },
    take: MAX_PASSAGES,
    include: { waypoints: { include: { port: true }, orderBy: { sortOrder: "asc" } } },
  });

  let warmedPassages = 0, warmedWaypoints = 0;
  const errors: string[] = [];

  for (const p of passages) {
    const model = p.model as WeatherModel;
    const map: Record<string, Awaited<ReturnType<typeof fetchForecast>>> = {};
    for (const wp of p.waypoints) {
      try {
        map[wp.port.name] = await fetchForecast(wp.port.lat, wp.port.lon, model, wp.isCape, false);
        warmedWaypoints++;
      } catch (e) {
        errors.push(`${p.shortId}/${wp.port.name}: ${e instanceof Error ? e.message : "fail"}`);
      }
    }
    if (Object.keys(map).length) {
      const cache = (p.forecastCache as Record<string, unknown>) || {};
      cache[`openmeteo_${model}`] = { data: map, cachedAt: new Date().toISOString() };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.passage.update({ where: { id: p.id }, data: { forecastCache: cache as any } });
      warmedPassages++;
    }
  }

  await setKv("forecast_last_refresh", String(Date.now()));
  return NextResponse.json({ warmedPassages, warmedWaypoints, errors: errors.slice(0, 20) });
}

export async function GET(req: Request) {
  if (!cronAllowed(req)) return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  const last = await getKv("forecast_last_refresh");
  return NextResponse.json({ lastRefresh: last ? new Date(Number(last)).toISOString() : null });
}
