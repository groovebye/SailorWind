/* ============================================================
   SailorWind — shared UI primitives
   ============================================================ */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ---------- Icon (renders Lucide icon nodes as inline SVG) ---------- */
function pascal(name) {
  return name.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());
}
function renderNode(node, key) {
  // node: [tag, attrs, children?]
  if (!Array.isArray(node)) return null;
  const [tag, attrs, children] = node;
  const kids = Array.isArray(children) ? children.map((c, i) => renderNode(c, i)) : null;
  return React.createElement(tag, { ...attrs, key }, kids);
}
function Icon({ name, size = 18, stroke = 2, className = "", style = {} }) {
  const lib = (typeof lucide !== "undefined" && lucide.icons) ? lucide.icons : {};
  const node = lib[pascal(name)] || lib[name] || [];
  const children = Array.isArray(node) ? node.map((c, i) => renderNode(c, i)) : null;
  return React.createElement("svg", {
    className, style,
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: stroke,
    strokeLinecap: "round", strokeLinejoin: "round",
  }, children);
}

/* ---------- Glass container ---------- */
function Glass({ children, className = "", hover = false, style = {}, onClick }) {
  return (
    <div
      className={"glass " + (hover ? "glass-hover " : "") + className}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

/* ---------- Verdict pill ---------- */
function Verdict({ v, size }) {
  const map = {
    GO: { cls: "verdict-go", icon: "check", label: "GO" },
    CAUTION: { cls: "verdict-caution", icon: "alert-triangle", label: "CAUTION" },
    NOGO: { cls: "verdict-nogo", icon: "x", label: "NO-GO" },
  };
  const m = map[v] || map.GO;
  return (
    <span className={"verdict " + m.cls} style={size === "lg" ? { fontSize: 14, padding: "6px 13px" } : {}}>
      <Icon name={m.icon} size={size === "lg" ? 14 : 12} />
      {m.label}
    </span>
  );
}

/* ---------- Pro badge ---------- */
function Pro({ label = "PRO" }) {
  return <span className="pro-badge"><Icon name="sparkles" size={11} />{label}</span>;
}

/* ---------- Beaufort color ---------- */
function bfColor(bf) {
  // 0..12 → calm cyan to angry rose
  const stops = ["#7fe9c4","#56e0b8","#7fd9ff","#34e0ff","#4fb0ff","#7c9cff","#b794ff","#ffc24b","#ff9b5a","#ff6b8a","#ff4d6d","#ff3355","#ff2a48"];
  return stops[Math.min(12, Math.max(0, bf))];
}
function windColor(kt) {
  if (kt < 4) return "#7fe9c4";
  if (kt < 8) return "#34e0ff";
  if (kt < 12) return "#4fb0ff";
  if (kt < 17) return "#ffc24b";
  if (kt < 22) return "#ff9b5a";
  return "#ff6b8a";
}

/* ---------- Animated number count-up ---------- */
function useCountUp(target, dur = 1100, deps = []) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf, start;
    const from = 0;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * e);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, deps.length ? deps : [target]);
  return val;
}

/* ---------- Tiny sparkline ---------- */
function Sparkline({ data, w = 120, h = 34, color = "var(--cyan)", fill = true }) {
  const max = Math.max(...data), min = Math.min(...data);
  const rng = max - min || 1;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 4 - ((d - min) / rng) * (h - 8);
    return [x, y];
  });
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L ${w} ${h} L 0 ${h} Z`;
  const gid = "sg" + Math.round(min * 100 + max * 7 + data.length);
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
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />
    </svg>
  );
}

/* ---------- Stars ---------- */
function Stars({ n }) {
  if (!n) return <span className="faint">—</span>;
  return (
    <span style={{ display: "inline-flex", gap: 1, color: "var(--caution)" }}>
      {Array.from({ length: n }).map((_, i) => <Icon key={i} name="star" size={12} stroke={0} style={{ fill: "var(--caution)" }} />)}
    </span>
  );
}

/* ---------- Facility chips ---------- */
function Facilities({ list }) {
  const map = { f: { icon: "fuel", t: "Fuel" }, r: { icon: "wrench", t: "Repair" } };
  if (!list || !list.length) return <span className="faint">—</span>;
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      {list.map((f) => (
        <span key={f} title={map[f].t} style={{ color: "var(--fg-dim)", display: "inline-flex" }}>
          <Icon name={map[f].icon} size={14} />
        </span>
      ))}
    </span>
  );
}

/* ---------- Orca chip ---------- */
function OrcaChip({ level }) {
  if (!level) return null;
  const c = level === "high" ? "var(--nogo)" : level === "medium" ? "var(--orca)" : "var(--sky)";
  return (
    <span className="pill" style={{ color: c, borderColor: "transparent", background: "rgba(183,148,255,0.10)" }} title={"Orca interaction risk: " + level}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: c, boxShadow: `0 0 8px ${c}` }} />
      orca {level}
    </span>
  );
}

Object.assign(window, {
  Icon, Glass, Verdict, Pro, Sparkline, Stars, Facilities, OrcaChip,
  bfColor, windColor, useCountUp,
  useState, useEffect, useRef, useMemo, useCallback,
});
