/**
 * Seed per-port draft access from prisma/draft-data/*.json (sourced research).
 *
 * draftAccess classifies entry for a 2.0 m draft needing 0.5 m under-keel clearance
 * (i.e. ≥ 2.5 m at chart datum on the normal approach + berths, no bar):
 *   all-tide   — safe at any state of tide  → shown when the draft filter is on
 *   tide-gated — deep only near HW (bar/lagoon/river/sill)
 *   shallow    — a 2.0 m keel can't safely enter even near HW
 *   unknown    — no reliable controlling depth found
 * Conservative by design: when sources were unclear, ports were under-classified.
 *
 * Idempotent. Run: npx tsx prisma/draft-seed.ts
 */
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "draft-data");
const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

type Row = {
  slug: string;
  controllingDepthM: number | null;
  access: string;
  barOrLagoon?: boolean;
  note?: string;
  source?: string;
  confidence?: string;
  verifyNeeded?: boolean;
};

async function main() {
  const files = readdirSync(DATA_DIR).filter((f) => /^\d.*\.json$/.test(f)).sort();
  const rows: Row[] = [];
  for (const f of files) rows.push(...(JSON.parse(readFileSync(join(DATA_DIR, f), "utf8")) as Row[]));

  let n = 0, missing = 0;
  const counts: Record<string, number> = {};
  for (const r of rows) {
    counts[r.access] = (counts[r.access] || 0) + 1;
    const res = await prisma.portArea.updateMany({
      where: { slug: r.slug },
      data: {
        draftAccess: r.access,
        controllingDepthM: r.controllingDepthM,
        accessNote: r.note ?? null,
      },
    });
    if (res.count === 0) { console.warn("  slug not found:", r.slug); missing++; }
    else n += res.count;
  }
  console.log(`Draft seed: updated ${n}/${rows.length} ports (${missing} missing).`);
  console.log("access classes:", JSON.stringify(counts));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
