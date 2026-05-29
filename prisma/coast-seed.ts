/**
 * Seed La Coruña -> Gibraltar into PortArea (+ MarinaOptions), GROUPED BY CITY,
 * and assign `coastOrder` so the catalog sorts as you sail south to Gibraltar.
 *
 * - Reads the route-ordered datasets in prisma/coast-data/*.json.
 * - coastOrder = cumulative great-circle distance from La Coruña (=160),
 *   strictly increasing in route order (sorting reproduces it).
 * - Multi-marina cities (Vigo, Baiona, Lisboa, Cádiz, El Puerto, Gibraltar, …)
 *   collapse into ONE PortArea with several MarinaOptions; everything else stays
 *   1:1. Anchorages/capes are berth-less PortAreas.
 * - Re-seed is DESTRUCTIVE for coast areas only: deletes PortAreas with
 *   coastOrder >= 170 (cascades their marinas) and recreates them. The northern
 *   base ports (Gijón..La Coruña, coastOrder 0..160) are never touched; their
 *   coastOrder is backfilled from the matching Port.coastlineNm.
 *
 * Idempotent. Run: npx tsx prisma/coast-seed.ts
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
const COAST_ORDER_FLOOR = 170; // PortAreas at/above this are coast-seeded (deletable)

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

// Entries that belong to one city (cleaner than a card per marina).
const CITY_GROUPS: Record<string, { slug: string; name: string }> = {
  "Nauta Sanxenxo (Puerto Deportivo Juan Carlos I)": { slug: "sanxenxo", name: "Sanxenxo / Portonovo" },
  "Club Nautico de Portonovo": { slug: "sanxenxo", name: "Sanxenxo / Portonovo" },
  "Real Club Nautico de Vigo": { slug: "vigo", name: "Vigo" },
  "Marina Davila Sport (Vigo / Bouzas)": { slug: "vigo", name: "Vigo" },
  "Marina Punta Lagoa (Vigo / Teis)": { slug: "vigo", name: "Vigo" },
  "Liceo Maritimo de Bouzas (Vigo)": { slug: "vigo", name: "Vigo" },
  "Monte Real Club de Yates de Baiona (MRCYB)": { slug: "baiona", name: "Baiona" },
  "Puerto Deportivo de Baiona": { slug: "baiona", name: "Baiona" },
  "Doca do Bom Sucesso (Belem)": { slug: "lisboa", name: "Lisboa (Tejo)" },
  "Doca de Belem (Porto de Lisboa)": { slug: "lisboa", name: "Lisboa (Tejo)" },
  "Doca de Alcantara (Porto de Lisboa)": { slug: "lisboa", name: "Lisboa (Tejo)" },
  "Marina Parque das Nacoes (Lisbon East)": { slug: "lisboa", name: "Lisboa (Tejo)" },
  "Puerto Sherry": { slug: "el-puerto-de-santa-maria", name: "El Puerto de Santa Maria" },
  "Real Club Nautico El Puerto de Santa Maria": { slug: "el-puerto-de-santa-maria", name: "El Puerto de Santa Maria" },
  "Marina Puerto America (Cadiz)": { slug: "cadiz", name: "Cadiz" },
  "Real Club Nautico de Cadiz": { slug: "cadiz", name: "Cadiz" },
  "Queensway Quay Marina, Gibraltar": { slug: "gibraltar", name: "Gibraltar" },
  "Ocean Village Marina, Gibraltar": { slug: "gibraltar", name: "Gibraltar" },
  "Marina Bay, Gibraltar": { slug: "gibraltar", name: "Gibraltar" },
};

function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

// Display the town, not the marina/club name, on the catalog card.
const NAME_PREFIXES = [
  /^real club n[aá]utico de /i, /^real club n[aá]utico /i,
  /^club n[aá]utico deportivo de /i, /^club n[aá]utico de /i, /^club n[aá]utico /i,
  /^puerto pesquero y deportivo de /i, /^puerto deportivo de /i, /^puerto deportivo /i,
  /^porto deportivo de /i, /^porto de recreio do /i, /^porto de recreio de /i,
  /^nucleo de recreio do porto da /i, /^doca de recreio das /i,
  /^marina d[aeo] /i, /^marina /i, /^puerto de /i, /^porto de /i, /^nauta /i,
];
// Explicit overrides where the town sits inside the parenthetical / club name.
const NAME_OVERRIDES: Record<string, string> = {
  "Club Nautico do Caraminal (A Pobra do Caraminal)": "A Pobra do Caraminal",
  "Marina Arousa (Vilanova de Arousa)": "Vilanova de Arousa",
  "Club Nautico San Vicente do Mar (O Grove)": "O Grove",
  "Marina Clube da Gafanha (Aveiro / Barra)": "Aveiro",
  "Marina Clube Naval de Sesimbra": "Sesimbra",
  "Doca de Recreio das Fontainhas (Setubal)": "Setubal",
  "Marina Porto Atlantico (Leixoes)": "Leixoes",
  "Marina da Povoa de Varzim": "Povoa de Varzim",
  "Douro Marina (Marina da Afurada)": "Vila Nova de Gaia",
  "Alcaidesa Marina (La Linea)": "La Linea",
  "Porto de Baleeira (Sagres fishing harbour)": "Sagres (Baleeira)",
};
function cleanCityName(raw: string): string {
  if (NAME_OVERRIDES[raw]) return NAME_OVERRIDES[raw];
  let s = raw.replace(/\s*\(.*?\)\s*/g, " ").split(/\s+\/\s+/)[0].replace(/\s+-\s+.*$/, "").trim();
  for (const p of NAME_PREFIXES) { const t = s.replace(p, "").trim(); if (t !== s) { s = t; break; } }
  return s.length >= 3 ? s : raw;
}

function loadEntries(): Entry[] {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort();
  const all: Entry[] = [];
  for (const f of files) all.push(...(JSON.parse(readFileSync(join(DATA_DIR, f), "utf8")) as Entry[]));
  let prev: LatLon = LA_CORUNA, cum = LA_CORUNA_NM;
  for (const e of all) { cum += haversineNm(prev, [e.lat, e.lon]); e.coastOrder = Math.round(cum * 10) / 10; prev = [e.lat, e.lon]; }
  return all;
}

const cityOf = (e: Entry) => CITY_GROUPS[e.name] ?? { slug: slugify(e.name), name: cleanCityName(e.name) };
const isMarina = (e: Entry) => e.type === "marina" || e.type === "port";
const marinaKind = (t: string) => (t === "port" ? "mixed_port" : "marina");
const b = (v: boolean | null | undefined) => v === true;
const ORCA_RANK: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3 };

async function main() {
  const entries = loadEntries();

  // Group entries by city.
  const cities = new Map<string, { name: string; entries: Entry[] }>();
  for (const e of entries) {
    const c = cityOf(e);
    if (!cities.has(c.slug)) cities.set(c.slug, { name: c.name, entries: [] });
    cities.get(c.slug)!.entries.push(e);
  }

  // Destructive (coast areas only): drop and recreate.
  const del = await prisma.portArea.deleteMany({ where: { coastOrder: { gte: COAST_ORDER_FLOOR } } });

  let areaCount = 0, marinaCount = 0;
  for (const [slug, city] of cities) {
    const es = city.entries;
    const rep = es[0]; // earliest in route order
    const coastOrder = Math.min(...es.map((e) => e.coastOrder ?? 0));
    const orca = es.map((e) => e.orcaRisk).filter(Boolean)
      .sort((a, b2) => (ORCA_RANK[b2!] ?? 0) - (ORCA_RANK[a!] ?? 0))[0] ?? null;
    const marinasInCity = es.filter(isMarina);

    const area = await prisma.portArea.create({
      data: {
        slug, name: city.name, country: rep.country ?? "ES", region: rep.region,
        lat: rep.lat, lon: rep.lon, type: marinasInCity.length ? "marina" : rep.type,
        coastOrder, orcaRisk: orca, orcaNotes: es.find((e) => e.orcaNotes)?.orcaNotes ?? null,
        description: es.length > 1
          ? `${marinasInCity.length} marinas/harbours in ${city.name}.`
          : rep.notes ?? null,
        arrivalSummary: rep.approachNotes ?? null,
        shoreSummary: rep.nearestTown ?? null,
      },
    });
    areaCount++;

    for (const e of marinasInCity) {
      await prisma.marinaOption.create({
        data: {
          portAreaId: area.id, slug: `${slugify(e.name)}-marina`, name: e.name,
          kind: marinaKind(e.type), lat: e.lat, lon: e.lon,
          website: e.website ?? null, email: e.email ?? null, phone: e.phone ?? null,
          vhfCh: e.vhfCh != null ? String(e.vhfCh) : null,
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

  // Backfill coastOrder for the northern base PortAreas (from matching Port).
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
  console.log(`Coast seed (grouped): deleted ${del.count} old coast areas; created ${areaCount} city areas (+${marinaCount} marinas). Backfilled ${backfilled} northern areas.`);
  console.log(`Total PortAreas now: ${total}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
