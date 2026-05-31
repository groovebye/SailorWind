"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

function Tag({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[10px] leading-none whitespace-nowrap"
      style={{
        background: "var(--bg-input)",
        color: tone === "warn" ? "var(--text-yellow)" : "var(--text-secondary)",
      }}
    >
      {children}
    </span>
  );
}

/**
 * Ports & Marinas: a compact table kept in coast order (as you sail toward
 * Gibraltar) with a live name/region filter on top. The "#" column is the true
 * sailing position, so it stays stable when the list is filtered. Whole rows are
 * clickable; the port name is also a real link for keyboard / open-in-new-tab.
 */
export default function PortsCatalog({ areas }: { areas: PortCard[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  // Number rows by their coast position before filtering, so "#" = sailing order.
  const indexed = useMemo(() => areas.map((a, i) => ({ ...a, order: i + 1 })), [areas]);
  const filtered = useMemo(() => {
    if (!query) return indexed;
    return indexed.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        (a.region ?? "").toLowerCase().includes(query),
    );
  }, [indexed, query]);

  const th = "px-3 py-2 text-[11px] font-medium uppercase tracking-wide";
  const td = "px-3 py-2 align-middle";

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
        <div
          className="overflow-x-auto rounded-lg"
          style={{ border: "1px solid var(--border-light)" }}
        >
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left" style={{ color: "var(--text-muted)" }}>
                <th className={`${th} text-right`}>#</th>
                <th className={th}>Port</th>
                <th className={`${th} hidden sm:table-cell`}>Region</th>
                <th className={th}>Berths</th>
                <th className={`${th} text-right`}>€/day</th>
                <th className={th}>Facilities</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => router.push(`/port/${a.slug}`)}
                  className="cursor-pointer border-t hover:bg-slate-800/50 transition-colors"
                  style={{ borderColor: "var(--border-light)" }}
                >
                  <td className={`${td} text-right tabular-nums text-xs`} style={{ color: "var(--text-muted)" }}>
                    {a.order}
                  </td>
                  <td className={`${td} font-semibold whitespace-nowrap`}>
                    <Link
                      href={`/port/${a.slug}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: "var(--text-heading)" }}
                    >
                      {a.name}
                    </Link>
                  </td>
                  <td className={`${td} hidden sm:table-cell`} style={{ color: "var(--text-muted)" }}>
                    {a.region}
                  </td>
                  <td className={`${td} whitespace-nowrap tabular-nums`} style={{ color: "var(--text-secondary)" }}>
                    {a.marinaCount > 0 ? (
                      <>
                        {a.berths || "—"}
                        {a.marinaCount > 1 && (
                          <span style={{ color: "var(--text-muted)" }}> ·{a.marinaCount}m</span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>
                        {a.type === "anchorage" ? "anchorage" : a.type === "cape" ? "cape" : "refuge"}
                      </span>
                    )}
                  </td>
                  <td
                    className={`${td} text-right whitespace-nowrap tabular-nums`}
                    style={{ color: a.cheapest != null ? "var(--text-green)" : "var(--text-muted)" }}
                  >
                    {a.cheapest != null ? `€${a.cheapest}` : "—"}
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1">
                      {a.fuel && <Tag>fuel</Tag>}
                      {a.repairs && <Tag>repair</Tag>}
                      {a.recommended > 0 && <Tag>★{a.recommended}</Tag>}
                      {a.orcaRisk && a.orcaRisk !== "none" && a.orcaRisk !== "low" && (
                        <Tag tone="warn">orca {a.orcaRisk}</Tag>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
