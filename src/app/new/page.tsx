"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft } from "lucide-react";

interface Port {
  id: string;
  name: string;
  slug: string;
  lat: number;
  lon: number;
  type: string;
  country: string;
  region: string | null;
  coastSegment: string;
  coastlineNm: number;
  fuel: boolean;
  water: boolean;
  electric: boolean;
  repairs: boolean;
  shelter: string | null;
  notes: string | null;
}

type Step = 1 | 2;

export default function NewPassage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  // Step 1 state
  const [allPorts, setAllPorts] = useState<Port[]>([]);
  const [fromPort, setFromPort] = useState("");
  const [toPort, setToPort] = useState("");
  const [departure, setDeparture] = useState("");
  const [speed, setSpeed] = useState(5.0);
  const [mode, setMode] = useState<"daily" | "nonstop">("daily");
  const [model, setModel] = useState("ecmwf_ifs025");

  // Step 2 state
  const [routePorts, setRoutePorts] = useState<(Port & { checked: boolean })[]>([]);
  const [saving, setSaving] = useState(false);

  // Set default departure to tomorrow 08:00
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    setDeparture(d.toISOString().slice(0, 16));
  }, []);

  // Load all ports
  useEffect(() => {
    fetch("/api/ports")
      .then((r) => r.json())
      .then(setAllPorts);
  }, []);

  // When from/to selected, compute route ports
  const computeRoute = useCallback(() => {
    if (!fromPort || !toPort) return;
    const from = allPorts.find((p) => p.id === fromPort);
    const to = allPorts.find((p) => p.id === toPort);
    if (!from || !to) return;

    const minNm = Math.min(from.coastlineNm, to.coastlineNm);
    const maxNm = Math.max(from.coastlineNm, to.coastlineNm);

    const between = allPorts
      .filter((p) => p.coastlineNm >= minNm && p.coastlineNm <= maxNm)
      .sort((a, b) => a.coastlineNm - b.coastlineNm);

    // Auto-check: start, end, capes, and marinas that create legs ≤ 50 NM
    const checked = between.map((p) => {
      const isStart = p.id === fromPort;
      const isEnd = p.id === toPort;
      const isCape = p.type === "cape";
      const isMarina = p.type === "marina";
      return {
        ...p,
        checked: isStart || isEnd || isCape || isMarina,
      };
    });

    setRoutePorts(checked);
  }, [fromPort, toPort, allPorts]);

  function handleStep1Next() {
    if (!fromPort || !toPort || !departure) return;
    computeRoute();
    setStep(2);
  }

  function togglePort(idx: number) {
    setRoutePorts((prev) => {
      const next = [...prev];
      // Can't uncheck start/end
      if (idx === 0 || idx === prev.length - 1) return next;
      next[idx] = { ...next[idx], checked: !next[idx].checked };
      return next;
    });
  }

  // Compute legs from checked ports
  function computeLegs() {
    const stops = routePorts.filter((p) => p.checked && p.type !== "cape");
    const legs = [];
    for (let i = 0; i < stops.length - 1; i++) {
      const nm = stops[i + 1].coastlineNm - stops[i].coastlineNm;
      const hours = nm / speed;
      legs.push({
        from: stops[i].name,
        to: stops[i + 1].name,
        nm: Math.round(nm),
        hours: hours.toFixed(1),
        warning: nm > 50 || hours > 10,
      });
    }
    return legs;
  }

  async function handleSave() {
    setSaving(true);

    const waypoints = routePorts.map((p) => ({
      portId: p.id,
      isStop: p.checked && p.type !== "cape",
      isCape: p.type === "cape",
    }));

    const from = allPorts.find((p) => p.id === fromPort);
    const to = allPorts.find((p) => p.id === toPort);

    const res = await fetch("/api/passage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${from?.name} → ${to?.name}`,
        departure,
        speed,
        mode,
        model,
        waypoints,
      }),
    });

    const data = await res.json();
    router.push(`/p/${data.shortId}`);
  }

  const legs = step === 2 ? computeLegs() : [];
  const totalNm = legs.reduce((s, l) => s + l.nm, 0);

  return (
    <div className="container fade-up" style={{ maxWidth: 860, paddingTop: 32, paddingBottom: 80 }}>
      <h1 className="display" style={{ fontSize: 34, margin: "0 0 6px" }}>New passage</h1>
      <p className="dim" style={{ fontSize: 14, margin: "0 0 24px" }}>Pick your endpoints, then fine-tune the waypoints.</p>

      {/* Step indicator */}
      <div className="seg" style={{ marginBottom: 24 }}>
        <span className={`seg-opt${step === 1 ? " active" : ""}`}>1 · Route</span>
        <span className={`seg-opt${step === 2 ? " active" : ""}`}>2 · Waypoints</span>
      </div>

      {step === 1 && (
        <div className="glass col gap-20" style={{ padding: 24 }}>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="field-label">From</label>
              <select className="select" value={fromPort} onChange={(e) => setFromPort(e.target.value)}>
                <option value="">Select port…</option>
                {allPorts.filter((p) => p.type !== "cape").map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">To</label>
              <select className="select" value={toPort} onChange={(e) => setToPort(e.target.value)}>
                <option value="">Select port…</option>
                {allPorts.filter((p) => p.type !== "cape").map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1.4fr 1.1fr 1.1fr", gap: 16, alignItems: "end" }}>
            <div>
              <label className="field-label">Departure</label>
              <input className="input" type="datetime-local" value={departure} onChange={(e) => setDeparture(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Boat speed</label>
              <div className="center gap-10">
                <input type="range" min={3} max={9} step={0.5} value={speed} onChange={(e) => setSpeed(+e.target.value)} className="range" />
                <span className="mono" style={{ fontSize: 15, fontWeight: 600, minWidth: 48 }}>{speed} kt</span>
              </div>
            </div>
            <div>
              <label className="field-label">Mode</label>
              <div className="seg">
                {([["daily", "Daily stops"], ["nonstop", "Non-stop"]] as [typeof mode, string][]).map(([k, label]) => (
                  <button key={k} type="button" className={`seg-opt${mode === k ? " active" : ""}`} onClick={() => setMode(k)}>{label}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="field-label">Weather model</label>
            <select className="select" style={{ maxWidth: 320 }} value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="ecmwf_ifs025">ECMWF IFS 0.25°</option>
              <option value="icon_eu">ICON-EU</option>
              <option value="gfs_seamless">GFS</option>
              <option value="arome_france">AROME France</option>
            </select>
          </div>

          <button className="btn btn-primary btn-lg" style={{ alignSelf: "flex-start" }} onClick={handleStep1Next} disabled={!fromPort || !toPort || !departure}>
            Next: select waypoints <ArrowRight size={16} />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="col gap-16">
          <button className="btn btn-sm btn-ghost" style={{ alignSelf: "flex-start" }} onClick={() => setStep(1)}>
            <ArrowLeft size={15} /> Back to route
          </button>

          {legs.length > 0 && (
            <div className="glass" style={{ padding: 18 }}>
              <h3 className="mono faint" style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", margin: "0 0 12px" }}>
                Legs · {totalNm} NM total · {legs.length} legs
              </h3>
              <div className="flex gap-8 wrap">
                {legs.map((l, i) => (
                  <div key={i} className="pill" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "8px 12px", textTransform: "none", letterSpacing: 0, color: l.warning ? "var(--caution)" : "var(--fg-dim)", borderColor: l.warning ? "rgba(255,194,75,0.4)" : "var(--glass-border)" }}>
                    <span style={{ fontWeight: 600 }}>{l.from} → {l.to}</span>
                    <span>{l.nm} NM · ~{l.hours}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass col" style={{ padding: 10, gap: 2 }}>
            {routePorts.map((p, i) => {
              const isStartEnd = i === 0 || i === routePorts.length - 1;
              const prevChecked = routePorts.slice(0, i).reverse().find((pp) => pp.checked && pp.type !== "cape");
              const distFromPrev = prevChecked ? p.coastlineNm - prevChecked.coastlineNm : 0;
              const nameColor = p.type === "cape" ? "var(--caution)" : p.type === "marina" ? "var(--go)" : "var(--fg)";
              return (
                <div
                  key={p.id}
                  onClick={() => !isStartEnd && togglePort(i)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 11,
                    cursor: isStartEnd ? "default" : "pointer", opacity: p.checked ? 1 : 0.5,
                    background: p.checked ? (p.type === "cape" ? "rgba(255,194,75,0.07)" : "rgba(52,224,255,0.06)") : "transparent",
                    boxShadow: p.checked ? `inset 2px 0 0 ${p.type === "cape" ? "var(--caution)" : "var(--cyan)"}` : "none",
                  }}
                >
                  <input type="checkbox" checked={p.checked} disabled={isStartEnd} onChange={() => togglePort(i)} style={{ accentColor: "var(--cyan)" }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: nameColor }}>{p.name}</span>
                    <span className="faint mono" style={{ fontSize: 11, marginLeft: 8 }}>{p.type.toUpperCase()}</span>
                    {p.fuel && <span className="faint" style={{ fontSize: 11, marginLeft: 6 }}>⛽</span>}
                    {p.repairs && <span className="faint" style={{ fontSize: 11, marginLeft: 4 }}>🔧</span>}
                  </div>
                  <span className="faint mono" style={{ fontSize: 11 }}>{p.coastlineNm} NM</span>
                  {distFromPrev > 0 && (
                    <span className="mono" style={{ fontSize: 11, color: distFromPrev > 50 ? "var(--nogo)" : "var(--fg-faint)" }}>+{distFromPrev} NM</span>
                  )}
                </div>
              );
            })}
          </div>

          <button className="btn btn-primary btn-lg" style={{ alignSelf: "flex-start" }} onClick={handleSave} disabled={saving || legs.length === 0}>
            {saving ? "Saving…" : "Create passage & view forecast"}
          </button>
        </div>
      )}
    </div>
  );
}
