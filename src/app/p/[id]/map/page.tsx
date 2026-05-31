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

  const wps = passage.waypoints.map((w) => ({
    name: w.port.name, slug: w.port.slug, lat: w.port.lat, lon: w.port.lon,
    isStop: w.isStop, isCape: w.isCape, orcaRisk: w.port.orcaRisk,
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
