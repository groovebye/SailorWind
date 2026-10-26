import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { alongRouteNm } from "@/lib/searoute";
import { defaultVessel, requireUser } from "@/lib/auth/dal";
import PassageCockpit from "./_cockpit/PassageCockpit";

export const dynamic = "force-dynamic";

export default async function PassagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/p/${id}`);
  const passage = await prisma.passage.findFirst({
    where: { shortId: id, ownerId: user.id },
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
  const fromWp = stops[0] ?? passage.waypoints[0];
  const toWp = stops[stops.length - 1] ?? passage.waypoints[passage.waypoints.length - 1];
  const from = fromWp?.port.name ?? "?";
  const to = toWp?.port.name ?? "?";

  // Bail-out ports: every catalogued shelter (marina/port/anchorage, not a cape)
  // between the start and finish, with its along-track distance and shelter note.
  let refuges: {
    name: string; slug: string; type: string; dist: number;
    berthCount: number | null; maxDraft: number | null;
    fuel: boolean; water: boolean; repairs: boolean; showers: boolean;
    inReeds: boolean; notes: string | null;
  }[] = [];
  if (fromWp && toWp) {
    const fp = fromWp.port, tp = toWp.port;
    const lo = Math.min(fp.coastlineNm, tp.coastlineNm);
    const hi = Math.max(fp.coastlineNm, tp.coastlineNm);
    const cand = await prisma.port.findMany({
      where: { type: { not: "cape" }, coastlineNm: { gte: lo, lte: hi }, slug: { notIn: [fp.slug, tp.slug] } },
      orderBy: { coastlineNm: "asc" },
    });
    const reeds = new Set(
      (await prisma.portArea.findMany({ where: { inReeds: true }, select: { slug: true } })).map((a) => a.slug),
    );
    const dists = alongRouteNm(
      { lat: fp.lat, lon: fp.lon }, { lat: tp.lat, lon: tp.lon },
      cand.map((p) => ({ lat: p.lat, lon: p.lon })),
    );
    refuges = cand
      .map((p, i) => ({
        name: p.name, slug: p.slug, type: p.type, dist: Math.round(dists[i]),
        berthCount: p.berthCount, maxDraft: p.maxDraft,
        fuel: p.fuel, water: p.water, repairs: p.repairs,
        showers: (p.marinaFacilities as { showers?: boolean } | null)?.showers ?? false,
        inReeds: reeds.has(p.slug), notes: p.notes,
      }))
      .sort((a, b) => a.dist - b.dist);
  }

  // The passage's boat, else the owner's default boat.
  const vessel =
    (passage.vesselProfileId
      ? await prisma.vesselProfile.findFirst({ where: { id: passage.vesselProfileId, ownerId: user.id } })
      : null) ?? (await defaultVessel(user.id));
  const boat = vessel?.name ?? "No boat yet";
  const boatModel = vessel?.model ?? "";

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
      refuges={refuges}
    />
  );
}
