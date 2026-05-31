import { Check, AlertTriangle, X, Star, Fuel, Wrench } from "lucide-react";
import type { VerdictV } from "./helpers";

/** GO / CAUTION / NO-GO pill. */
export function Verdict({ v, size }: { v: VerdictV; size?: "lg" }) {
  const MAP = {
    GO: { cls: "verdict-go", Icon: Check, label: "GO" },
    CAUTION: { cls: "verdict-caution", Icon: AlertTriangle, label: "CAUTION" },
    NOGO: { cls: "verdict-nogo", Icon: X, label: "NO-GO" },
  } as const;
  const m = MAP[v] ?? MAP.GO;
  const { Icon } = m;
  return (
    <span className={`verdict ${m.cls}`} style={size === "lg" ? { fontSize: 14, padding: "6px 13px" } : undefined}>
      <Icon size={size === "lg" ? 14 : 12} />
      {m.label}
    </span>
  );
}

/** Editorial star rating (0..3). */
export function Stars({ n }: { n: number }) {
  if (!n) return <span className="faint">—</span>;
  return (
    <span style={{ display: "inline-flex", gap: 1, color: "var(--caution)" }}>
      {Array.from({ length: n }).map((_, i) => (
        <Star key={i} size={12} fill="var(--caution)" strokeWidth={0} />
      ))}
    </span>
  );
}

/** Fuel / repair facility icons. */
export function Facilities({ fuel, repairs }: { fuel?: boolean; repairs?: boolean }) {
  if (!fuel && !repairs) return <span className="faint">—</span>;
  return (
    <span style={{ display: "inline-flex", gap: 6, color: "var(--fg-dim)" }}>
      {fuel && <Fuel size={14} aria-label="Fuel" />}
      {repairs && <Wrench size={14} aria-label="Repair" />}
    </span>
  );
}

/** Orca-interaction risk chip (color by level). */
export function OrcaChip({ level }: { level?: string | null }) {
  if (!level || level === "none") return null;
  const c = level === "high" ? "var(--nogo)" : level === "medium" ? "var(--orca)" : "var(--sky)";
  return (
    <span
      className="pill"
      style={{ color: c, borderColor: "transparent", background: "rgba(183,148,255,0.10)" }}
      title={`Orca interaction risk: ${level}`}
    >
      <span style={{ width: 7, height: 7, borderRadius: 99, background: c, boxShadow: `0 0 8px ${c}` }} />
      orca {level}
    </span>
  );
}

/** Tiny filled sparkline. */
export function Sparkline({
  data, w = 120, h = 34, color = "var(--cyan)", fill = true,
}: { data: number[]; w?: number; h?: number; color?: string; fill?: boolean }) {
  if (!data.length) return <svg width={w} height={h} />;
  const max = Math.max(...data), min = Math.min(...data);
  const rng = max - min || 1;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * w;
    const y = h - 4 - ((d - min) / rng) * (h - 8);
    return [x, y] as const;
  });
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L ${w} ${h} L 0 ${h} Z`;
  const gid = "sg" + Math.round(min * 100 + max * 7 + data.length);
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
    </svg>
  );
}
