import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { haversineNm } from "@/lib/geo";
import MapHub, { type HubPassage, type HubPassageSummary } from "./MapHub";

export const metadata: Metadata = { title: "Map — SailorWind" };

/**
 * The hub map: chart layers, weather, the selected passage's legs (editable),
 * departure windows and GPX in one place. `?p=<shortId>` picks the passage
 * (default: the most recently updated), `&leg=<i>` the leg.
 */
export default async function MapPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  const want = typeof sp.p === "string" ? sp.p : null;
  const legParam = typeof sp.leg === "string" ? parseInt(sp.leg, 10) : 0;

  let passages: HubPassageSummary[] = [];
  let passage: HubPassage | null = null;
  try {
    const list = await prisma.passage.findMany({
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: {
        shortId: true, name: true, departure: true,
        waypoints: { where: { isStop: true }, orderBy: { sortOrder: "asc" }, select: { port: { select: { name: true } } } },
      },
    });
    passages = list.map((p) => {
      const stops = p.waypoints.map((w) => w.port.name);
      const route = stops.length ? `${stops[0]} → ${stops[stops.length - 1]}` : "no stops";
      return { id: p.shortId, label: p.name ? `${p.name} (${route})` : route, departure: p.departure.toISOString() };
    });

    const id = want ?? passages[0]?.id;
    const row = id
      ? await prisma.passage.findFirst({
          where: { OR: [{ shortId: id }, { id }] },
          include: { waypoints: { include: { port: true }, orderBy: { sortOrder: "asc" } } },
        })
      : null;

    if (row) {
      // Reeds approach waypoints, matched to each waypoint's nearest catalogued area (≤ 3 NM).
      const approaches = await prisma.portArea.findMany({
        where: { approachLat: { not: null }, approachLon: { not: null } },
        select: { lat: true, lon: true, approachLat: true, approachLon: true, approachNote: true },
      });
      const approachFor = (lat: number, lon: number) => {
        let best: (typeof approaches)[number] | null = null;
        let bestNm = 3;
        for (const a of approaches) {
          const d = haversineNm([lat, lon], [a.lat, a.lon]);
          if (d < bestNm) { bestNm = d; best = a; }
        }
        return best && best.approachLat != null && best.approachLon != null
          ? { lat: best.approachLat, lon: best.approachLon, note: best.approachNote }
          : null;
      };
      const stops = row.waypoints.filter((w) => w.isStop);
      passage = {
        id: row.shortId,
        name: row.name,
        waypoints: row.waypoints.map((w) => ({
          name: w.port.name, lat: w.port.lat, lon: w.port.lon,
          isStop: w.isStop, isCape: w.isCape, orcaRisk: w.port.orcaRisk,
          approach: approachFor(w.port.lat, w.port.lon),
        })),
        legs: stops.slice(0, -1).map((w, i) => ({
          index: i,
          from: { name: w.port.name, lat: w.port.lat, lon: w.port.lon },
          to: { name: stops[i + 1].port.name, lat: stops[i + 1].port.lat, lon: stops[i + 1].port.lon },
        })),
      };
    }
  } catch (e) {
    // No database (e.g. offline dev): the chart layers and the berth still work.
    console.error("map page:", e);
  }

  const initialLeg = passage && legParam >= 0 && legParam < passage.legs.length ? legParam : 0;
  return <MapHub key={passage?.id ?? "none"} passages={passages} passage={passage} initialLeg={initialLeg} />;
}
