"use client";

import { useEffect, useState } from "react";
import type { DepartureWindowsResult, DepartureWindowRow, ScenarioOutcome, WindowTag } from "@/lib/departure-windows";

type Response = DepartureWindowsResult & {
  leg: { from: string; to: string; distanceNm: number };
  vessel: { name: string; engineCruiseKt: number };
  forecastModel: string;
  stepHours: number;
};

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const compass = (deg: number | null) => (deg == null ? "var" : COMPASS[Math.round(deg / 22.5) % 16]);

const TAG_LABEL: Record<WindowTag, string> = {
  "best-balance": "★ best balance",
  "least-motoring": "least engine",
  "calmest-sea": "calmest sea",
  fastest: "fastest",
};

function fmtUtc(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "");
}

function toInputValue(iso: string) {
  return iso.slice(0, 16); // UTC wall-clock, the override convention
}

function fmtHm(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false });
}

/**
 * Earliest–latest arrival across the scenarios. Not "optimistic = earliest":
 * a better-sailing boat motors less, so in marginal wind it can arrive later.
 */
function arrivalRange(row: DepartureWindowRow) {
  const all = Object.values(row.outcomes) as ScenarioOutcome[];
  const sorted = [...all].sort((a, b) => Date.parse(a.arrival) - Date.parse(b.arrival));
  const first = sorted[0], last = sorted[sorted.length - 1];
  const detail = all.map((o) => `${o.scenario} ${fmtUtc(o.arrival)} · ${o.hours} h · engine ${o.motoringPct}% · ${o.fuelL} L`).join("\n");
  return { first, last, detail };
}

function verdictStyle(v: DepartureWindowRow["verdict"]) {
  if (v === "NO-GO") return { color: "var(--text-red)", background: "var(--accent-nogo)" };
  if (v === "CAUTION") return { color: "var(--text-yellow)", background: "var(--accent-caution)" };
  return { color: "var(--text-green)", background: "var(--accent-go)" };
}

/**
 * Departure windows: the leg simulated for a series of start times, each under
 * pessimistic / realistic / optimistic scenarios (see lib/departure-windows).
 * Loads only when opened — it's 3 timeline runs per row.
 */
export default function DepartureWindows({ passageId, legIndex, refreshKey = 0, onPick }: {
  passageId: string;
  legIndex: number;
  /** Bump to recompute (e.g. after the leg's route changed). */
  refreshKey?: number;
  onPick?: (localIso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [stepHours, setStepHours] = useState(6);
  const [spanHours, setSpanHours] = useState(72);
  const [result, setResult] = useState<{ key: string; data: Response | null; error: string | null } | null>(null);

  const count = Math.min(40, Math.floor(spanHours / stepHours) + 1);
  const key = `${passageId}/${legIndex}/${stepHours}/${count}/${refreshKey}`;
  const loading = open && result?.key !== key;
  const data = result?.data ?? null;
  const error = result?.error ?? null;

  useEffect(() => {
    if (!open) return;
    const c = new AbortController();
    fetch(`/api/departure-windows?passageId=${passageId}&legIndex=${legIndex}&stepHours=${stepHours}&count=${count}`, { signal: c.signal })
      .then((r) => r.json())
      .then((d) => setResult(d.error ? { key, data: null, error: d.error } : { key, data: d, error: null }))
      .catch((e) => { if (e.name !== "AbortError") setResult({ key, data: null, error: "Could not load departure windows" }); });
    return () => c.abort();
  }, [open, key, passageId, legIndex, stepHours, count]);

  const pess = data?.scenarios.find((s) => s.key === "pessimistic");
  const opt = data?.scenarios.find((s) => s.key === "optimistic");

  return (
    <details className="glass group mb-3" style={{ overflow: "hidden" }} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="px-4 py-3 cursor-pointer flex items-center gap-2.5 select-none">
        <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" style={{ color: "var(--cyan)", flex: "none" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        <span style={{ fontSize: 15 }}>🗓️</span>
        <span className="display" style={{ fontSize: 17, color: "var(--fg)" }}>Departure windows</span>
        <span className="faint mono" style={{ fontSize: 11 }}>pessimistic · realistic · optimistic</span>
      </summary>
      <div className="px-4 pb-4 pt-2 text-sm" style={{ borderTop: `1px solid var(--glass-border)` }}>
        <div className="flex gap-3 items-end flex-wrap mb-3 text-xs">
          <label>
            <span className="field-label">Every</span>
            <select className="select" value={stepHours} onChange={(e) => setStepHours(+e.target.value)}>
              {[3, 6, 12].map((h) => <option key={h} value={h}>{h} h</option>)}
            </select>
          </label>
          <label>
            <span className="field-label">Over the next</span>
            <select className="select" value={spanHours} onChange={(e) => setSpanHours(+e.target.value)}>
              {[[24, "24 h"], [48, "2 days"], [72, "3 days"], [120, "5 days"]].map(([h, l]) => <option key={h} value={h}>{l}</option>)}
            </select>
          </label>
          {data && (
            <span className="faint mono" style={{ fontSize: 11 }}>
              {data.leg.from} → {data.leg.to} · {data.leg.distanceNm} NM · {data.forecastModel} · times UTC
            </span>
          )}
        </div>

        {loading && !data && <div className="faint mono" style={{ padding: "20px 0", textAlign: "center" }}>simulating departures…</div>}
        {error && <div style={{ color: "var(--text-red)" }}>{error}</div>}

        {data && (
          <div style={{ overflowX: "auto", opacity: loading ? 0.5 : 1 }}>
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Depart</th><th>Arrive</th><th className="hide-mobile">Range</th><th>h</th>
                  <th>Engine</th><th className="hide-mobile">Wind</th><th>Max kn</th><th>Hs</th>
                  <th>Verdict</th>{onPick && <th />}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const r = row.outcomes.realistic;
                  const best = row.tags.includes("best-balance");
                  const range = arrivalRange(row);
                  return (
                    <tr key={row.departure} style={{ cursor: "default", opacity: row.beyondForecast ? 0.55 : 1, background: best ? "var(--accent-go)" : undefined }}>
                      <td className="num" style={{ fontWeight: best ? 700 : 500 }}>{fmtUtc(row.departure)}</td>
                      <td className="num" title={r.minutesBeforeSunset != null ? `${Math.abs(r.minutesBeforeSunset)} min ${r.minutesBeforeSunset >= 0 ? "before" : "after"} sunset` : undefined}>
                        {fmtUtc(r.arrival)} {r.arrivalDaylight ? "☀️" : "🌙"}
                      </td>
                      <td className="num dim hide-mobile" title={range.detail}>
                        {fmtHm(range.first.arrival)}–{fmtHm(range.last.arrival)} {range.last.arrivalDaylight ? "☀️" : "🌙"}
                      </td>
                      <td className="num" title={row.dayFit === "overnight" ? `over ${data.dayLimits.maxHours} h — overnight or split at a relax stop` : row.dayFit === "long-day" ? `over the ${data.dayLimits.targetHours} h day target` : undefined}>
                        {r.hours.toFixed(0)}{row.dayFit !== "day" && <span style={{ color: row.dayFit === "overnight" ? "var(--sky)" : "var(--caution)" }}>{row.dayFit === "overnight" ? " 🌙" : " !"}</span>}
                      </td>
                      <td className="num" title={`pessimistic ${row.outcomes.pessimistic.motoringPct}% · ${row.outcomes.pessimistic.fuelL} L`}>
                        {r.motoringPct}% <span className="faint">· {r.fuelL} L</span>
                      </td>
                      <td className="num dim hide-mobile">{row.meanWindKt.toFixed(0)} kn {compass(row.meanWindDirDeg)}</td>
                      <td className="num" title={`pessimistic +${Math.round((pess?.conditionsMargin ?? 1) * 100 - 100)}%: ${row.outcomes.pessimistic.maxWindKt} / ${row.outcomes.pessimistic.maxGustKt}`}>
                        {r.maxWindKt} / {r.maxGustKt}
                      </td>
                      <td className="num" title={`pessimistic ${row.outcomes.pessimistic.maxWaveM} m`}>{r.maxWaveM} m</td>
                      <td style={{ whiteSpace: "normal", minWidth: 110 }}>
                        <span className="px-1.5 py-0.5 rounded font-bold text-[10px]" style={verdictStyle(row.verdict)} title={row.reasons.join("; ") || undefined}>{row.verdict}</span>
                        {row.tags.map((t) => <span key={t} className="faint mono" style={{ fontSize: 10, marginLeft: 6 }}>{TAG_LABEL[t]}</span>)}
                        {row.beyondForecast && <span className="faint mono" style={{ fontSize: 10, marginLeft: 6 }}>past forecast</span>}
                      </td>
                      {onPick && (
                        <td>
                          <button className="btn btn-sm btn-ghost" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => onPick(toInputValue(row.departure))} title="Set this as the leg's departure">Use</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="faint mono" style={{ fontSize: 10.5, marginTop: 10, lineHeight: 1.6 }}>
              Arrive/h/engine/wind/Hs: realistic run; Range: earliest–latest arrival of the three scenarios (hover for each — a better-sailing boat motors less, so it can arrive later) ({data.vessel.name} polar, engine {data.vessel.engineCruiseKt} kn).
              {pess && ` Pessimistic: ${Math.round(pess.sailSpeedFactor * 100)}% polar, engine ×${pess.engineSpeedFactor}, +${Math.round(pess.conditionsMargin * 100 - 100)}% wind/sea margin — can raise CAUTION; NO-GO only from the realistic run.`}
              {opt && ` Optimistic: ${Math.round(opt.sailSpeedFactor * 100)}% polar.`}
              {` ☀️ = arrives between sunrise and sunset at ${data.leg.to}. 🌙 in h = over ${data.dayLimits.maxHours} h (overnight, or split at a relax stop).`}
              {data.forecastHorizon && ` Forecast ends ${fmtUtc(data.forecastHorizon)}; greyed rows arrive after it.`}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
