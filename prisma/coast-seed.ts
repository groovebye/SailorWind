/**
 * Seed the La Coruña -> Gibraltar coast into PortArea (+ one MarinaOption each)
 * and assign `coastOrder` so the catalog sorts as you sail south to Gibraltar.
 *
 * - Reads the route-ordered datasets in prisma/coast-data/*.json.
 * - Derives coastOrder = cumulative great-circle distance from La Coruña (=160),
 *   which is strictly increasing in route order (so sorting reproduces it).
 * - Upserts each entry as a PortArea; marina/port entries also get one
 *   MarinaOption (anchorages/capes are berth-less).
 * - Backfills coastOrder for the EXISTING northern PortAreas from the matching
 *   Port.coastlineNm (by slug, else nearest Port).
 *
 * Idempotent (upsert by slug). Run: npx tsx prisma/coast-seed.ts
 */
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { haversineNm, type LatLon } from "../src/lib/geo.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "coast-data");
const LA_CORUNA: LatLon = [43.37, -8.4];
const LA_CORUNA_NM = 160;

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

type Entry = {
  name: string; type: string; lat: number; lon: number; region: string; country?: string;
  vhfCh?: string | number | null; phone?: string | null; email?: string | null; website?: string | null;
  fuel?: boolean | null; water?: boolean | null; electric?: boolean | null; repairs?: boolean | null; customs?: boolean | null;
  showers?: boolean | null; laundry?: boolean | null; wifi?: boolean | null;
  shelter?: string | null; maxDraft?: number | null; maxLength?: number | null;
  berthCount?: number | null; visitorBerths?: number | null; marinaHours?: string | null;
  approachNotes?: string | null; swellSensitivity?: string | null; bestTideEntry?: string | null;
  nearestTown?: string | null; notes?: string | null;
  orcaRisk?: string | null; orcaNotes?: string | null;
  coastOrder?: number;
};

function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function loadEntries(): Entry[] {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort();
  const all: Entry[] = [];
  for (const f of files) all.push(...(JSON.parse(readFileSync(join(DATA_DIR, f), "utf8")) as Entry[]));
  let prev: LatLon = LA_CORUNA, cum = LA_CORUNA_NM;
  for (const e of all) { cum += haversineNm(prev, [e.lat, e.lon]); e.coastOrder = Math.round(cum * 10) / 10; prev = [e.lat, e.lon]; }
  return all;
}

const marinaKind = (t: string) => (t === "marina" ? "marina" : t === "port" ? "mixed_port" : "marina");
const b = (v: boolean | null | undefined) => v === true;

async function main() {
  const entries = loadEntries();
  let areaCount = 0, marinaCount = 0;

  for (const e of entries) {
    const slug = slugify(e.name);
    const area = await prisma.portArea.upsert({
      where: { slug },
      update: {
        name: e.name, country: e.country ?? "ES", region: e.region, lat: e.lat, lon: e.lon,
        type: e.type, coastOrder: e.coastOrder, orcaRisk: e.orcaRisk ?? null, orcaNotes: e.orcaNotes ?? null,
        description: e.notes ?? null, arrivalSummary: e.approachNotes ?? null, shoreSummary: e.nearestTown ?? null,
      },
      create: {
        slug, name: e.name, country: e.country ?? "ES", region: e.region, lat: e.lat, lon: e.lon,
        type: e.type, coastOrder: e.coastOrder, orcaRisk: e.orcaRisk ?? null, orcaNotes: e.orcaNotes ?? null,
        description: e.notes ?? null, arrivalSummary: e.approachNotes ?? null, shoreSummary: e.nearestTown ?? null,
      },
    });
    areaCount++;

    // Marina/port entries get one MarinaOption; anchorages/capes are berth-less.
    if (e.type === "marina" || e.type === "port") {
      const mSlug = `${slug}-marina`;
      await prisma.marinaOption.upsert({
        where: { slug: mSlug },
        update: {
          portAreaId: area.id, name: e.name, kind: marinaKind(e.type), lat: e.lat, lon: e.lon,
          website: e.website ?? null, email: e.email ?? null, phone: e.phone ?? null, vhfCh: e.vhfCh != null ? String(e.vhfCh) : null,
          shelter: e.shelter ?? null, maxDraft: e.maxDraft ?? null, maxLength: e.maxLength ?? null,
          berthCount: e.berthCount ?? null, visitorBerths: e.visitorBerths ?? null,
          fuel: b(e.fuel), water: b(e.water), electric: b(e.electric), repairs: b(e.repairs), customs: b(e.customs),
          laundry: b(e.laundry), showers: b(e.showers), wifi: b(e.wifi),
          marinaHours: e.marinaHours ?? null, approachDescription: e.approachNotes ?? null,
          swellSensitivity: e.swellSensitivity ?? null, bestTideEntry: e.bestTideEntry ?? null, notes: e.notes ?? null,
        },
        create: {
          portAreaId: area.id, slug: mSlug, name: e.name, kind: marinaKind(e.type), lat: e.lat, lon: e.lon,
          website: e.website ?? null, email: e.email ?? null, phone: e.phone ?? null, vhfCh: e.vhfCh != null ? String(e.vhfCh) : null,
          shelter: e.shelter ?? null, maxDraft: e.maxDraft ?? null, maxLength: e.maxLength ?? null,
          berthCount: e.berthCount ?? null, visitorBerths: e.visitorBerths ?? null,
          fuel: b(e.fuel), water: b(e.water), electric: b(e.electric), repairs: b(e.repairs), customs: b(e.customs),
          laundry: b(e.laundry), showers: b(e.showers), wifi: b(e.wifi),
          marinaHours: e.marinaHours ?? null, approachDescription: e.approachNotes ?? null,
          swellSensitivity: e.swellSensitivity ?? null, bestTideEntry: e.bestTideEntry ?? null, notes: e.notes ?? null,
        },
      });
      marinaCount++;
    }
  }

  // Backfill coastOrder for existing PortAreas without one (the northern set).
  const ports = await prisma.port.findMany({ select: { slug: true, lat: true, lon: true, coastlineNm: true } });
  const noOrder = await prisma.portArea.findMany({ where: { coastOrder: null }, select: { id: true, slug: true, lat: true, lon: true } });
  let backfilled = 0;
  for (const a of noOrder) {
    const exact = ports.find((p) => p.slug === a.slug);
    let nm: number;
    if (exact) nm = exact.coastlineNm;
    else {
      let best = ports[0], bestD = Infinity;
      for (const p of ports) { const d = haversineNm([a.lat, a.lon], [p.lat, p.lon]); if (d < bestD) { bestD = d; best = p; } }
      nm = best?.coastlineNm ?? 0;
    }
    await prisma.portArea.update({ where: { id: a.id }, data: { coastOrder: nm } });
    backfilled++;
  }

  const total = await prisma.portArea.count();
  console.log(`Coast seed: upserted ${areaCount} port areas (+${marinaCount} marinas). Backfilled coastOrder for ${backfilled} existing areas.`);
  console.log(`Total PortAreas now: ${total}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
