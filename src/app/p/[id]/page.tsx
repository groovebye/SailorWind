"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ForecastEntry } from "@/lib/weather";

const WEATHER_EMOJI: Record<string, string> = {
  sun: "☀️", partly: "⛅", cloudy: "☁️",
  fog: "FOG", rain: "🌧️", heavy_rain: "🌧️🌧️", storm: "⛈️",
};

interface Port {
  id: string; name: string; slug: string; lat: number; lon: number;
  type: string; coastlineNm: number; notes: string | null;
}
interface Waypoint { port: Port; isStop: boolean; isCape: boolean; sortOrder: number; }
interface Passage {
  id: string; shortId: string; name: string | null;
  departure: string; speed: number; mode: string; model: string;
  waypoints: Waypoint[];
}

function fmtUTC(d: Date) {
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")} UTC`;
}

function fmtTime(d: Date) {
  return `${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`;
}

function verdictColor(v: string) {
  if (v === "GO") return "text-green-400 bg-green-400/10";
  if (v.startsWith("CAUTION")) return "text-yellow-400 bg-yellow-400/10";
  return "text-red-400 bg-red-400/10";
}

function verdictLabel(v: string) {
  if (v === "GO") return "GO";
  if (v.startsWith("CAUTION")) return "CAUTION";
  return "NO-GO";
}

export default function PassagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [passage, setPassage] = useState<Passage | null>(null);
  const [forecasts, setForecasts] = useState<Record<string, ForecastEntry[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable filters (override passage defaults)
  const [departure, setDeparture] = useState("");
  const [speed, setSpeed] = useState(5.0);
  const [mode, setMode] = useState("daily");
  const [model, setModel] = useState("ecmwf_ifs025");

  useEffect(() => {
    fetch(`/api/passage?id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setPassage(data);
        setDeparture(data.departure.slice(0, 16));
        setSpeed(data.speed);
        setMode(data.mode);
        setModel(data.model);
      });
  }, [id]);

  const loadForecasts = useCallback(async (force = false) => {
    if (!passage) return;
    setLoading(true);

    const wps = passage.waypoints.map((w) => ({
      name: w.port.name,
      lat: w.port.lat,
      lon: w.port.lon,
      isCape: w.isCape,
    }));

    const res = await fetch("/api/forecast/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waypoints: wps, model, force }),
    });

    const data = await res.json();
    if (data.error) { setError(data.error); setLoading(false); return; }
    setForecasts(data);
    setLoading(false);
  }, [passage, model]);

  useEffect(() => {
    if (passage) loadForecasts();
  }, [passage, loadForecasts]);

  // Auto-save filters to DB (debounced)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const initialLoad = useRef(true);

  useEffect(() => {
    if (!passage || initialLoad.current) {
      initialLoad.current = false;
      return;
    }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/passage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, departure, speed, mode, model }),
      });
    }, 500);
  }, [departure, speed, mode, model, id, passage]);

  async function handleDelete() {
    if (!confirm("Delete this passage?")) return;
    await fetch(`/api/passage?id=${id}`, { method: "DELETE" });
    router.push("/");
  }

  if (error) return <div className="max-w-4xl mx-auto p-12 text-red-400">Error: {error}</div>;
  if (!passage) return <div className="max-w-4xl mx-auto p-12 text-slate-400">Loading passage...</div>;

  // Compute schedule from editable filters
  const stops = passage.waypoints.filter((w) => w.isStop);
  const legs: { from: Waypoint; to: Waypoint; nm: number; departTime: Date; arriveTime: Date; hours: number }[] = [];
  const depDate = new Date(departure || passage.departure);
  let currentTime = depDate.getTime();
  const depHour = depDate.getUTCHours();

  for (let i = 0; i < stops.length - 1; i++) {
    const nm = stops[i + 1].port.coastlineNm - stops[i].port.coastlineNm;
    const hours = nm / speed;
    const departTime = new Date(currentTime);
    const arriveTime = new Date(currentTime + hours * 3600000);
    legs.push({ from: stops[i], to: stops[i + 1], nm, departTime, arriveTime, hours });

    if (mode === "daily" && i < stops.length - 2) {
      const nextDay = new Date(arriveTime);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      nextDay.setUTCHours(depHour, 0, 0, 0);
      if (nextDay.getTime() < arriveTime.getTime()) nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      currentTime = nextDay.getTime();
    } else {
      currentTime = arriveTime.getTime();
    }
  }

  function getWaypointETA(wp: Waypoint): Date {
    for (const leg of legs) {
      if (wp.port.coastlineNm >= leg.from.port.coastlineNm - 0.1 &&
          wp.port.coastlineNm <= leg.to.port.coastlineNm + 0.1) {
        if (wp.port.name === leg.from.port.name) return leg.departTime;
        if (wp.port.name === leg.to.port.name) return leg.arriveTime;
        const legDist = leg.to.port.coastlineNm - leg.from.port.coastlineNm;
        const frac = (wp.port.coastlineNm - leg.from.port.coastlineNm) / legDist;
        return new Date(leg.departTime.getTime() + frac * (leg.arriveTime.getTime() - leg.departTime.getTime()));
      }
    }
    return legs.length ? legs[legs.length - 1].arriveTime : new Date();
  }

  function closestForecast(wpForecasts: ForecastEntry[], target: Date): ForecastEntry | null {
    let best: ForecastEntry | null = null;
    let bestDiff = Infinity;
    for (const f of wpForecasts) {
      const diff = Math.abs(new Date(f.time).getTime() - target.getTime());
      if (diff < bestDiff) { bestDiff = diff; best = f; }
    }
    return best;
  }

  const totalSailing = legs.reduce((s, l) => s + l.hours, 0);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-blue-400">
              &#9973; {passage.name || "Passage"}
            </h1>
            <div className="text-sm text-slate-400 mt-1 space-x-4">
              <span>Model: {model.toUpperCase()}</span>
              <span>{totalSailing.toFixed(0)}h sailing</span>
              <span>Speed: {speed}kt</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-slate-300">Bossanova</div>
            <div className="text-xs text-slate-500">Hallberg-Rassy Monsun 31</div>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="px-4 py-2 border border-slate-700 rounded-lg text-sm text-slate-300 hover:border-blue-500 transition-colors">
              ← Home
            </Link>
            <button onClick={() => loadForecasts(false)} className="px-4 py-2 border border-blue-500 rounded-lg text-sm text-blue-400 hover:bg-blue-500 hover:text-white transition-colors">
              Refresh
            </button>
            <button onClick={() => loadForecasts(true)} className="px-4 py-2 border border-yellow-500 rounded-lg text-sm text-yellow-400 hover:bg-yellow-500 hover:text-white transition-colors">
              Force Refresh
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 border border-red-500/50 rounded-lg text-sm text-red-400 hover:bg-red-500 hover:text-white transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </header>

      {/* Editable filters */}
      <div className="bg-slate-800 border border-slate-800 rounded-xl p-4 mb-6">
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Departure</label>
            <input
              type="datetime-local"
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 h-10 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Speed (kt)</label>
            <input
              type="number"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value) || 5)}
              min={1} max={15} step={0.5}
              className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-3 h-10 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 h-10 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="daily">Daily stops</option>
              <option value="nonstop">Non-stop</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Weather Model</label>
            <select
              value={model}
              onChange={(e) => { setModel(e.target.value); }}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 h-10 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="ecmwf_ifs025">ECMWF IFS 0.25°</option>
              <option value="icon_eu">ICON-EU</option>
              <option value="gfs_seamless">GFS</option>
              <option value="arome_france">AROME France</option>
            </select>
          </div>
        </div>
      </div>

      {/* Legs overview */}
      <div className="flex gap-2 flex-wrap mb-6">
        {legs.map((l, i) => (
          <div key={i} className="bg-slate-800 border border-slate-800 rounded-lg px-4 py-3 flex-1 min-w-[200px]">
            <div className="font-semibold text-blue-400 text-sm">{l.from.port.name} → {l.to.port.name}</div>
            <div className="text-xs text-slate-500">{l.nm} NM, ~{l.hours.toFixed(1)}h</div>
            <div className="text-xs text-green-400 mt-1">
              {mode === "daily" && i > 0 ? `Day ${i + 1}: ` : ""}
              {fmtUTC(l.departTime)} → {fmtUTC(l.arriveTime)}
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="w-10 h-10 border-3 border-slate-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Fetching forecasts...</p>
        </div>
      ) : forecasts && (
        <>
          {/* Passage Summary */}
          <h2 className="text-lg font-semibold text-blue-400 mb-3">Passage Summary</h2>
          {legs.map((leg, li) => {
            const legWps = passage.waypoints.filter(
              (w) => w.port.coastlineNm >= leg.from.port.coastlineNm - 0.1 &&
                     w.port.coastlineNm <= leg.to.port.coastlineNm + 0.1
            );

            return (
              <div key={li} className="mb-4">
                <div className="bg-slate-800 text-blue-400 text-sm font-semibold px-4 py-2 rounded-t-lg border border-slate-800">
                  {mode === "daily" ? `Day ${li + 1} — ` : ""}
                  Leg {li + 1}: {leg.from.port.name} → {leg.to.port.name} ({leg.nm} NM, ~{leg.hours.toFixed(1)}h) — {fmtUTC(leg.departTime)} → {fmtUTC(leg.arriveTime)}
                </div>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-xs text-slate-500 uppercase">
                      <th className="text-left px-3 py-2 bg-slate-800/50">Waypoint</th>
                      <th className="text-left px-3 py-2 bg-slate-800/50">ETA</th>
                      <th className="px-3 py-2 bg-slate-800/50">Weather</th>
                      <th className="text-left px-3 py-2 bg-slate-800/50">Wind</th>
                      <th className="px-3 py-2 bg-slate-800/50">Gusts</th>
                      <th className="text-left px-3 py-2 bg-slate-800/50">Waves</th>
                      <th className="text-left px-3 py-2 bg-slate-800/50">Swell</th>
                      <th className="px-3 py-2 bg-slate-800/50">Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legWps.map((wp) => {
                      const eta = getWaypointETA(wp);
                      const wpF = forecasts[wp.port.name] || [];
                      const f = closestForecast(wpF, eta);

                      return (
                        <tr key={wp.port.id} className="border-b border-slate-800/50 hover:bg-blue-500/5">
                          <td className={`px-3 py-2 font-semibold ${
                            wp.isCape ? "text-yellow-400" : wp.isStop ? "text-green-400" : "text-slate-400"
                          }`}>
                            {wp.port.name}
                            {wp.isStop && <span className="text-[10px] ml-1 border border-green-500 text-green-500 px-1 rounded">STOP</span>}
                            {wp.isCape && <span className="text-[10px] ml-1 text-yellow-400 font-bold">CAPE</span>}
                          </td>
                          <td className="px-3 py-2 text-blue-300 text-xs">{fmtUTC(eta)}</td>
                          {f ? (
                            <>
                              <td className="px-3 py-2 text-center">{WEATHER_EMOJI[f.weather] || ""}</td>
                              <td className="px-3 py-2">
                                <span className="inline-block text-yellow-400" style={{ transform: `rotate(${f.windDirDeg}deg)` }}>↓</span>
                                {" "}{f.windKt}kt ({f.beaufort})
                              </td>
                              <td className="px-3 py-2 text-center">{f.gustKt}kt</td>
                              <td className="px-3 py-2">
                                <span className="inline-block" style={{ transform: `rotate(${f.waveDirDeg}deg)` }}>↓</span>
                                {" "}{f.waveM}m / {f.wavePeriodS}s
                              </td>
                              <td className="px-3 py-2">
                                <span className="inline-block" style={{ transform: `rotate(${f.swellDirDeg}deg)` }}>↓</span>
                                {" "}{f.swellM}m / {f.swellPeriodS}s
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${verdictColor(f.verdict)}`}>
                                  {verdictLabel(f.verdict)}
                                </span>
                              </td>
                            </>
                          ) : (
                            <td colSpan={6} className="px-3 py-2 text-slate-500">No data</td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* Detailed Forecast */}
          <h2 className="text-lg font-semibold text-blue-400 mb-3 mt-8">Detailed Forecast by Waypoint</h2>
          {passage.waypoints.map((wp) => {
            const allF = forecasts[wp.port.name] || [];
            const eta = getWaypointETA(wp);
            const etaDay = eta.toISOString().slice(0, 10);

            let dayF = allF.filter((f) => f.time.slice(0, 10) === etaDay);
            if (dayF.length < 4 && allF.length) {
              const windowMs = 12 * 3600000;
              const windowF = allF.filter((f) => {
                const diff = new Date(f.time).getTime() - eta.getTime();
                return diff >= -windowMs && diff <= windowMs;
              });
              if (windowF.length >= dayF.length) dayF = windowF;
              if (!dayF.length) {
                const closest = closestForecast(allF, eta);
                if (closest) {
                  const cDay = closest.time.slice(0, 10);
                  dayF = allF.filter((f) => f.time.slice(0, 10) === cDay);
                }
              }
            }

            const isCollapsed = !wp.isStop && !wp.isCape;

            return (
              <details key={wp.port.id} open={!isCollapsed} className={`mb-3 rounded-lg border overflow-hidden ${
                wp.isCape ? "border-yellow-500/30" : wp.isStop ? "border-green-500/30" : "border-slate-800"
              }`}>
                <summary className="px-4 py-3 cursor-pointer bg-slate-800 hover:bg-slate-800 flex items-center gap-2">
                  <span className={`font-semibold ${
                    wp.isCape ? "text-yellow-400" : wp.isStop ? "text-green-400" : "text-slate-400"
                  }`}>
                    {wp.port.name}
                  </span>
                  <span className="text-xs text-slate-500">ETA: {fmtUTC(eta)}</span>
                  <span className="text-xs text-slate-600 ml-auto">{dayF.length} entries</span>
                </summary>
                <div className="bg-slate-800">
                  {dayF.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 uppercase">
                          <th className="text-left px-3 py-2">Time</th>
                          <th className="px-3 py-2">Weather</th>
                          <th className="text-left px-3 py-2">Wind</th>
                          <th className="px-3 py-2">Gusts</th>
                          <th className="text-left px-3 py-2">Waves</th>
                          <th className="text-left px-3 py-2">Swell</th>
                          <th className="px-3 py-2">Verdict</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayF.map((f) => {
                          const dt = new Date(f.time);
                          const diffH = Math.abs(dt.getTime() - eta.getTime()) / 3600000;
                          return (
                            <tr key={f.time} className={`border-b border-slate-800/30 ${diffH < 2 ? "bg-blue-500/10" : ""}`}>
                              <td className="px-3 py-1.5">{fmtTime(dt)} UTC</td>
                              <td className="px-3 py-1.5 text-center">{WEATHER_EMOJI[f.weather] || ""}</td>
                              <td className="px-3 py-1.5">
                                <span className="inline-block text-yellow-400" style={{ transform: `rotate(${f.windDirDeg}deg)` }}>↓</span>
                                {" "}{f.windKt}kt ({f.beaufort})
                              </td>
                              <td className="px-3 py-1.5 text-center">{f.gustKt}kt</td>
                              <td className="px-3 py-1.5">
                                <span className="inline-block" style={{ transform: `rotate(${f.waveDirDeg}deg)` }}>↓</span>
                                {" "}{f.waveM}m / {f.wavePeriodS}s
                              </td>
                              <td className="px-3 py-1.5">
                                <span className="inline-block" style={{ transform: `rotate(${f.swellDirDeg}deg)` }}>↓</span>
                                {" "}{f.swellM}m / {f.swellPeriodS}s
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${verdictColor(f.verdict)}`}>
                                  {verdictLabel(f.verdict)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="px-4 py-3 text-slate-500 text-sm">No forecast data</div>
                  )}
                </div>
              </details>
            );
          })}
        </>
      )}

      <div className="text-center text-xs text-slate-600 mt-8 pt-6 border-t border-slate-800">
        Planning aid only. Cross-check with AEMET, Meteogalicia, and real-time conditions before departure.
      </div>
    </div>
  );
}
