/**
 * Sync the PortArea catalog into the Port table so the New-Passage picker (and
 * route builder, which use Port) can offer every catalogued point — incl. the
 * Reeds additions. Additive: skips any PortArea that already has a Port (by slug
 * or within 0.5 nm), so the existing curated north-coast Ports + capes are
 * untouched. coastlineNm = coastOrder (same scale the existing Ports use).
 * Idempotent. Run: npx tsx prisma/sync-ports.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { haversineNm } from "../src/lib/geo.js";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

function portType(area: { type: string | null; marinaCount: number }): "marina" | "port" | "anchorage" | "cape" {
  if (area.marinaCount > 0) return "marina";
  const t = (area.type || "").toLowerCase();
  if (t.includes("cape")) return "cape";
  if (t.includes("anchor")) return "anchorage";
  return "port";
}

function segment(coastOrder: number | null): string {
  const c = coastOrder ?? 0;
  if (c < 170) return "biscay-galicia-n";
  if (c < 360) return "galicia-w";
  if (c < 660) return "portugal";
  return "andalucia-algarve";
}

async function main() {
  const areas = await prisma.portArea.findMany({ include: { marinas: true } });
  const ports = await prisma.port.findMany({ select: { slug: true, lat: true, lon: true } });
  let created = 0, skipped = 0;

  for (const a of areas) {
    if (a.coastOrder == null) { skipped++; continue; }
    const dup = ports.find((p) => p.slug === a.slug || haversineNm([p.lat, p.lon], [a.lat, a.lon]) < 0.5);
    if (dup) { skipped++; continue; }

    const ms = a.marinas;
    const prim = ms[0];
    await prisma.port.create({
      data: {
        slug: a.slug, name: a.name, lat: a.lat, lon: a.lon,
        type: portType({ type: a.type, marinaCount: ms.length }),
        country: a.country, region: a.region,
        coastSegment: segment(a.coastOrder), coastlineNm: a.coastOrder,
        fuel: ms.some((m) => m.fuel), water: ms.some((m) => m.water),
        electric: ms.some((m) => m.electric), repairs: ms.some((m) => m.repairs),
        maxDraft: ms.length ? Math.max(0, ...ms.map((m) => m.maxDraft ?? 0)) || null : null,
        maxLength: ms.length ? Math.max(0, ...ms.map((m) => m.maxLength ?? 0)) || null : null,
        berthCount: ms.reduce((s, m) => s + (m.berthCount || 0), 0) || null,
        visitorBerths: ms.reduce((s, m) => s + (m.visitorBerths || 0), 0) || null,
        marinaName: prim?.name ?? null, vhfCh: prim?.vhfCh ?? null,
        phone: prim?.phone ?? null, website: prim?.website ?? null, email: prim?.email ?? null,
        orcaRisk: a.orcaRisk, approachDescription: a.approachNote, notes: a.accessNote ?? a.description ?? null,
      },
    });
    created++;
    console.log(`  + ${a.name} (${a.slug}) ${portType({ type: a.type, marinaCount: ms.length })} @ ${a.coastOrder}`);
  }
  const total = await prisma.port.count();
  console.log(`Sync: created ${created}, skipped ${skipped} (already present). Port table now: ${total}.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
