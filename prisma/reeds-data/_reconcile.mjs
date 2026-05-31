// Reconcile raw Reeds extraction against our catalog → produce the seed file + a report.
// Run: node prisma/reeds-data/_reconcile.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const DIR = "prisma/reeds-data";
const catalog = JSON.parse(readFileSync(`${DIR}/_catalog.json`, "utf8"));

let raw = [];
for (const f of readdirSync(`${DIR}/_raw`).filter((f) => f.endsWith(".json"))) {
  raw.push(...JSON.parse(readFileSync(`${DIR}/_raw/${f}`, "utf8")));
}
const harbours = raw.filter((h) => h.name && h.lat != null && h.lon != null);

const R = (d) => (d * Math.PI) / 180;
function nm(a, b) {
  const dLat = R(b[0] - a[0]), dLon = R(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(R(a[0])) * Math.cos(R(b[0])) * Math.sin(dLon / 2) ** 2;
  return 3440.065 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const STOP = new Set(["marina", "club", "nautico", "puerto", "deportivo", "port", "porto", "doca", "real", "rcn", "yacht", "ria", "harbour", "anchorage", "sport", "centro", "the", "and", "maritimo"]);
const tokens = (s) => new Set(norm(s).split(" ").filter((t) => t.length > 2 && !STOP.has(t)));
function nameClose(a, b) {
  const ta = tokens(a), tb = tokens(b);
  for (const t of ta) if (tb.has(t)) return true;
  return false;
}
function slugify(s) {
  return norm(s).replace(/\b(marina|puerto|deportivo|club|nautico|de|del|la|el|real|cn|rcn)\b/g, "").trim().replace(/\s+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || norm(s).replace(/\s+/g, "-");
}

// nearest catalog port for each harbour
const MATCH_NM = 6;
for (const h of harbours) {
  let best = null, bestD = Infinity;
  for (const c of catalog) { const d = nm([h.lat, h.lon], [c.lat, c.lon]); if (d < bestD) { bestD = d; best = c; } }
  h._match = bestD <= MATCH_NM ? best : null;
  h._dist = bestD;
}

// group by matched catalog slug
const groups = new Map();
const news = [];
for (const h of harbours) {
  if (h._match) {
    const k = h._match.slug;
    if (!groups.has(k)) groups.set(k, { cat: h._match, entries: [] });
    groups.get(k).entries.push(h);
  } else news.push(h);
}

const seed = [];
const report = { matched: [], created: [], multi: [] };

for (const [slug, g] of groups) {
  const cat = g.cat;
  // representative: prefer entry whose name matches the catalog name; then one with a WPT
  const named = g.entries.filter((e) => nameClose(e.name, cat.name) || (e.marina && nameClose(e.marina.name, cat.name)));
  const withWpt = g.entries.filter((e) => e.approachLat != null);
  const rep = named.find((e) => e.approachLat != null) || withWpt[0] || named[0] || g.entries[0];
  // approach WPT: any entry in the group that has one (ría entrance is shared)
  const wptSrc = g.entries.find((e) => e.approachLat != null) || rep;
  // marina enrichment: prefer the entry whose marina name matches the catalog marina, with a price
  const catMarina = cat.marinas[0]?.name;
  const priceSrc = g.entries.find((e) => e.marina?.perMeterEur != null && catMarina && nameClose(e.marina.name, catMarina))
    || g.entries.find((e) => e.marina?.perMeterEur != null && nameClose(e.marina.name, cat.name))
    || null;

  const entry = { slug, match: "update" };
  if (wptSrc.approachLat != null) {
    entry.approachLat = wptSrc.approachLat; entry.approachLon = wptSrc.approachLon;
    entry.approachNote = (wptSrc.approachNote || "").slice(0, 240) || null;
  }
  if (rep.shelter) entry.accessNote = rep.shelter.slice(0, 200);
  // only correct coords if the named representative differs notably (avoid drift from sub-marinas)
  if ((nameClose(rep.name, cat.name)) && nm([rep.lat, rep.lon], [cat.lat, cat.lon]) > 0.4) {
    entry.lat = rep.lat; entry.lon = rep.lon;
  }
  if (priceSrc && cat.marinas.length) {
    const m = priceSrc.marina;
    entry.marina = {
      maxLength: m.maxLength ?? null,
      vhfCh: m.vhfCh ?? null,
      perMeter: m.perMeterEur,
      daily9_5: Math.round(m.perMeterEur * 9.5),
      notes: `Reeds: ${m.notes || ""}${m.notes ? "; " : ""}€${m.perMeterEur}/m${m.maxLength ? `, max ${m.maxLength}m LOA` : ""}${m.vhfCh ? `, VHF Ch ${m.vhfCh}` : ""}.`.slice(0, 300),
    };
  }
  // skip pure no-op updates (no approach, no price, no coord, no shelter)
  if (entry.approachLat == null && !entry.marina && !entry.lat && !entry.accessNote) continue;
  seed.push(entry);
  report.matched.push(`${cat.name} (${slug}) ← ${g.entries.map((e) => e.name).join(", ")} [${g.entries[0]._dist.toFixed(1)}nm]${entry.approachLat ? " +WPT" : ""}${entry.marina ? ` +€${entry.marina.perMeter}/m` : ""}${entry.lat ? " +coords" : ""}`);
  if (g.entries.length > 1) report.multi.push(`${cat.name}: ${g.entries.length} Reeds marinas`);
}

const usedSlugs = new Set([...catalog.map((c) => c.slug), ...seed.map((s) => s.slug)]);
for (const h of news) {
  let slug = slugify(h.name);
  while (usedSlugs.has(slug)) slug += "-2";
  usedSlugs.add(slug);
  // coastOrder: borrow from nearest catalog port
  let near = null, nd = Infinity;
  for (const c of catalog) { const d = nm([h.lat, h.lon], [c.lat, c.lon]); if (d < nd) { nd = d; near = c; } }
  const e = {
    slug, match: "create", name: h.name.replace(/\s+(Marina|Anchorage)$/i, ""), type: h.type || "port",
    country: h.country || "Spain", region: h.region || near?.region || null,
    coastOrder: near?.coastOrder ?? null, lat: h.lat, lon: h.lon,
    approachLat: h.approachLat ?? null, approachLon: h.approachLon ?? null,
    approachNote: h.approachNote ? h.approachNote.slice(0, 240) : null,
    accessNote: h.shelter ? h.shelter.slice(0, 200) : null,
    draftAccess: h.type === "anchorage" ? "all-tide" : null,
    description: `${h.marina?.notes ? h.marina.notes + ". " : ""}Reeds ${h.reedsSection || ""}.`.trim(),
  };
  seed.push(e);
  report.created.push(`+ ${e.name} (${slug}) ${h.lat},${h.lon} ${e.type} [nearest ${near?.name} ${nd.toFixed(1)}nm]${e.approachLat ? " +WPT" : ""}`);
}

// catalog ports not touched by any Reeds match (awareness only — not deleting)
const touched = new Set(seed.filter((s) => s.match === "update").map((s) => s.slug));
const untouched = catalog.filter((c) => !touched.has(c.slug)).map((c) => c.name);

writeFileSync(`${DIR}/route-waypoints.json`, JSON.stringify({ _source: "Reeds Almanac full export (26pp), reconciled to catalog by nearest position", areas: seed }, null, 1));

console.log(`SEED: ${seed.filter((s) => s.match === "update").length} updates, ${seed.filter((s) => s.match === "create").length} creates → route-waypoints.json\n`);
console.log("── MATCHED (updates) ──"); report.matched.forEach((m) => console.log("  " + m));
console.log("\n── NEW (creates) ──"); report.created.forEach((m) => console.log("  " + m));
console.log(`\n── multi-marina rías: ${report.multi.length} ──`); report.multi.forEach((m) => console.log("  " + m));
console.log(`\n── catalog ports NOT in this Reeds export (${untouched.length}, kept as-is): ──\n  ${untouched.join(" · ")}`);
