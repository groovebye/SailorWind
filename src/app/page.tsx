import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const portAreas = await prisma.portArea.findMany({
    orderBy: { name: "asc" },
    include: {
      marinas: {
        include: {
          prices: { where: { loaMeters: 9.5, billingPeriod: "daily", season: "low" }, take: 1 },
        },
      },
    },
  });

  const passages = await prisma.passage.findMany({
    orderBy: { updatedAt: "desc" },
    take: 10,
    include: {
      waypoints: {
        include: { port: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-12">
        <h1 className="text-3xl font-bold text-blue-400 mb-2">
          &#9973; SailorWind
        </h1>
        <p className="text-slate-400">
          Weather-aware passage planner for sailing
        </p>
      </header>

      <Link
        href="/new"
        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold transition-colors mb-12"
      >
        + New Passage
      </Link>

      {passages.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-300 mb-4">
            Recent Passages
          </h2>
          <div className="space-y-3">
            {passages.map((p) => {
              const stops = p.waypoints.filter((w) => w.isStop);
              const first = stops[0]?.port.name ?? "?";
              const last = stops[stops.length - 1]?.port.name ?? "?";
              const dep = new Date(p.departure).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              return (
                <Link
                  key={p.id}
                  href={`/p/${p.shortId}`}
                  className="block bg-slate-800 border border-slate-800 rounded-lg p-4 hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-blue-400">
                        {p.name || `${first} → ${last}`}
                      </span>
                      <span className="text-slate-500 ml-3 text-sm">{dep}</span>
                    </div>
                    <span className="text-slate-600 text-sm">
                      {p.waypoints.length} waypoints
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Ports & Marinas catalog */}
      {portAreas.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-slate-300 mb-4">
            ⚓ Ports & Marinas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {portAreas.map((area) => {
              const totalBerths = area.marinas.reduce((s, m) => s + (m.berthCount || 0), 0);
              const cheapest = area.marinas.flatMap(m => m.prices).sort((a, b) => a.price - b.price)[0];
              return (
                <Link key={area.id} href={`/port/${area.slug}`}
                  className="block rounded-lg p-4 hover:opacity-80 transition-opacity"
                  style={{ background: "var(--bg-card)", border: `1px solid var(--border-light)` }}>
                  <div className="font-semibold text-sm" style={{ color: "var(--text-heading)" }}>{area.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {area.region} · {area.type.replace("_", " ")} · {area.marinas.length} marina{area.marinas.length > 1 ? "s" : ""}
                  </div>
                  <div className="flex gap-3 mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {totalBerths > 0 && <span>⚓ {totalBerths} berths</span>}
                    {cheapest && <span style={{ color: "var(--text-green)" }}>from €{cheapest.price}/day</span>}
                  </div>
                  {area.orcaRisk && area.orcaRisk !== "none" && area.orcaRisk !== "low" && (
                    <div className="text-[10px] mt-1" style={{ color: "var(--text-yellow)" }}>🐋 Orca: {area.orcaRisk}</div>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
