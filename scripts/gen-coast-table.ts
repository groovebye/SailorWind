/**
 * Assemble the La Coruña -> Gibraltar coast table-list.
 *
 * Reads the route-ordered region datasets in prisma/coast-data/*.json,
 * concatenates them in coastline order, derives a continuous `coastlineNm`
 * ordering key (cumulative great-circle distance from La Coruña = 160, using the
 * project's single geo helper), validates each record, and writes:
 *   - COAST-TABLE.md  (human-readable: overview table + full per-port detail)
 *
 * Run:  npx tsx scripts/gen-coast-table.ts
 *
 * Note: coastlineNm here is an ORDERING key (straight-line cumulative). Real leg
 * distances come from resolved route geometry (see P2). Safety-critical fields
 * carry `confidence` + `sources`; `verifyNeeded` lists chart cross-checks.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { haversineNm, type LatLon } from "../src/lib/geo.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "prisma", "coast-data");
const OUT = join(__dirname, "..", "COAST-TABLE.md");

// La Coruña is the last port of the existing northern list.
const LA_CORUNA: LatLon = [43.37, -8.4];
const LA_CORUNA_NM = 160;

type Entry = {
  name: string; type: string; lat: number; lon: number;
  region: string; country?: string;
  vhfCh?: string | number | null; phone?: string | null; email?: string | null; website?: string | null;
  fuel?: boolean | null; water?: boolean | null; electric?: boolean | null; repairs?: boolean | null; customs?: boolean | null;
  showers?: boolean | null; laundry?: boolean | null; wifi?: boolean | null;
  shelter?: string | null; maxDraft?: number | null; maxLength?: number | null;
  berthCount?: number | null; visitorBerths?: number | null; marinaHours?: string | null;
  approachNotes?: string | null; swellSensitivity?: string | null; bestTideEntry?: string | null;
  nearestTown?: string | null; notes?: string | null;
  orcaRisk?: string | null; orcaNotes?: string | null;
  sources?: string[]; confidence?: string; verifyNeeded?: string[];
  coastlineNm?: number | null;
};

function loadRegions(): Entry[] {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort();
  const all: Entry[] = [];
  for (const f of files) {
    const raw = readFileSync(join(DATA_DIR, f), "utf8");
    let parsed: Entry[];
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Invalid JSON in ${f}: ${(e as Error).message}`);
    }
    if (!Array.isArray(parsed)) throw new Error(`${f} is not a JSON array`);
    console.log(`  ${f}: ${parsed.length} entries`);
    all.push(...parsed);
  }
  return all;
}

/** Derive cumulative coastlineNm (ordering key) from La Coruña through the list. */
function deriveCoastlineNm(entries: Entry[]): void {
  let prev: LatLon = LA_CORUNA;
  let cum = LA_CORUNA_NM;
  for (const e of entries) {
    cum += haversineNm(prev, [e.lat, e.lon]);
    e.coastlineNm = Math.round(cum * 10) / 10;
    prev = [e.lat, e.lon];
  }
}

const flag = (v: boolean | null | undefined, ch: string) => (v ? ch : "·");
const num = (v: number | null | undefined) => (v == null ? "—" : String(v));
const orcaMark = (r: string | null | undefined) =>
  r === "high" ? "🔴" : r === "medium" ? "🟠" : r === "low" ? "🟡" : "—";

function buildMarkdown(entries: Entry[]): string {
  const lines: string[] = [];
  lines.push("# Coast Table-List — La Coruña → Gibraltar");
  lines.push("");
  lines.push(`Generated from \`prisma/coast-data/*.json\`. **${entries.length} entries** in route order ` +
    "(Galicia → Portugal → Gulf of Cádiz → Strait of Gibraltar), continuing the northern list (La Coruña = 160 NM).");
  lines.push("");
  lines.push("`coastlineNm` is an **ordering key** (cumulative great-circle from La Coruña); real leg distances come from resolved route geometry. " +
    "Facilities: **F**uel · **W**ater · **E**lectric · **R**epairs · **C**ustoms. Orca: 🔴 high · 🟠 medium · 🟡 low. " +
    "⚠️ Safety-critical fields (entrance depths, bars, VHF) must be cross-checked against official charts — see each port's `verifyNeeded`.");
  lines.push("");

  // Overview table
  lines.push("| # | NM | Port | Type | Region | Lat | Lon | VHF | FWERC | Draft | LOA | Berths (vis) | Shelter | Orca | Conf |");
  lines.push("|--:|--:|------|------|--------|----:|----:|----|:----:|---:|---:|---|----|:--:|----|");
  entries.forEach((e, i) => {
    const fac = flag(e.fuel, "F") + flag(e.water, "W") + flag(e.electric, "E") + flag(e.repairs, "R") + flag(e.customs, "C");
    const berths = `${num(e.berthCount)}${e.visitorBerths != null ? ` (${e.visitorBerths})` : ""}`;
    lines.push(`| ${i + 1} | ${num(e.coastlineNm)} | ${e.name} | ${e.type} | ${e.region} | ${e.lat.toFixed(4)} | ${e.lon.toFixed(4)} | ${e.vhfCh ?? "—"} | ${fac} | ${num(e.maxDraft)} | ${num(e.maxLength)} | ${berths} | ${e.shelter ?? "—"} | ${orcaMark(e.orcaRisk)} | ${e.confidence ?? "—"} |`);
  });
  lines.push("");

  // Per-port detail
  lines.push("---");
  lines.push("");
  lines.push("## Port detail");
  lines.push("");
  entries.forEach((e, i) => {
    lines.push(`### ${i + 1}. ${e.name}  \`${num(e.coastlineNm)} NM\``);
    lines.push(`*${e.type} · ${e.region}${e.country ? ` · ${e.country}` : ""} · ${e.lat.toFixed(4)}, ${e.lon.toFixed(4)} · confidence: ${e.confidence ?? "—"}*`);
    lines.push("");
    const contact: string[] = [];
    if (e.vhfCh) contact.push(`VHF ${e.vhfCh}`);
    if (e.phone) contact.push(e.phone);
    if (e.email) contact.push(e.email);
    if (e.website) contact.push(e.website);
    if (contact.length) lines.push(`- **Contact:** ${contact.join(" · ")}`);
    const fac = `Fuel ${e.fuel ? "✓" : "✗"} · Water ${e.water ? "✓" : "✗"} · Electric ${e.electric ? "✓" : "✗"} · Repairs ${e.repairs ? "✓" : "✗"} · Customs ${e.customs ? "✓" : "✗"}` +
      `${e.showers != null ? ` · Showers ${e.showers ? "✓" : "✗"}` : ""}${e.laundry != null ? ` · Laundry ${e.laundry ? "✓" : "✗"}` : ""}${e.wifi != null ? ` · WiFi ${e.wifi ? "✓" : "✗"}` : ""}`;
    lines.push(`- **Facilities:** ${fac}`);
    lines.push(`- **Berths:** ${num(e.berthCount)}${e.visitorBerths != null ? ` (${e.visitorBerths} visitor)` : ""} · max draft ${num(e.maxDraft)} m · max LOA ${num(e.maxLength)} m · shelter ${e.shelter ?? "—"}`);
    if (e.marinaHours) lines.push(`- **Hours:** ${e.marinaHours}`);
    if (e.approachNotes) lines.push(`- **Approach:** ${e.approachNotes}`);
    if (e.swellSensitivity) lines.push(`- **Swell:** ${e.swellSensitivity}`);
    if (e.bestTideEntry) lines.push(`- **Best tide entry:** ${e.bestTideEntry}`);
    if (e.orcaRisk) lines.push(`- **Orca:** ${orcaMark(e.orcaRisk)} ${e.orcaRisk}${e.orcaNotes ? ` — ${e.orcaNotes}` : ""}`);
    if (e.nearestTown) lines.push(`- **Ashore:** ${e.nearestTown}`);
    if (e.notes) lines.push(`- **Notes:** ${e.notes}`);
    if (e.verifyNeeded?.length) lines.push(`- **⚠️ Verify:** ${e.verifyNeeded.join("; ")}`);
    if (e.sources?.length) lines.push(`- **Sources:** ${e.sources.map((s) => `<${s}>`).join(" · ")}`);
    lines.push("");
  });

  return lines.join("\n");
}

console.log("Loading region datasets:");
const entries = loadRegions();
deriveCoastlineNm(entries);

// Summary stats
const byType = entries.reduce<Record<string, number>>((m, e) => ((m[e.type] = (m[e.type] ?? 0) + 1), m), {});
const byConf = entries.reduce<Record<string, number>>((m, e) => ((m[e.confidence ?? "?"] = (m[e.confidence ?? "?"] ?? 0) + 1), m), {});
const highOrca = entries.filter((e) => e.orcaRisk === "high").length;

writeFileSync(OUT, buildMarkdown(entries), "utf8");

console.log(`\nTotal entries: ${entries.length}`);
console.log(`By type: ${JSON.stringify(byType)}`);
console.log(`By confidence: ${JSON.stringify(byConf)}`);
console.log(`High orca-risk entries: ${highOrca}`);
console.log(`coastlineNm range: ${entries[0]?.coastlineNm} … ${entries[entries.length - 1]?.coastlineNm}`);
console.log(`Wrote ${OUT}`);
