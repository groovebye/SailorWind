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
  /** Great-circle distance to the next port down the coast (nm); null for the last. */
  toNextNm: number | null;
  /** Curated principal hub — good for an overnight / 1-2 day rest & provisioning. */
  isMajor: boolean;
  /** Sourced entry classification for a 2.0 m draft (≥2.5 m all-tide). */
  draftAccess: string | null; // "all-tide" | "tide-gated" | "shallow" | "unknown"
  controllingDepthM: number | null;
  accessNote: string | null;
};

/** A Monsun 31 daysails comfortably to ~55 nm; longer hops imply a night passage. */
const OVERNIGHT_NM = 55;

/** Boat draft the access data is classified for. */
const DRAFT_M = 2.0;

const ACCESS_META: Record<string, { chip: string; label: string; color: string }> = {
  "all-tide": { chip: "✓", label: "all-tide", color: "var(--text-green)" },
  "tide-gated": { chip: "◑ HW", label: "near HW only", color: "var(--text-yellow)" },
  shallow: { chip: "✕", label: "too shallow", color: "var(--text-red)" },
  unknown: { chip: "?", label: "depth unverified", color: "var(--text-muted)" },
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

function AccessCell({
  access, depthM, note, className,
}: { access: string | null; depthM: number | null; note: string | null; className: string }) {
  const m = ACCESS_META[access ?? "unknown"] ?? ACCESS_META.unknown;
  return (
    <td className={`${className} whitespace-nowrap`} title={note ?? m.label}>
      <span style={{ color: m.color }}>{m.chip}</span>
      {depthM != null && (
        <span className="ml-1 text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>
          {depthM}m
        </span>
      )}
    </td>
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
  const [majorOnly, setMajorOnly] = useState(false);
  const [draftSafe, setDraftSafe] = useState(true);
  const query = q.trim().toLowerCase();
  const majorCount = useMemo(() => areas.filter((a) => a.isMajor).length, [areas]);
  const hiddenByDraft = useMemo(
    () => areas.filter((a) => a.draftAccess !== "all-tide").length,
    [areas],
  );

  // Number rows by their coast position before filtering, so "#" = sailing order.
  const indexed = useMemo(() => areas.map((a, i) => ({ ...a, order: i + 1 })), [areas]);
  const filtered = useMemo(() => {
    return indexed.filter(
      (a) =>
        (!majorOnly || a.isMajor) &&
        (!draftSafe || a.draftAccess === "all-tide") &&
        (!query ||
          a.name.toLowerCase().includes(query) ||
          (a.region ?? "").toLowerCase().includes(query)),
    );
  }, [indexed, query, majorOnly, draftSafe]);

  const th = "px-3 py-2 text-[11px] font-medium uppercase tracking-wide";
  const td = "px-3 py-2 align-middle";

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold text-slate-300">⚓ Ports &amp; Marinas</h2>
        <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
          {query || majorOnly || draftSafe
            ? `${filtered.length} of ${areas.length}`
            : `${areas.length} along the route`}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search ports — e.g. Vigo, Cascais, Cádiz, Algarve…"
          aria-label="Search ports by name"
          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            color: "var(--text-heading)",
          }}
        />
        <button
          type="button"
          onClick={() => setDraftSafe((v) => !v)}
          aria-pressed={draftSafe}
          title={`Show only harbours a ${DRAFT_M} m draft enters at any state of tide (≥2.5 m, no bar). Turn off to see every port with its access rating.`}
          className="px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors"
          style={{
            background: draftSafe ? "var(--text-green)" : "var(--bg-card)",
            border: "1px solid var(--border-light)",
            color: draftSafe ? "#0f172a" : "var(--text-secondary)",
            fontWeight: draftSafe ? 600 : 400,
          }}
        >
          ⚓ Draft {DRAFT_M} m{draftSafe ? ` · ${hiddenByDraft} hidden` : ""}
        </button>
        <button
          type="button"
          onClick={() => setMajorOnly((v) => !v)}
          aria-pressed={majorOnly}
          title="Show only the principal hubs — good for an overnight / 1-2 day rest"
          className="px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors"
          style={{
            background: majorOnly ? "var(--text-yellow)" : "var(--bg-card)",
            border: "1px solid var(--border-light)",
            color: majorOnly ? "#0f172a" : "var(--text-secondary)",
            fontWeight: majorOnly ? 600 : 400,
          }}
        >
          ★ Major{majorOnly ? "" : ` (${majorCount})`}
        </button>
      </div>

      <p className="text-[11px] mb-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        <span style={{ color: "var(--text-yellow)" }}>★</span> = principal hub (provisioning · overnight ·
        1–2 day rest).{" "}
        {draftSafe ? (
          <>
            Showing only harbours a <b>{DRAFT_M} m</b> draft enters at <b>any</b> tide (≥2.5 m, no bar);{" "}
            {hiddenByDraft} tide-gated / shallow / unverified hidden — turn off{" "}
            <span style={{ color: "var(--text-green)" }}>⚓ Draft</span> to see them with ratings.
          </>
        ) : (
          <>
            Access rating per port:{" "}
            <span style={{ color: "var(--text-green)" }}>✓ all-tide</span> ·{" "}
            <span style={{ color: "var(--text-yellow)" }}>◑ HW only</span> ·{" "}
            <span style={{ color: "var(--text-red)" }}>✕ too shallow</span> ·{" "}
            <span>? unverified</span> (for {DRAFT_M} m draft).
          </>
        )}
      </p>

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
                <th className={`${th} text-right`} title="Approx. distance to the next port along the coast">
                  → next
                </th>
                <th className={`${th} hidden sm:table-cell`}>Region</th>
                <th className={th}>Berths</th>
                {!draftSafe && <th className={th}>Access</th>}
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
                  style={{
                    borderColor: "var(--border-light)",
                    background: a.isMajor ? "rgba(250, 204, 21, 0.07)" : undefined,
                    boxShadow: a.isMajor ? "inset 3px 0 0 var(--text-yellow)" : undefined,
                  }}
                >
                  <td className={`${td} text-right tabular-nums text-xs`} style={{ color: "var(--text-muted)" }}>
                    {a.order}
                  </td>
                  <td className={`${td} whitespace-nowrap ${a.isMajor ? "font-bold" : "font-semibold"}`}>
                    {a.isMajor && (
                      <span aria-hidden className="mr-1" style={{ color: "var(--text-yellow)" }}>
                        ★
                      </span>
                    )}
                    <Link
                      href={`/port/${a.slug}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: "var(--text-heading)" }}
                    >
                      {a.name}
                    </Link>
                  </td>
                  <td
                    className={`${td} text-right whitespace-nowrap tabular-nums`}
                    title={a.toNextNm != null && a.toNextNm > OVERNIGHT_NM ? "Likely an overnight passage" : undefined}
                    style={{
                      color:
                        a.toNextNm == null
                          ? "var(--text-muted)"
                          : a.toNextNm > OVERNIGHT_NM
                            ? "var(--text-yellow)"
                            : "var(--text-secondary)",
                    }}
                  >
                    {a.toNextNm == null
                      ? "—"
                      : `${a.toNextNm < 1 ? "<1" : Math.round(a.toNextNm)} nm`}
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
                  {!draftSafe && (
                    <AccessCell
                      access={a.draftAccess}
                      depthM={a.controllingDepthM}
                      note={a.accessNote}
                      className={td}
                    />
                  )}
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
