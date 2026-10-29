import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { LAKE_SEGMENTS, lakeCorridorNm, projectAlongRoute } from "@/lib/searoute";
import { crewPassage, passageVessel, requireUser } from "@/lib/auth/dal";
import PassageCockpit from "./_cockpit/PassageCockpit";

export const dynamic = "force-dynamic";

export default async function PassagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/p/${id}`);
  const passage = await prisma.passage.findFirst({
    where: crewPassage(id, user.id),
    include: {
      waypoints: { include: { port: true }, orderBy: { sortOrder: "asc" } },
      owner: { select: { name: true } },
      members: { orderBy: { createdAt: "asc" }, select: { user: { select: { id: true, name: true, email: true } } } },
    },
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
    // Coast: shelters between the endpoints by coastlineNm. Lake: shelters of the
    // same lake within a corridor either side of the routed line.
    const lake = fp.coastSegment === tp.coastSegment && LAKE_SEGMENTS.has(fp.coastSegment);
    const lo = Math.min(fp.coastlineNm, tp.coastlineNm);
    const hi = Math.max(fp.coastlineNm, tp.coastlineNm);
    const all = await prisma.port.findMany({
      where: {
        type: { not: "cape" },
        slug: { notIn: [fp.slug, tp.slug] },
        ...(lake ? { coastSegment: fp.coastSegment } : { coastlineNm: { gte: lo, lte: hi } }),
      },
      orderBy: { coastlineNm: "asc" },
    });
    const reeds = new Set(
      (await prisma.portArea.findMany({ where: { inReeds: true }, select: { slug: true } })).map((a) => a.slug),
    );
    const proj = projectAlongRoute(
      { lat: fp.lat, lon: fp.lon }, { lat: tp.lat, lon: tp.lon },
      all.map((p) => ({ lat: p.lat, lon: p.lon })),
    );
    const keep = all.map((_, i) =>
      !lake || (proj[i].off <= lakeCorridorNm(proj[i].total) && proj[i].along > 0 && proj[i].along < proj[i].total),
    );
    const cand = all.filter((_, i) => keep[i]);
    const dists = proj.filter((_, i) => keep[i]).map((p) => p.along);
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

  // The passage's boat (the owner's), else the owner's default boat.
  const vessel = await passageVessel(passage);
  const boat = vessel?.name ?? "No boat yet";
  const boatModel = vessel?.model ?? "";

  // Crew: emails are shown only to the owner (and to each member for themselves).
  const isOwner = passage.ownerId === user.id;
  const crew = {
    isOwner,
    owner: { name: passage.owner?.name ?? "Owner" },
    members: passage.members.map(({ user: m }) => ({
      id: m.id, name: m.name, email: isOwner || m.id === user.id ? m.email : null, isMe: m.id === user.id,
    })),
  };

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
      departure={passage.departure.toISOString()}
      wps={wps}
      refuges={refuges}
      crew={crew}
    />
  );
}
