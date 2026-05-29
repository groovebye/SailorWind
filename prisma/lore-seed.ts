/**
 * Seed Voyage Companion points of interest from prisma/lore-data/*.json.
 * Idempotent (upsert by slug). Run: npx tsx prisma/lore-seed.ts
 */
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "lore-data");
const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

type Poi = {
  type: string; name: string; title: string; body: string;
  lat: number; lon: number; radiusNm?: number; year?: number | null; era?: string | null;
  region?: string | null; imageUrl?: string | null; imageCredit?: string | null;
  sourceUrl?: string | null; confidence?: string | null;
};

function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

async function main() {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort();
  const all: Poi[] = [];
  for (const f of files) all.push(...(JSON.parse(readFileSync(join(DATA_DIR, f), "utf8")) as Poi[]));

  let n = 0;
  const seen = new Set<string>();
  for (const p of all) {
    let slug = slugify(p.name);
    // de-dup slugs across regions (e.g. two "Henry the Navigator" / "Iberian Orca")
    if (seen.has(slug)) slug = `${slug}-${slugify(p.region ?? "x")}`.slice(0, 90);
    seen.add(slug);
    const data = {
      type: p.type, name: p.name, title: p.title, body: p.body,
      lat: p.lat, lon: p.lon, radiusNm: p.radiusNm ?? 10,
      year: p.year ?? null, era: p.era ?? null, region: p.region ?? null,
      imageUrl: p.imageUrl ?? null, imageCredit: p.imageCredit ?? null,
      sourceUrl: p.sourceUrl ?? null, confidence: p.confidence ?? null,
    };
    await prisma.pointOfInterest.upsert({ where: { slug }, update: data, create: { slug, ...data } });
    n++;
  }
  const total = await prisma.pointOfInterest.count();
  console.log(`Lore seed: upserted ${n} POIs. Total now: ${total}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
