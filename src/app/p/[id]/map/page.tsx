import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { haversineNm } from "@/lib/geo";
import ChartView from "./ChartView";

export const dynamic = "force-dynamic";

export default async function ChartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const passage = await prisma.passage.findUnique({
    where: { shortId: id },
    include: { waypoints: { include: { port: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!passage) notFound();

  // Reeds approach waypoints (seaward entrance points) — attach to each passage
  // waypoint by nearest catalogued PortArea so the route threads in safely.
  const approaches = await prisma.portArea.findMany({
    where: { approachLat: { not: null }, approachLon: { not: null } },
    select: { lat: true, lon: true, approachLat: true, approachLon: true, approachNote: true },
  });
  const approachFor = (lat: number, lon: number) => {
    let best: (typeof approaches)[number] | null = null;
    let bestNm = 3; // only match within 3 nm
    for (const a of approaches) {
      const d = haversineNm([lat, lon], [a.lat, a.lon]);
      if (d < bestNm) { bestNm = d; best = a; }
    }
    return best && best.approachLat != null && best.approachLon != null
      ? { lat: best.approachLat, lon: best.approachLon, note: best.approachNote }
      : null;
  };

  const wps = passage.waypoints.map((w) => ({
    name: w.port.name, slug: w.port.slug, lat: w.port.lat, lon: w.port.lon,
    isStop: w.isStop, isCape: w.isCape, orcaRisk: w.port.orcaRisk,
    approach: approachFor(w.port.lat, w.port.lon),
  }));
  const stops = passage.waypoints.filter((w) => w.isStop);
  const from = (stops[0] ?? passage.waypoints[0])?.port.name ?? "?";
  const to = (stops[stops.length - 1] ?? passage.waypoints[passage.waypoints.length - 1])?.port.name ?? "?";
  let nm = 0;
  for (let i = 1; i < passage.waypoints.length; i++) {
    const a = passage.waypoints[i - 1].port, b = passage.waypoints[i].port;
    nm += haversineNm([a.lat, a.lon], [b.lat, b.lon]);
  }

  return <ChartView passageId={passage.shortId} from={from} to={to} nm={nm} wps={wps} />;
}
