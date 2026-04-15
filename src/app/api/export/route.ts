import { NextRequest, NextResponse } from "next/server";
import { getLegRoute } from "@/lib/leg-route";
import { prisma } from "@/lib/db";

/**
 * GPX Export API
 * GET /api/export?passageId=&legIndex=&format=gpx
 *
 * Exports route as GPX file for Navionics/OpenCPN/etc.
 */
export async function GET(req: NextRequest) {
  const passageId = req.nextUrl.searchParams.get("passageId");
  const legIndexStr = req.nextUrl.searchParams.get("legIndex");

  if (!passageId) {
    return NextResponse.json({ error: "passageId required" }, { status: 400 });
  }

  const passage = await prisma.passage.findFirst({
    where: { OR: [{ shortId: passageId }, { id: passageId }] },
    include: {
      waypoints: { include: { port: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!passage) {
    return NextResponse.json({ error: "Passage not found" }, { status: 404 });
  }

  const stops = passage.waypoints.filter(w => w.isStop);

  // Export single leg or full passage
  let routePoints: { lat: number; lon: number; name?: string }[] = [];
  let routeName = passage.name || "SailorWind Passage";

  if (legIndexStr !== null && legIndexStr !== undefined) {
    const legIndex = parseInt(legIndexStr, 10);
    if (legIndex >= 0 && legIndex < stops.length - 1) {
      const from = stops[legIndex].port;
      const to = stops[legIndex + 1].port;
      routeName = `${from.name} → ${to.name}`;

      const route = await getLegRoute(
        passage.id, legIndex,
        { name: from.name, lat: from.lat, lon: from.lon },
        { name: to.name, lat: to.lat, lon: to.lon },
      );
      routePoints = route.points.map((p, i) => ({
        lat: p.lat, lon: p.lon,
        name: i === 0 ? from.name : i === route.points.length - 1 ? to.name : `WP${i}`,
      }));
    }
  } else {
    // Full passage — concatenate all leg routes
    for (let i = 0; i < stops.length - 1; i++) {
      const from = stops[i].port;
      const to = stops[i + 1].port;
      const route = await getLegRoute(
        passage.id, i,
        { name: from.name, lat: from.lat, lon: from.lon },
        { name: to.name, lat: to.lat, lon: to.lon },
      );
      const pts = route.points.map((p, j) => ({
        lat: p.lat, lon: p.lon,
        name: j === 0 ? from.name : j === route.points.length - 1 ? to.name : undefined,
      }));
      if (routePoints.length > 0) routePoints.push(...pts.slice(1));
      else routePoints.push(...pts);
    }
  }

  // Build GPX XML
  const gpx = buildGPX(routeName, routePoints);

  return new NextResponse(gpx, {
    headers: {
      "Content-Type": "application/gpx+xml",
      "Content-Disposition": `attachment; filename="${routeName.replace(/[^a-zA-Z0-9]/g, "_")}.gpx"`,
    },
  });
}

function buildGPX(name: string, points: { lat: number; lon: number; name?: string }[]): string {
  const now = new Date().toISOString();
  const wpts = points.filter(p => p.name).map(p =>
    `  <wpt lat="${p.lat}" lon="${p.lon}"><name>${escXml(p.name!)}</name></wpt>`
  ).join("\n");

  const rtepts = points.map(p =>
    `    <rtept lat="${p.lat}" lon="${p.lon}">${p.name ? `<name>${escXml(p.name)}</name>` : ""}</rtept>`
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SailorWind" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escXml(name)}</name>
    <time>${now}</time>
  </metadata>
${wpts}
  <rte>
    <name>${escXml(name)}</name>
${rtepts}
  </rte>
</gpx>`;
}

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
