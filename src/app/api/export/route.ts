import { NextRequest, NextResponse } from "next/server";
import { authed } from "@/lib/auth/api";
import { crewPassage } from "@/lib/auth/dal";
import { getLegRoute } from "@/lib/leg-route";
import { prisma } from "@/lib/db";
import { asciiName, buildGpx, plotterRoutes, type ExportLeg } from "@/lib/gpx";

/**
 * GPX Export API
 * GET /api/export?passageId=&legIndex=
 *
 * Plotter-safe GPX 1.1 for the Raymarine Axiom (LightHouse, via microSD) and
 * Navionics Boating: one <rte> per leg, short ASCII point names, long routes
 * split into parts (see lib/gpx). Omit legIndex for the whole passage.
 */
export async function GET(req: NextRequest) {
  const user = await authed(req);
  if (user instanceof Response) return user;
  const passageId = req.nextUrl.searchParams.get("passageId");
  const legIndexStr = req.nextUrl.searchParams.get("legIndex");

  if (!passageId) {
    return NextResponse.json({ error: "passageId required" }, { status: 400 });
  }

  const passage = await prisma.passage.findFirst({
    where: crewPassage(passageId, user.id),
    include: {
      waypoints: { include: { port: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!passage) {
    return NextResponse.json({ error: "Passage not found" }, { status: 404 });
  }

  const stops = passage.waypoints.filter(w => w.isStop);
  const legIndexes = legIndexStr !== null
    ? [parseInt(legIndexStr, 10)]
    : stops.slice(0, -1).map((_, i) => i);
  if (legIndexes.some(i => !(i >= 0 && i < stops.length - 1))) {
    return NextResponse.json({ error: "legIndex out of range" }, { status: 400 });
  }

  const legs: ExportLeg[] = [];
  for (const i of legIndexes) {
    const from = stops[i].port;
    const to = stops[i + 1].port;
    const route = await getLegRoute(
      passage.id, i,
      { name: from.name, lat: from.lat, lon: from.lon },
      { name: to.name, lat: to.lat, lon: to.lon },
    );
    legs.push({ from: from.name, to: to.name, points: route.points });
  }

  const name = legIndexStr !== null
    ? `${legs[0].from}-${legs[0].to}`
    : passage.name || `${legs[0]?.from ?? "SailorWind"}-${legs[legs.length - 1]?.to ?? "Passage"}`;
  const gpx = buildGpx({ name, routes: plotterRoutes(legs) });

  return new NextResponse(gpx, {
    headers: {
      "Content-Type": "application/gpx+xml",
      "Content-Disposition": `attachment; filename="${asciiName(name, 40).replace(/[^A-Za-z0-9_-]+/g, "_")}.gpx"`,
    },
  });
}
