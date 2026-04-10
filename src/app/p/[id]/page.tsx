"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ForecastEntry } from "@/lib/weather";

const WEATHER_EMOJI: Record<string, string> = {
  sun: "\u2600\uFE0F", partly: "\u26C5", cloudy: "\u2601\uFE0F",
  fog: "FOG", rain: "\uD83C\uDF27\uFE0F", heavy_rain: "\uD83C\uDF27\uFE0F\uD83C\uDF27\uFE0F", storm: "\u26C8\uFE0F",
};

// Timezone by longitude (rough: 1 TZ per 15 deg)
function tzForPort(lon: number): string {
  // Mediterranean/Atlantic ports
  if (lon >= -10 && lon <= 3) return "Europe/Madrid";
  if (lon > 3 && lon <= 15) return "Europe/Rome";
  if (lon > 15 && lon <= 30) return "Europe/Athens";
  return "UTC";
}

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

function fmtLocal(d: Date, tz: string) {
  return d.toLocaleString("en-GB", {
    timeZone: tz,
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function fmtTimeLocal(d: Date, tz: string) {
  return d.toLocaleString("en-GB", {
    timeZone: tz,
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
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

// Beaufort number only (e.g. "F3" -> "3")
function bftNum(b: string) {
  return b.replace("F", "");
}

export default function PassagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [passage, setPassage] = useState<Passage | null>(null);
  const [forecasts, setForecasts] = useState<Record<string, ForecastEntry[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      name: w.port.name, lat: w.port.lat, lon: w.port.lon, isCape: w.isCape,
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

  // Auto-save filters
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
    if (!confirm("Are you sure you want to delete this passage?")) return;
    await fetch(`/api/passage?id=${id}`, { method: "DELETE" });
    router.push("/");
  }

  if (error) return <div className="max-w-4xl mx-auto p-12 text-red-400">Error: {error}</div>;
  if (!passage) return <div className="max-w-4xl mx-auto p-12 text-slate-400">Loading...</div>;

  // Compute schedule
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
  const defaultTz = passage.waypoints[0] ? tzForPort(passage.waypoints[0].port.lon) : "UTC";

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-4">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 rounded-xl px-5 py-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-blue-400">
              &#9973; {passage.name || "Passage"}
            </h1>
            <div className="text-xs text-slate-400 mt-0.5 space-x-3">
              <span>{model.toUpperCase()}</span>
              <span>{totalSailing.toFixed(0)}h sailing</span>
              <span>{speed}kt</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-slate-300">Bossanova</div>
            <div className="text-xs text-slate-500">Hallberg-Rassy Monsun 31</div>
          </div>
          <div className="flex gap-1.5">
            <Link href="/" className="flex flex-col items-center px-3 py-1.5 border border-slate-700 rounded-lg text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors" title="Home">
              <span className="text-base">&#8962;</span>
              <span className="text-[10px]">Home</span>
            </Link>
            <Link href={`/p/${id}/map`} className="flex flex-col items-center px-3 py-1.5 border border-slate-700 rounded-lg text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors" title="Map">
              <span className="text-base">&#9741;</span>
              <span className="text-[10px]">Map</span>
            </Link>
            <button onClick={() => loadForecasts(true)} className="flex flex-col items-center px-3 py-1.5 border border-slate-700 rounded-lg text-slate-400 hover:border-yellow-500 hover:text-yellow-400 transition-colors" title="Reload forecasts">
              <span className="text-base">&#8635;</span>
              <span className="text-[10px]">Reload</span>
            </button>
            <button onClick={handleDelete} className="flex flex-col items-center px-3 py-1.5 border border-red-500/30 rounded-lg text-red-400/60 hover:border-red-500 hover:text-red-400 transition-colors" title="Delete passage">
              <span className="text-base">&#128465;</span>
              <span className="text-[10px]">Delete</span>
            </button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-slate-800 border border-slate-800 rounded-xl px-4 py-3 mb-4">
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-[10px] text-slate-500 mb-0.5">Departure</label>
            <input
              type="datetime-local"
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2.5 h-9 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-0.5">Speed (kt)</label>
            <input
              type="number"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value) || 5)}
              min={1} max={15} step={0.5}
              className="w-20 bg-slate-900 border border-slate-700 rounded px-2.5 h-9 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-0.5">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2.5 h-9 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="daily">Daily stops</option>
              <option value="nonstop">Non-stop</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-0.5">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2.5 h-9 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="ecmwf_ifs025">ECMWF IFS 0.25&deg;</option>
              <option value="icon_eu">ICON-EU</option>
              <option value="gfs_seamless">GFS</option>
              <option value="arome_france">AROME France</option>
            </select>
          </div>
        </div>
      </div>

      {/* Legs overview */}
      <div className="flex gap-2 flex-wrap mb-4">
        {legs.map((l, i) => {
          const fromTz = tzForPort(l.from.port.lon);
          const toTz = tzForPort(l.to.port.lon);
          return (
            <div key={i} className="bg-slate-800 border border-slate-800 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
              <div className="font-semibold text-blue-400 text-sm">{mode === "daily" ? `Day ${i + 1}: ` : ""}{l.from.port.name} &rarr; {l.to.port.name}</div>
              <div className="text-xs text-slate-500">{l.nm} NM, ~{l.hours.toFixed(1)}h</div>
              <div className="text-xs text-green-400 mt-0.5">
                {fmtLocal(l.departTime, fromTz)} &rarr; {fmtLocal(l.arriveTime, toTz)}
              </div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Fetching forecasts...</p>
        </div>
      ) : forecasts && (
        <>
          {/* Passage Summary */}
          <h2 className="text-base font-semibold text-blue-400 mb-2">Passage Summary</h2>
          {legs.map((leg, li) => {
            const legWps = passage.waypoints.filter(
              (w) => w.port.coastlineNm >= leg.from.port.coastlineNm - 0.1 &&
                     w.port.coastlineNm <= leg.to.port.coastlineNm + 0.1
            );
            const fromTz = tzForPort(leg.from.port.lon);
            const toTz = tzForPort(leg.to.port.lon);

            return (
              <div key={li} className="mb-3">
                <div className="bg-slate-800 text-blue-400 text-xs font-semibold px-3 py-1.5 rounded-t-lg border border-slate-800">
                  {mode === "daily" ? `Day ${li + 1} \u2014 ` : ""}Leg {li + 1}: {leg.from.port.name} &rarr; {leg.to.port.name} ({leg.nm} NM, ~{leg.hours.toFixed(1)}h) \u2014 {fmtLocal(leg.departTime, fromTz)} &rarr; {fmtLocal(leg.arriveTime, toTz)}
                </div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-[10px] text-slate-500 uppercase">
                      <th className="text-left px-2 py-1.5 bg-slate-800/50">Waypoint</th>
                      <th className="text-left px-2 py-1.5 bg-slate-800/50">ETA</th>
                      <th className="px-2 py-1.5 bg-slate-800/50"></th>
                      <th className="text-left px-2 py-1.5 bg-slate-800/50">Wind (kt)</th>
                      <th className="px-2 py-1.5 bg-slate-800/50">Gusts</th>
                      <th className="text-left px-2 py-1.5 bg-slate-800/50">Waves</th>
                      <th className="text-left px-2 py-1.5 bg-slate-800/50">Swell</th>
                      <th className="px-2 py-1.5 bg-slate-800/50">Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legWps.map((wp) => {
                      const eta = getWaypointETA(wp);
                      const tz = tzForPort(wp.port.lon);
                      const wpF = forecasts[wp.port.name] || [];
                      const f = closestForecast(wpF, eta);

                      return (
                        <tr key={wp.port.id} className="border-b border-slate-800/50 hover:bg-blue-500/5">
                          <td className={`px-2 py-1.5 font-semibold ${
                            wp.isCape ? "text-yellow-400" : wp.isStop ? "text-green-400" : "text-slate-400"
                          }`}>
                            {wp.port.name}
                            {wp.isStop && <span className="text-[9px] ml-1 border border-green-500 text-green-500 px-0.5 rounded">STOP</span>}
                            {wp.isCape && <span className="text-[9px] ml-1 text-yellow-400 font-bold">CAPE</span>}
                          </td>
                          <td className="px-2 py-1.5 text-blue-300 text-[11px]">{fmtLocal(eta, tz)}</td>
                          {f ? (
                            <>
                              <td className="px-2 py-1.5 text-center">{WEATHER_EMOJI[f.weather] || ""}</td>
                              <td className="px-2 py-1.5">
                                <span className="inline-block text-yellow-400" style={{ transform: `rotate(${f.windDirDeg}deg)` }}>&darr;</span>
                                {" "}{f.windKt} B{bftNum(f.beaufort)}
                              </td>
                              <td className="px-2 py-1.5 text-center">{f.gustKt}</td>
                              <td className="px-2 py-1.5">
                                <span className="inline-block" style={{ transform: `rotate(${f.waveDirDeg}deg)` }}>&darr;</span>
                                {" "}{f.waveM}m / {f.wavePeriodS}s
                              </td>
                              <td className="px-2 py-1.5">
                                <span className="inline-block" style={{ transform: `rotate(${f.swellDirDeg}deg)` }}>&darr;</span>
                                {" "}{f.swellM}m / {f.swellPeriodS}s
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${verdictColor(f.verdict)}`}>
                                  {verdictLabel(f.verdict)}
                                </span>
                              </td>
                            </>
                          ) : (
                            <td colSpan={6} className="px-2 py-1.5 text-slate-500">No data</td>
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
          <h2 className="text-base font-semibold text-blue-400 mb-2 mt-6">Detailed Forecast by Waypoint</h2>
          {passage.waypoints.map((wp) => {
            const allF = forecasts[wp.port.name] || [];
            const eta = getWaypointETA(wp);
            const tz = tzForPort(wp.port.lon);
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
              <details key={wp.port.id} open={!isCollapsed} className={`mb-2 rounded-lg border overflow-hidden ${
                wp.isCape ? "border-yellow-500/30" : wp.isStop ? "border-green-500/30" : "border-slate-800"
              }`}>
                <summary className="px-3 py-2 cursor-pointer bg-slate-800 hover:bg-slate-800 flex items-center gap-2">
                  <span className={`font-semibold text-sm ${
                    wp.isCape ? "text-yellow-400" : wp.isStop ? "text-green-400" : "text-slate-400"
                  }`}>
                    {wp.port.name}
                  </span>
                  <span className="text-[11px] text-slate-500">ETA: {fmtLocal(eta, tz)}</span>
                  <span className="text-[11px] text-slate-600 ml-auto">{dayF.length} entries</span>
                </summary>
                <div className="bg-slate-800">
                  {dayF.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] text-slate-500 uppercase">
                          <th className="text-left px-2 py-1.5">Time</th>
                          <th className="px-2 py-1.5"></th>
                          <th className="text-left px-2 py-1.5">Wind (kt)</th>
                          <th className="px-2 py-1.5">Gusts</th>
                          <th className="text-left px-2 py-1.5">Waves</th>
                          <th className="text-left px-2 py-1.5">Swell</th>
                          <th className="px-2 py-1.5">Verdict</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayF.map((f) => {
                          const dt = new Date(f.time);
                          const diffH = Math.abs(dt.getTime() - eta.getTime()) / 3600000;
                          return (
                            <tr key={f.time} className={`border-b border-slate-800/30 ${diffH < 2 ? "bg-blue-500/10" : ""}`}>
                              <td className="px-2 py-1">{fmtTimeLocal(dt, tz)}</td>
                              <td className="px-2 py-1 text-center">{WEATHER_EMOJI[f.weather] || ""}</td>
                              <td className="px-2 py-1">
                                <span className="inline-block text-yellow-400" style={{ transform: `rotate(${f.windDirDeg}deg)` }}>&darr;</span>
                                {" "}{f.windKt} B{bftNum(f.beaufort)}
                              </td>
                              <td className="px-2 py-1 text-center">{f.gustKt}</td>
                              <td className="px-2 py-1">
                                <span className="inline-block" style={{ transform: `rotate(${f.waveDirDeg}deg)` }}>&darr;</span>
                                {" "}{f.waveM}m / {f.wavePeriodS}s
                              </td>
                              <td className="px-2 py-1">
                                <span className="inline-block" style={{ transform: `rotate(${f.swellDirDeg}deg)` }}>&darr;</span>
                                {" "}{f.swellM}m / {f.swellPeriodS}s
                              </td>
                              <td className="px-2 py-1 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${verdictColor(f.verdict)}`}>
                                  {verdictLabel(f.verdict)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="px-3 py-2 text-slate-500 text-xs">No forecast data</div>
                  )}
                </div>
              </details>
            );
          })}
        </>
      )}

      <div className="text-center text-[10px] text-slate-600 mt-6 pt-4 border-t border-slate-800">
        Planning aid only. Cross-check with AEMET, Meteogalicia, and real-time conditions before departure.
      </div>
    </div>
  );
}
