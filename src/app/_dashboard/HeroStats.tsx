"use client";

import { useCountUp } from "@/components/design/useCountUp";

export default function HeroStats({ passages, nm, ports }: { passages: number; nm: number; ports: number }) {
  const p = useCountUp(passages, 900);
  const n = useCountUp(nm, 1200);
  const pt = useCountUp(ports, 1000);
  return (
    <div className="hero-stats">
      <Stat label="Passages planned" value={Math.round(p).toString()} />
      <div className="stat-div" />
      <Stat label="Nautical miles" value={Math.round(n).toLocaleString()} />
      <div className="stat-div" />
      <Stat label="Ports & marinas" value={Math.round(pt).toString()} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="stat-num" style={{ fontSize: 26 }}>{value}</div>
      <div className="faint mono" style={{ fontSize: 11, letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
    </div>
  );
}
