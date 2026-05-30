"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

/** Lean card shape — derived fields are computed server-side in page.tsx. */
export type PortCard = {
  id: string;
  name: string;
  slug: string;
  region: string | null;
  type: string;
  marinaCount: number;
  berths: number;
  cheapest: number | null;
  fuel: boolean;
  repairs: boolean;
  recommended: number;
  orcaRisk: string | null;
};

/**
 * Ports & Marinas catalog: compact grid kept in coast order (as you sail toward
 * Gibraltar) with a live name/region filter on top. Order is set server-side and
 * preserved here, since Array.filter is stable.
 */
export default function PortsCatalog({ areas }: { areas: PortCard[] }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!query) return areas;
    return areas.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        (a.region ?? "").toLowerCase().includes(query),
    );
  }, [areas, query]);

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold text-slate-300">⚓ Ports &amp; Marinas</h2>
        <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
          {query ? `${filtered.length} of ${areas.length}` : `${areas.length} along the route`}
        </span>
      </div>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search ports — e.g. Vigo, Cascais, Cádiz, Algarve…"
        aria-label="Search ports by name"
        className="w-full mb-4 px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          color: "var(--text-heading)",
        }}
      />

      {filtered.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
          No ports match “{q.trim()}”.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {filtered.map((area) => (
            <Link
              key={area.id}
              href={`/port/${area.slug}`}
              className="block rounded-lg p-3 hover:opacity-80 transition-opacity"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
            >
              <div
                className="font-semibold text-sm leading-snug"
                style={{ color: "var(--text-heading)" }}
              >
                {area.name}
              </div>
              <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                {area.region}
              </div>
              <div className="text-[11px] mt-1" style={{ color: "var(--text-secondary)" }}>
                {area.marinaCount > 0
                  ? `${area.marinaCount} marina${area.marinaCount > 1 ? "s" : ""} · ${area.berths} berths`
                  : area.type === "anchorage"
                    ? "⚓ anchorage"
                    : area.type === "cape"
                      ? "🗻 cape"
                      : "refuge"}
              </div>
              <div
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-[11px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {area.cheapest != null && (
                  <span style={{ color: "var(--text-green)" }}>€{area.cheapest}/day</span>
                )}
                {area.fuel && <span title="Fuel">⛽</span>}
                {area.repairs && <span title="Repairs">🔧</span>}
                {area.recommended > 0 && <span title="Recommended places">⭐ {area.recommended}</span>}
                {area.orcaRisk && area.orcaRisk !== "none" && area.orcaRisk !== "low" && (
                  <span title={`Orca risk: ${area.orcaRisk}`} style={{ color: "var(--text-yellow)" }}>
                    🐋
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
