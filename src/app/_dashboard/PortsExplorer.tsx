"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Search, List, Fuel, Wrench, Anchor, AlertTriangle, ChevronRight } from "lucide-react";
import { Facilities, OrcaChip } from "@/components/design/Primitives";

export type PortRow = {
  id: string; name: string; slug: string; region: string | null; type: string;
  marinaCount: number; berths: number; cheapest: number | null;
  fuel: boolean; repairs: boolean; recommended: number; orcaRisk: string | null;
  isMajor: boolean; draftAccess: string | null; controllingDepthM: number | null; accessNote: string | null;
  toNextNm: number | null;
};

const DRAFT_M = 2.0;
const ACCESS_META: Record<string, { chip: string; label: string; color: string }> = {
  "all-tide": { chip: "✓", label: "all-tide", color: "var(--go)" },
  "tide-gated": { chip: "◑ HW", label: "near HW only", color: "var(--caution)" },
  shallow: { chip: "✕", label: "too shallow", color: "var(--nogo)" },
  unknown: { chip: "?", label: "depth unverified", color: "var(--fg-faint)" },
};

const FILTERS = [
  ["all", "All", List],
  ["fuel", "Fuel", Fuel],
  ["repair", "Repair", Wrench],
  ["anchor", "Anchorage", Anchor],
  ["orca", "Orca risk", AlertTriangle],
] as const;

export default function PortsExplorer({ ports }: { ports: PortRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [draftSafe, setDraftSafe] = useState(true);
  const [majorOnly, setMajorOnly] = useState(false);
  const query = q.trim().toLowerCase();

  const majorCount = useMemo(() => ports.filter((p) => p.isMajor).length, [ports]);
  const anchorCount = useMemo(() => ports.filter((p) => p.marinaCount === 0).length, [ports]);
  // Marinas we can't vouch for: a marina exists but its berth count is unknown.
  const unverifiedCount = useMemo(
    () => ports.filter((p) => p.marinaCount > 0 && p.berths === 0).length,
    [ports],
  );
  const indexed = useMemo(() => ports.map((p, i) => ({ ...p, order: i + 1 })), [ports]);

  const filtered = useMemo(() => {
    return indexed.filter((p) => {
      const anchorage = p.marinaCount === 0;
      const unverified = p.marinaCount > 0 && p.berths === 0; // marina with no berth info
      // Always hide marinas with no berth data — keep only what's confirmed.
      if (unverified) return false;
      if (filter === "anchor") {
        if (!anchorage) return false; // anchorages live behind their own filter
      } else {
        if (anchorage) return false; // default/All shows only verified marinas
        if (filter === "fuel" && !p.fuel) return false;
        if (filter === "repair" && !p.repairs) return false;
        if (filter === "orca" && (!p.orcaRisk || p.orcaRisk === "none")) return false;
      }
      if (draftSafe && p.draftAccess !== "all-tide") return false;
      if (majorOnly && !p.isMajor) return false;
      if (query && !(p.name.toLowerCase().includes(query) || (p.region ?? "").toLowerCase().includes(query)))
        return false;
      return true;
    });
  }, [indexed, filter, draftSafe, majorOnly, query]);

  const hiddenByDraft = useMemo(
    () => indexed.filter((p) => p.marinaCount > 0 && p.berths > 0 && p.draftAccess !== "all-tide").length,
    [indexed],
  );

  return (
    <div className="glass" style={{ padding: 18 }}>
      <div className="ports-controls">
        <div className="search-wrap" style={{ flex: 1, minWidth: 220 }}>
          <Search size={17} />
          <input
            className="input"
            placeholder="Search ports — e.g. Vigo, Cascais, Cádiz, Algarve…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="seg">
          {FILTERS.map(([k, label, Icon]) => (
            <button key={k} className={`seg-opt${filter === k ? " active" : ""}`} onClick={() => setFilter(k)}>
              <Icon size={14} /> <span className="hide-mobile">{label}</span>
            </button>
          ))}
        </div>
        <button
          className={`toggle-chip${draftSafe ? " on-go" : ""}`}
          aria-pressed={draftSafe}
          onClick={() => setDraftSafe((v) => !v)}
          title={`Show only harbours a ${DRAFT_M} m draft enters at any tide (≥2.5 m, no bar)`}
        >
          ⚓ Draft {DRAFT_M} m{draftSafe ? ` · ${hiddenByDraft} hidden` : ""}
        </button>
        <button
          className={`toggle-chip${majorOnly ? " on-amber" : ""}`}
          aria-pressed={majorOnly}
          onClick={() => setMajorOnly((v) => !v)}
          title="Principal hubs — provisioning, overnight, 1–2 day rest"
        >
          ★ Major{majorOnly ? "" : ` (${majorCount})`}
        </button>
      </div>

      <div className="ports-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Port</th>
              <th className="hide-mobile">→ Next</th>
              <th>Region</th>
              <th className="num">Berths</th>
              <th className="num hide-mobile">€/day</th>
              {!draftSafe && <th>Access</th>}
              <th>Facilities</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const anchorage = p.marinaCount === 0;
              const m = ACCESS_META[p.draftAccess ?? "unknown"] ?? ACCESS_META.unknown;
              return (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/port/${p.slug}`)}
                  style={p.isMajor ? { background: "rgba(255,194,75,0.06)", boxShadow: "inset 3px 0 0 var(--caution)" } : undefined}
                >
                  <td className="num faint">{p.order}</td>
                  <td>
                    <div className="center gap-8">
                      {p.isMajor && <span aria-hidden style={{ color: "var(--caution)" }}>★</span>}
                      <Link
                        href={`/port/${p.slug}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontWeight: 600, color: "var(--fg)", textDecoration: "none" }}
                      >
                        {p.name}
                      </Link>
                    </div>
                  </td>
                  <td className="num dim hide-mobile">{p.toNextNm != null ? `${Math.round(p.toNextNm)} nm` : "—"}</td>
                  <td className="dim" style={{ fontSize: 12.5 }}>{p.region}</td>
                  <td className="num">
                    {anchorage ? (
                      <span className="pill" style={{ fontSize: 10 }}>
                        <Anchor size={11} /> {p.type === "cape" ? "cape" : "anchor"}
                      </span>
                    ) : (
                      p.berths || "—"
                    )}
                  </td>
                  <td className="num hide-mobile">
                    {p.cheapest != null ? <span style={{ color: "var(--cyan)" }}>€{p.cheapest}</span> : <span className="faint">—</span>}
                  </td>
                  {!draftSafe && (
                    <td title={p.accessNote ?? m.label}>
                      <span style={{ color: m.color, fontFamily: "var(--mono)", fontSize: 12 }}>{m.chip}</span>
                      {p.controllingDepthM != null && (
                        <span className="faint mono" style={{ fontSize: 11, marginLeft: 5 }}>{p.controllingDepthM}m</span>
                      )}
                    </td>
                  )}
                  <td>
                    <div className="center gap-8">
                      <Facilities fuel={p.fuel} repairs={p.repairs} />
                      <OrcaChip level={p.orcaRisk} />
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <ChevronRight size={16} style={{ color: "var(--fg-faint)" }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="dim" style={{ textAlign: "center", padding: 40 }}>No ports match “{q.trim()}”.</div>
        )}
      </div>

      <div className="ports-foot">
        <span className="faint mono" style={{ fontSize: 12 }}>
          Showing {filtered.length} {filter === "anchor" ? "anchorages" : "verified marinas"}
          {draftSafe ? ` · draft-safe for ${DRAFT_M} m` : ""}
        </span>
        <span className="faint mono center gap-6" style={{ fontSize: 11 }}>
          {filter === "anchor"
            ? <>{anchorCount} anchorages · depth-checked</>
            : draftSafe
              ? <>{hiddenByDraft} tide-gated/shallow · {unverifiedCount} no-berth-data hidden</>
              : <>✓ all-tide · ◑ HW only · ✕ shallow · ? unverified</>}
        </span>
      </div>
    </div>
  );
}
