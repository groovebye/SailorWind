import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import PassageCockpit from "./_cockpit/PassageCockpit";

export const dynamic = "force-dynamic";

export default async function PassagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const passage = await prisma.passage.findUnique({
    where: { shortId: id },
    include: { waypoints: { include: { port: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!passage) notFound();

  const wps = passage.waypoints.map((w) => ({
    name: w.port.name,
    slug: w.port.slug,
    lat: w.port.lat,
    lon: w.port.lon,
    isStop: w.isStop,
    isCape: w.isCape,
    orcaRisk: w.port.orcaRisk,
  }));
  const stops = passage.waypoints.filter((w) => w.isStop);
  const from = (stops[0] ?? passage.waypoints[0])?.port.name ?? "?";
  const to = (stops[stops.length - 1] ?? passage.waypoints[passage.waypoints.length - 1])?.port.name ?? "?";

  // Resolve the vessel name (defaults to Bossanova when unset).
  let boat = "Bossanova";
  const boatModel = "Hallberg-Rassy Monsun 31";
  if (passage.vesselProfileId) {
    const v = await prisma.vesselProfile.findUnique({
      where: { id: passage.vesselProfileId },
      select: { name: true },
    }).catch(() => null);
    if (v) boat = v.name;
  }

  return (
    <PassageCockpit
      passageId={passage.shortId}
      from={from}
      to={to}
      boat={boat}
      boatModel={boatModel}
      speed={passage.speed}
      mode={passage.mode}
      model={passage.model}
      wps={wps}
    />
  );
}
