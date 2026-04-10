"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

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
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-blue-400 mb-8">New Passage</h1>

      {/* Step indicator */}
      <div className="flex gap-4 mb-8">
        <div className={`px-4 py-2 rounded-lg text-sm font-semibold ${step === 1 ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"}`}>
          1. Route
        </div>
        <div className={`px-4 py-2 rounded-lg text-sm font-semibold ${step === 2 ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"}`}>
          2. Waypoints
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">From</label>
              <select
                value={fromPort}
                onChange={(e) => setFromPort(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select port...</option>
                {allPorts.filter((p) => p.type !== "cape").map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">To</label>
              <select
                value={toPort}
                onChange={(e) => setToPort(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select port...</option>
                {allPorts.filter((p) => p.type !== "cape").map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-slate-400 mb-1">Departure</label>
              <input
                type="datetime-local"
                value={departure}
                onChange={(e) => setDeparture(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Speed (kt)</label>
              <input
                type="number"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value) || 5)}
                min={1} max={15} step={0.5}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as "daily" | "nonstop")}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="daily">Daily stops</option>
                <option value="nonstop">Non-stop</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Weather Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none max-w-xs"
            >
              <option value="ecmwf_ifs025">ECMWF IFS 0.25°</option>
              <option value="icon_eu">ICON-EU</option>
              <option value="gfs_seamless">GFS</option>
              <option value="arome_france">AROME France</option>
            </select>
          </div>

          <button
            onClick={handleStep1Next}
            disabled={!fromPort || !toPort || !departure}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Next: Select Waypoints →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <button
            onClick={() => setStep(1)}
            className="text-slate-400 hover:text-blue-400 text-sm mb-4"
          >
            ← Back to Route
          </button>

          {/* Legs summary */}
          {legs.length > 0 && (
            <div className="bg-slate-800 border border-slate-800 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">
                Legs ({totalNm} NM total, {legs.length} legs)
              </h3>
              <div className="flex gap-2 flex-wrap">
                {legs.map((l, i) => (
                  <div
                    key={i}
                    className={`text-xs px-3 py-2 rounded border ${l.warning ? "border-yellow-500 text-yellow-400" : "border-slate-700 text-slate-300"}`}
                  >
                    <div className="font-semibold">{l.from} → {l.to}</div>
                    <div>{l.nm} NM, ~{l.hours}h</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Port checklist */}
          <div className="space-y-1">
            {routePorts.map((p, i) => {
              const isStartEnd = i === 0 || i === routePorts.length - 1;
              const prevChecked = routePorts.slice(0, i).reverse().find((pp) => pp.checked && pp.type !== "cape");
              const distFromPrev = prevChecked ? p.coastlineNm - prevChecked.coastlineNm : 0;

              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors cursor-pointer ${
                    p.checked
                      ? p.type === "cape"
                        ? "border-yellow-500/30 bg-yellow-500/5"
                        : "border-blue-500/30 bg-blue-500/5"
                      : "border-slate-800 bg-slate-800/50 opacity-60"
                  }`}
                  onClick={() => !isStartEnd && togglePort(i)}
                >
                  <input
                    type="checkbox"
                    checked={p.checked}
                    disabled={isStartEnd}
                    onChange={() => togglePort(i)}
                    className="accent-blue-500"
                  />
                  <div className="flex-1">
                    <span className={`font-semibold text-sm ${
                      p.type === "cape" ? "text-yellow-400" :
                      p.type === "marina" ? "text-green-400" : "text-slate-300"
                    }`}>
                      {p.name}
                    </span>
                    <span className="text-xs text-slate-500 ml-2">
                      {p.type.toUpperCase()}
                    </span>
                    {p.fuel && <span className="text-xs text-slate-500 ml-1">⛽</span>}
                    {p.water && <span className="text-xs text-slate-500 ml-1">💧</span>}
                    {p.repairs && <span className="text-xs text-slate-500 ml-1">🔧</span>}
                  </div>
                  <span className="text-xs text-slate-500">{p.coastlineNm} NM</span>
                  {distFromPrev > 0 && (
                    <span className={`text-xs ${distFromPrev > 50 ? "text-red-400" : "text-slate-500"}`}>
                      +{distFromPrev} NM
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={handleSave}
            disabled={saving || legs.length === 0}
            className="bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            {saving ? "Saving..." : "Create Passage & View Forecast"}
          </button>
        </div>
      )}
    </div>
  );
}
