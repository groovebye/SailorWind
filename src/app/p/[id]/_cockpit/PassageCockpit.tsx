"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Navigation, Sailboat, Map as MapIcon, ExternalLink, RefreshCw,
  Calendar, Gauge, Route, Satellite, Activity, Info, Table2, LineChart, ShieldAlert,
  AlertTriangle, MapPin, Radio, Triangle, Anchor, Clock, Sun, Moon, Sunrise, ChevronRight,
} from "lucide-react";
import { Verdict } from "@/components/design/Primitives";
import { windColor, bfColor, beaufort, overallVerdict, type VerdictV } from "@/components/design/helpers";
import AICoskipper from "./AICoskipper";
import MetarCard from "./MetarCard";
import { nearestAirport } from "./airports";
import {
  buildLegs, fetchSeries, fetchConsensus, sunForDay, nearestIdx, fmtMS, verdictFor, powerFor, buildTimeline,
  type WP, type LocSeries, type TimelineHour, type Consensus,
} from "./forecast";
import { moon, isDaylight } from "@/lib/astro";

const MODEL_SHORT: Record<string, string> = { gfs: "GFS_SEAMLESS", ecmwf: "ECMWF_IFS025", ens: "BEST_MATCH" };
const VC_HEX: Record<VerdictV, string> = { GO: "#36d399", CAUTION: "#ffc24b", NOGO: "#ff6b8a" };
const fmtHM = (epoch: number | null): string =>
  epoch == null ? "—" : new Date(epoch).toLocaleString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false });

export default function PassageCockpit(props: {
  passageId: string; from: string; to: string; boat: string; boatModel: string;
  speed: number; mode: string; model: string; wps: WP[];
}) {
  const { wps } = props;
  const [depIdx, setDepIdx] = useState(0);
  const [speed, setSpeed] = useState(props.speed || 6);
  const [mode, setMode] = useState<"Non-stop" | "Day-hops">(props.mode === "nonstop" ? "Non-stop" : "Day-hops");
  const [model, setModel] = useState<"gfs" | "ecmwf" | "ens">(
    props.model?.includes("gfs") ? "gfs" : props.model?.includes("ecmwf") ? "ecmwf" : "ecmwf",
  );
  const [openWp, setOpenWp] = useState(wps[0]?.name ?? "");
  const [series, setSeries] = useState<LocSeries[] | null>(null);
  const [consensus, setConsensus] = useState<Consensus | null>(null);
  // Floor "now" to the hour for the 48h window. Client-only value; nothing that
  // depends on it renders until the forecast fetch resolves, so no SSR mismatch.
  const [baseTime] = useState(() => (typeof window === "undefined" ? 0 : Math.floor(Date.now() / 3600_000) * 3600_000));
  const [err, setErr] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const [s, c] = await Promise.all([fetchSeries(wps, model), fetchConsensus(wps[0].lat, wps[0].lon)]);
        if (!ignore) { setSeries(s); setConsensus(c); setErr(false); }
      } catch {
        if (!ignore) setErr(true);
      }
    })();
    return () => { ignore = true; };
  }, [wps, model, reloadKey]);

  const legs = useMemo(() => buildLegs(wps), [wps]);
  const timeline = useMemo<TimelineHour[]>(
    () => (series && baseTime ? buildTimeline(series[0], baseTime, consensus) : []),
    [series, baseTime, consensus],
  );
  const depEpoch = baseTime + depIdx * 3600_000;

  const rows = useMemo(() => {
    if (!series || !baseTime) return [];
    return wps.map((w, i) => {
      const etaEpoch = depEpoch + (legs.cum[i] / speed) * 3600_000;
      const s = series[i] ?? series[0];
      const idx = nearestIdx(s.time, etaEpoch);
      const wind = idx >= 0 ? s.wind[idx] ?? 0 : 0;
      const gust = idx >= 0 ? s.gust[idx] ?? wind + 4 : wind + 4;
      const wave = idx >= 0 ? s.wave[idx] : null;
      const period = idx >= 0 ? s.period[idx] : null;
      const swell = idx >= 0 ? s.swell[idx] : null;
      const swellP = idx >= 0 ? s.swellPeriod[idx] : null;
      const cur = idx >= 0 ? s.current[idx] : null;
      const curDir = idx >= 0 ? s.currentDir[idx] : null;
      const { sunrise, sunset } = sunForDay(s, etaEpoch);
      const type: "STOP" | "CAPE" | "PORT" = w.isStop ? "STOP" : w.isCape ? "CAPE" : "PORT";
      return {
        name: w.name, slug: w.slug, type,
        eta: new Date(etaEpoch).toLocaleString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false }),
        etaEpoch, wind, gust, bf: beaufort(wind),
        wave: fmtMS(wave, period), swell: fmtMS(swell, swellP),
        cur, curDir, daylight: isDaylight(etaEpoch, sunrise, sunset),
        power: powerFor(wind, gust, wave), verdict: verdictFor(wind, gust, wave),
      };
    });
  }, [series, baseTime, depEpoch, legs, speed, wps]);

  // Group waypoints into legs (consecutive STOP→STOP, matching the leg page's indexing).
  const legCards = useMemo(() => {
    if (!rows.length) return [];
    const stopIdx = wps.map((w, i) => (w.isStop ? i : -1)).filter((i) => i >= 0);
    const out: { index: number; from: string; to: string; dist: number; hours: number; depEta: string; arrEta: string; verdict: VerdictV; maxWind: number; maxGust: number; capes: number }[] = [];
    for (let k = 0; k < stopIdx.length - 1; k++) {
      const a = stopIdx[k], b = stopIdx[k + 1];
      const lr = rows.slice(a, b + 1);
      const dist = legs.cum[b] - legs.cum[a];
      out.push({
        index: k, from: wps[a].name, to: wps[b].name,
        dist, hours: speed > 0 ? dist / speed : 0,
        depEta: rows[a].eta, arrEta: rows[b].eta,
        verdict: overallVerdict(lr.map((r) => r.verdict)),
        maxWind: Math.max(...lr.map((r) => r.wind)),
        maxGust: Math.max(...lr.map((r) => r.gust)),
        capes: lr.filter((r) => r.type === "CAPE").length,
      });
    }
    return out;
  }, [rows, wps, legs, speed]);

  const overall: VerdictV = rows.length ? overallVerdict(rows.map((r) => r.verdict)) : "GO";
  const durationH = speed > 0 ? legs.totalNm / speed : 0;
  const capes = wps.filter((w) => w.isCape).length;
  const arrival = rows.length ? rows[rows.length - 1].eta : null;
  const depLabel = timeline[depIdx]?.label ?? "—";

  const openIdx = Math.max(0, wps.findIndex((w) => w.name === openWp));
  const fcRows = useMemo(() => {
    if (!series || !baseTime) return [];
    const s = series[openIdx] ?? series[0];
    return Array.from({ length: 8 }, (_, k) => {
      const epoch = depEpoch + k * 3 * 3600_000;
      const idx = nearestIdx(s.time, epoch);
      const wind = idx >= 0 ? s.wind[idx] ?? 0 : 0;
      const gust = idx >= 0 ? s.gust[idx] ?? wind + 4 : wind + 4;
      return {
        time: new Date(epoch).toLocaleString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false }),
        wind, gust, bf: beaufort(wind),
      };
    });
  }, [series, baseTime, depEpoch, openIdx]);

  // Daylight / moon / model-spread for the chosen departure.
  const startSun = series && baseTime ? sunForDay(series[0], depEpoch) : { sunrise: null, sunset: null };
  const moonNow = baseTime ? moon(depEpoch) : null;
  const depSpread = consensus ? consensus.spread[nearestIdx(consensus.time, depEpoch)] ?? 0 : 0;
  const arrivalRow = rows[rows.length - 1];

  const aiCtx = {
    timeline, wps,
    capeEtas: rows.filter((r) => r.type === "CAPE").map((r) => ({ name: r.name, eta: r.eta, daylight: r.daylight })),
    arrival, arrivalDaylight: arrivalRow?.daylight ?? true,
    sunsetLabel: fmtHM(startSun.sunset), sunriseLabel: fmtHM(startSun.sunrise),
    moonIllum: moonNow ? Math.round(moonNow.illum * 100) : null, moonName: moonNow?.name ?? null,
    consensusModels: consensus?.models ?? [], depSpread,
    modelShort: MODEL_SHORT[model],
  };
  const orcaWps = wps.filter((w) => w.orcaRisk && w.orcaRisk !== "none");
  const airportIcaos = useMemo(() => {
    const a = nearestAirport(wps[0].lat, wps[0].lon);
    const b = nearestAirport(wps[wps.length - 1].lat, wps[wps.length - 1].lon);
    return a.icao === b.icao ? [a.icao] : [a.icao, b.icao];
  }, [wps]);

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 80 }}>
      {/* breadcrumb + title */}
      <div className="between fade-up" style={{ marginBottom: 18, flexWrap: "wrap", gap: 14 }}>
        <div className="center gap-12">
          <Link href="/" className="btn btn-sm btn-ghost"><ArrowLeft size={16} /> Home</Link>
          <div className="pd-title">
            <span className="route-port">{props.from}</span>
            <Navigation size={18} style={{ color: "var(--cyan)", transform: "rotate(90deg)" }} />
            <span className="route-port">{props.to}</span>
          </div>
        </div>
        <div className="flex gap-8 wrap">
          <span className="pill"><Sailboat size={13} /> {props.boat} · {props.boatModel}</span>
          <Link href={`/p/${props.passageId}/map`} className="btn btn-sm"><MapIcon size={15} /> Map</Link>
          <a className="btn btn-sm btn-ghost" href="https://www.windy.com" target="_blank" rel="noreferrer"><ExternalLink size={15} /> Windy</a>
          <button className="btn btn-sm btn-primary" onClick={() => { setSeries(null); setReloadKey((k) => k + 1); }}><RefreshCw size={15} /> Update</button>
        </div>
      </div>

      {/* config bar */}
      <div className="glass config-bar fade-up" style={{ animationDelay: ".05s" }}>
        <ConfigField label="Departure" icon={<Calendar size={12} />}>
          <select className="select" value={depIdx} onChange={(e) => setDepIdx(+e.target.value)}>
            {(timeline.length ? timeline.slice(0, 24) : [{ label: "loading…" }]).map((t, i) => (
              <option key={i} value={i}>{t.label}</option>
            ))}
          </select>
        </ConfigField>
        <ConfigField label="Boat speed" icon={<Gauge size={12} />}>
          <div className="center gap-10">
            <input type="range" min={3} max={9} step={0.5} value={speed} onChange={(e) => setSpeed(+e.target.value)} className="range" />
            <span className="mono" style={{ fontSize: 16, fontWeight: 600, minWidth: 52 }}>{speed} kt</span>
          </div>
        </ConfigField>
        <ConfigField label="Mode" icon={<Route size={12} />}>
          <div className="seg">
            {(["Non-stop", "Day-hops"] as const).map((m) => (
              <button key={m} className={`seg-opt${mode === m ? " active" : ""}`} onClick={() => setMode(m)}>{m}</button>
            ))}
          </div>
        </ConfigField>
        <ConfigField label="Weather model" icon={<Satellite size={12} />}>
          <div className="seg">
            {(["gfs", "ecmwf", "ens"] as const).map((m) => (
              <button key={m} className={`seg-opt${model === m ? " active" : ""}`} onClick={() => setModel(m)}>
                {m === "gfs" ? "GFS" : m === "ecmwf" ? "ECMWF" : "Ensemble"}
              </button>
            ))}
          </div>
        </ConfigField>
      </div>

      {/* stats row */}
      <div className="pd-stats fade-up" style={{ animationDelay: ".1s" }}>
        <BigStat icon={<Navigation size={17} />} value={legs.totalNm.toFixed(1)} unit=" NM" label="Distance" />
        <BigStat icon={<Clock size={17} />} value={`~${durationH.toFixed(1)}`} unit=" h" label="Duration" />
        <BigStat icon={<Triangle size={17} />} value={String(capes)} unit="" label="Capes" />
        <BigStat icon={<Anchor size={17} />} value={String(wps.length)} unit="" label="Waypoints" />
        <div className="glass big-stat verdict-stat" style={{
          background: `linear-gradient(180deg, ${VC_HEX[overall]}24, transparent)`,
          borderColor: `${VC_HEX[overall]}55`,
        }}>
          <div className="faint mono" style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase" }}>Verdict</div>
          <Verdict v={overall} size="lg" />
          <div className="faint mono" style={{ fontSize: 11, marginTop: 4 }}>
            {depLabel}{arrival ? ` → ${arrival}` : ""}
          </div>
        </div>
      </div>

      {/* main grid */}
      <div className="pd-grid">
        <div className="col gap-20">
          {/* departure window */}
          <div className="glass fade-up" style={{ padding: 22, animationDelay: ".15s" }}>
            <div className="between" style={{ marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
              <div className="center gap-10">
                <div className="sec-icon" style={{ width: 32, height: 32 }}><Activity size={16} /></div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>Departure window</div>
                  <div className="faint mono" style={{ fontSize: 11 }}>next 48h · drag to choose your start</div>
                </div>
              </div>
              <span className="pill"><Info size={12} /> aggregate GO/NO-GO score</span>
            </div>
            {timeline.length ? (
              <DepartureTimeline timeline={timeline} depIdx={depIdx} setDepIdx={setDepIdx} />
            ) : (
              <div className="faint mono" style={{ padding: "30px 0", textAlign: "center" }}>
                {err ? "offline — no live forecast" : "loading forecast…"}
              </div>
            )}
            {timeline.length > 0 && (
              <div className="flex gap-16 wrap" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--glass-border)", fontSize: 12 }}>
                <span className="center gap-6 dim">
                  <Sunrise size={13} style={{ color: "var(--caution)" }} /> {fmtHM(startSun.sunrise)}–{fmtHM(startSun.sunset)} <span className="faint">daylight</span>
                </span>
                {moonNow && (
                  <span className="center gap-6 dim">
                    <span style={{ fontFamily: "system-ui" }}>{moonNow.emoji}</span> {Math.round(moonNow.illum * 100)}% <span className="faint">{moonNow.name.toLowerCase()}</span>
                  </span>
                )}
                {consensus && (
                  <span className="center gap-6 dim" title="Spread across weather models at the chosen hour — wider = less certain">
                    <Satellite size={13} style={{ color: "var(--cyan)" }} /> {consensus.models.join("/")} · spread ±{depSpread}kt
                  </span>
                )}
              </div>
            )}
          </div>

          {/* passage summary */}
          <div className="glass fade-up" style={{ padding: 0, animationDelay: ".2s", overflow: "hidden" }}>
            <div className="pd-table-head">
              <div className="center gap-10"><Table2 size={16} style={{ color: "var(--cyan)" }} />
                <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>Passage summary</span>
              </div>
              <span className="faint mono" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{legs.totalNm.toFixed(1)} NM · {wps.length} waypoints</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Waypoint</th><th>ETA</th><th>Wind</th>
                    <th className="hide-mobile">Gust</th><th className="hide-mobile">Waves</th>
                    <th className="hide-mobile">Swell</th><th>Power</th><th>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((w, i) => (
                    <tr key={i} onClick={() => setOpenWp(w.name)}>
                      <td>
                        <div className="center gap-8">
                          <WpDot type={w.type} />
                          <span style={{ fontWeight: 600 }}>{w.name}</span>
                          {w.type === "CAPE" && <span className="pill" style={{ fontSize: 9.5, color: "var(--caution)" }}>cape</span>}
                        </div>
                      </td>
                      <td className="num dim">
                        <span className="center gap-6" style={{ whiteSpace: "nowrap" }}>
                          {w.eta}
                          {w.daylight
                            ? <Sun size={11} style={{ color: "var(--caution)" }} aria-label="daylight" />
                            : <Moon size={11} style={{ color: "var(--sky)" }} aria-label="after dark" />}
                        </span>
                      </td>
                      <td><WindCell kt={w.wind} bf={w.bf} /></td>
                      <td className="num hide-mobile" style={{ color: windColor(w.gust) }}>{w.gust}</td>
                      <td className="num dim hide-mobile">{w.wave}</td>
                      <td className="num dim hide-mobile">
                        {w.swell}
                        {w.cur != null && w.cur >= 0.3 && <span style={{ color: "var(--sky)" }}> · ↝{w.cur}kn</span>}
                      </td>
                      <td><PowerBar v={w.power} /></td>
                      <td><Verdict v={w.verdict} /></td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr><td colSpan={8} className="faint" style={{ textAlign: "center", padding: 28 }}>
                      {err ? "offline — no live forecast" : "loading…"}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* legs — drill-down into the full per-leg detail */}
          {legCards.length > 0 && (
            <div className="glass fade-up" style={{ padding: 22, animationDelay: ".23s" }}>
              <div className="center gap-10" style={{ marginBottom: 14 }}>
                <div className="sec-icon" style={{ width: 32, height: 32 }}><Route size={16} /></div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>Legs — full detail</div>
                  <div className="faint mono" style={{ fontSize: 11 }}>open a leg for hazards · tides · pilotage · marina · checklist</div>
                </div>
              </div>
              <div className="col gap-10">
                {legCards.map((l) => (
                  <Link
                    key={l.index}
                    href={`/p/${props.passageId}/leg/${l.index}`}
                    className="glass-hover"
                    style={{ display: "block", padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid var(--glass-border)", textDecoration: "none", color: "inherit" }}
                  >
                    <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
                      <div className="center gap-8">
                        <span className="mono faint" style={{ fontSize: 11 }}>Leg {l.index + 1}</span>
                        <span style={{ fontWeight: 600 }}>{l.from} <span style={{ color: "var(--cyan)" }}>→</span> {l.to}</span>
                      </div>
                      <Verdict v={l.verdict} />
                    </div>
                    <div className="flex gap-16 wrap dim" style={{ fontSize: 12, marginTop: 8 }}>
                      <span className="mono">{l.dist.toFixed(1)} NM</span>
                      <span className="mono">~{l.hours.toFixed(1)} h</span>
                      <span className="mono">{l.depEta} → {l.arrEta}</span>
                      <span className="mono" style={{ color: windColor(l.maxWind) }}>max {l.maxWind} kt · gust {l.maxGust}</span>
                      {l.capes > 0 && <span className="mono">{l.capes} cape{l.capes > 1 ? "s" : ""}</span>}
                    </div>
                    <div className="center gap-6 faint mono" style={{ fontSize: 11, marginTop: 8 }}>
                      Hazards · Tides · Pilotage · Marina · Checklist <ChevronRight size={12} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* detailed forecast */}
          <div className="glass fade-up" style={{ padding: 22, animationDelay: ".25s" }}>
            <div className="center gap-10" style={{ marginBottom: 16 }}>
              <LineChart size={16} style={{ color: "var(--cyan)" }} />
              <span style={{ fontWeight: 600 }}>Detailed forecast by waypoint</span>
            </div>
            <div className="flex gap-8 wrap" style={{ marginBottom: 18 }}>
              {wps.map((w) => (
                <button key={w.name} className={`wp-tab${openWp === w.name ? " active" : ""}`} onClick={() => setOpenWp(w.name)}>{w.name}</button>
              ))}
            </div>
            {fcRows.length ? <ForecastChart rows={fcRows} /> : <div className="faint mono" style={{ padding: 20 }}>—</div>}
          </div>

          <MetarCard icaos={airportIcaos} />

          <div className="disclaimer">
            <ShieldAlert size={14} />
            Planning aid only. Cross-check with AEMET, MeteoGalicia / IPMA and real-time conditions before departure.
          </div>
        </div>

        {/* sidebar */}
        <div className="pd-side">
          <AICoskipper ctx={aiCtx} />
          <div className="glass orca-card" style={{ padding: 18 }}>
            <div className="between" style={{ marginBottom: 12 }}>
              <div className="center gap-10">
                <div className="orca-orb"><AlertTriangle size={15} /></div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Orca watch</div>
                  <div className="faint mono" style={{ fontSize: 10.5 }}>{orcaWps.length} zone{orcaWps.length === 1 ? "" : "s"} on route</div>
                </div>
              </div>
              <span className="pill"><Radio size={12} /> live</span>
            </div>
            {orcaWps.length ? orcaWps.slice(0, 4).map((w) => {
              const c = w.orcaRisk === "high" ? "var(--nogo)" : w.orcaRisk === "medium" ? "var(--orca)" : "var(--sky)";
              return (
                <div key={w.slug} className="orca-row">
                  <span className="center gap-8"><span className="orca-lvl" style={{ background: c }} /> {w.name}</span>
                  <span className="mono faint" style={{ fontSize: 11 }}>{w.orcaRisk}</span>
                </div>
              );
            }) : <div className="dim" style={{ fontSize: 13, padding: "4px 0" }}>No elevated zones flagged on this route.</div>}
            <Link href={`/p/${props.passageId}/map`} className="btn btn-sm" style={{ width: "100%", marginTop: 12 }}>
              <MapPin size={14} /> View zones on chart
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigField({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="config-field">
      <div className="field-label center gap-6">{icon} {label}</div>
      {children}
    </div>
  );
}
function BigStat({ icon, value, unit, label }: { icon: React.ReactNode; value: string; unit: string; label: string }) {
  return (
    <div className="glass big-stat">
      <span style={{ color: "var(--cyan)", opacity: 0.8, display: "flex" }}>{icon}</span>
      <div className="stat-num" style={{ fontSize: 30, marginTop: 8 }}>{value}<span style={{ fontSize: 15, color: "var(--fg-dim)" }}>{unit}</span></div>
      <div className="faint mono" style={{ fontSize: 10.5, letterSpacing: 0.6, textTransform: "uppercase", marginTop: 2 }}>{label}</div>
    </div>
  );
}
function WpDot({ type }: { type: "STOP" | "CAPE" | "PORT" }) {
  const c = type === "STOP" ? "var(--cyan)" : type === "CAPE" ? "var(--caution)" : "var(--fg-faint)";
  return <span style={{ width: 9, height: 9, borderRadius: type === "CAPE" ? 2 : 99, background: c, boxShadow: `0 0 8px ${c}`, transform: type === "CAPE" ? "rotate(45deg)" : "none", flexShrink: 0 }} />;
}
function WindCell({ kt, bf }: { kt: number; bf: number }) {
  return (
    <span className="center gap-8">
      <span className="mono" style={{ fontWeight: 600, color: windColor(kt) }}>{kt}</span>
      <span className="bf-chip" style={{ background: bfColor(bf) + "22", color: bfColor(bf) }}>B{bf}</span>
    </span>
  );
}
function PowerBar({ v }: { v: number }) {
  const pct = Math.min(100, (v / 14) * 100);
  const c = v < 5 ? "var(--go)" : v < 10 ? "var(--cyan)" : v < 13 ? "var(--caution)" : "var(--nogo)";
  return (
    <span className="center gap-8">
      <span className="power-track"><span className="power-fill" style={{ width: pct + "%", background: c }} /></span>
      <span className="mono" style={{ fontSize: 12, minWidth: 26 }}>{v}</span>
    </span>
  );
}

function DepartureTimeline({ timeline, depIdx, setDepIdx }: { timeline: TimelineHour[]; depIdx: number; setDepIdx: (n: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const cur = timeline[depIdx] ?? timeline[0];
  const pick = useCallback((clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return;
    const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    setDepIdx(Math.round(p * (timeline.length - 1)));
  }, [timeline, setDepIdx]);
  useEffect(() => {
    const move = (e: MouseEvent) => { if (drag.current) pick(e.clientX); };
    const up = () => (drag.current = false);
    const tmove = (e: TouchEvent) => { if (drag.current && e.touches[0]) pick(e.touches[0].clientX); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", tmove);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", tmove); window.removeEventListener("touchend", up);
    };
  }, [pick]);
  if (!cur) return null;
  return (
    <div>
      <div className="between" style={{ margin: "14px 0 10px", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div className="display" style={{ fontSize: 22, whiteSpace: "nowrap" }}>{cur.label}</div>
          <div className="faint mono" style={{ fontSize: 11 }}>start of passage</div>
        </div>
        <div className="center gap-16">
          <div style={{ textAlign: "right" }}>
            <div className="mono" style={{ fontSize: 13, color: windColor(cur.wind), whiteSpace: "nowrap" }}>{cur.wind} kt · gust {cur.gust}</div>
            <div className="faint mono" style={{ fontSize: 11 }}>confidence {cur.score}/10</div>
          </div>
          <Verdict v={cur.verdict} size="lg" />
        </div>
      </div>
      <div className="tl-track" ref={trackRef} onMouseDown={(e) => { drag.current = true; pick(e.clientX); }}
        onTouchStart={(e) => { drag.current = true; if (e.touches[0]) pick(e.touches[0].clientX); }}>
        {timeline.map((t, i) => {
          const c = t.verdict === "GO" ? "var(--go)" : t.verdict === "CAUTION" ? "var(--caution)" : "var(--nogo)";
          return <div key={i} className="tl-bar" style={{ height: 18 + t.score * 6.4, background: c, opacity: i === depIdx ? 1 : 0.42 }} title={`${t.label} · ${t.verdict}`} />;
        })}
        <div className="tl-marker" style={{ left: (depIdx / (timeline.length - 1)) * 100 + "%" }}>
          <div className="tl-handle"><Navigation size={13} style={{ transform: "rotate(90deg)" }} /></div>
        </div>
      </div>
      <div className="tl-axis"><span>Now</span><span>+12h</span><span>+24h</span><span>+36h</span><span>+48h</span></div>
    </div>
  );
}

function ForecastChart({ rows }: { rows: { time: string; wind: number; gust: number; bf: number }[] }) {
  const maxG = Math.max(1, ...rows.map((r) => r.gust));
  return (
    <div>
      <div className="fc-chart">
        {rows.map((r, i) => (
          <div key={i} className="fc-col" style={{ animationDelay: i * 0.04 + "s" }}>
            <div className="fc-gust" style={{ height: (r.gust / maxG) * 130 }} />
            <div className="fc-wind" style={{ height: (r.wind / maxG) * 130, background: windColor(r.wind) }}>
              <span className="fc-val mono">{r.wind}</span>
            </div>
            <div className="fc-time mono">{r.time}</div>
            <div className="bf-chip" style={{ background: bfColor(r.bf) + "22", color: bfColor(r.bf), marginTop: 4 }}>B{r.bf}</div>
          </div>
        ))}
      </div>
      <div className="center gap-16" style={{ marginTop: 16, justifyContent: "center" }}>
        <span className="center gap-6 faint mono" style={{ fontSize: 11 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--cyan)" }} /> Wind (kt)</span>
        <span className="center gap-6 faint mono" style={{ fontSize: 11 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(255,255,255,0.18)" }} /> Gust</span>
        <span className="faint mono" style={{ fontSize: 11 }}>· 3-hour steps from departure</span>
      </div>
    </div>
  );
}
