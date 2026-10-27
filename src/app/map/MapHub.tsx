"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Anchor, Check, CloudDownload, Download, ExternalLink, Layers, Pencil, RotateCcw, Route, TriangleAlert,
  Undo2, Upload, Wind, X,
} from "lucide-react";
import DepartureWindows from "@/components/DepartureWindows";
import { windColor } from "@/components/design/helpers";
import { polylineDistanceNm } from "@/lib/geo";
import { prepareLegImport } from "@/lib/gpx";
import {
  BASE_CHOICES, DEPTH_CONTOURS, DEPTH_STYLES, HOME_BERTH, IHM_ENC, SEAMARKS, WINDY_OVERLAYS, depthShaded, formatDdm, resolveBase,
  windyEmbedUrl, type BaseChoice, type DepthStyle, type WindyOverlay,
} from "@/lib/map-layers";
import { dropPlanOffline, exportUrl, legRouteUrl, savePlanOffline, type PlanLeg, type SavedPlan } from "@/lib/offline-plan";
import { sameRoute, type RoutePt } from "@/lib/route-edit";
import { shallowStretches } from "@/lib/searoute";
import { useStoredState } from "@/lib/use-stored-state";
import {
  WAVE_LEGEND, WEATHER_MODELS, latticeFor, timeIndexNear, weatherGridQuery,
  type Bounds, type WeatherGrid, type WeatherGridModel,
} from "@/lib/weather-grid";

const HubMap = dynamic(() => import("./HubMap"), {
  ssr: false,
  loading: () => <div className="hub-loading mono faint">loading chart…</div>,
});

export type HubWaypoint = {
  name: string; lat: number; lon: number; isStop: boolean; isCape: boolean; orcaRisk: string | null;
  approach: { lat: number; lon: number; note: string | null } | null;
};
export type HubPassage = { id: string; name: string | null; waypoints: HubWaypoint[]; legs: PlanLeg[] };
export type HubPassageSummary = { id: string; label: string; departure: string };
export type LegRoute = { mode: "auto" | "manual"; points: RoutePt[]; distanceNm: number; departureOverride: string | null };
export type MapView = { bounds: Bounds; lat: number; lon: number; zoom: number };
export type FitTarget = { key: string; points: [number, number][] } | null;

export type LayerState = {
  base: BaseChoice;
  seamarks: boolean;
  depth: boolean;
  depthStyle: DepthStyle;
  contours: boolean;
  isobaths: boolean;
  wind: boolean;
  waves: boolean;
  orca: boolean;
  model: WeatherGridModel;
};
const DEFAULT_LAYERS: LayerState = {
  base: "auto", seamarks: true, depth: false, depthStyle: "mean_multicolour", contours: false,
  isobaths: false, wind: false, waves: false, orca: true, model: "best_match",
};
const NO_PLANS: Record<string, SavedPlan> = {};

type Panel = "plan" | "layers" | null;

function toLegRoute(d: unknown): LegRoute | null {
  const r = d as Partial<LegRoute> | null;
  if (!r || !Array.isArray(r.points) || r.points.length < 2) return null;
  return { mode: r.mode === "manual" ? "manual" : "auto", points: r.points, distanceNm: r.distanceNm ?? 0, departureOverride: r.departureOverride ?? null };
}

const nmOf = (pts: RoutePt[]) => Math.round(polylineDistanceNm(pts.map((p) => [p.lat, p.lon])) * 10) / 10;
const fmtUtc = (ms: number) =>
  new Date(ms).toLocaleString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function MapHub({ passages, passage, initialLeg, showBerth }: {
  passages: HubPassageSummary[];
  passage: HubPassage | null;
  initialLeg: number;
  /** Show Bossanova's home berth (only for its owner). */
  showBerth: boolean;
}) {
  const router = useRouter();
  // v2: the stored base used to be "dark" by default; IHM charts ("auto") are the new default.
  const [layers, setLayers] = useStoredState("sw_map_layers_v2", DEFAULT_LAYERS);
  const [savedPlans, setSavedPlans] = useStoredState("sw_saved_plans", NO_PLANS);
  const [panel, setPanel] = useState<Panel>("plan");
  const [legIdx, setLegIdx] = useState(initialLeg);
  const [refreshKey, setRefreshKey] = useState(0);
  const [routes, setRoutes] = useState<{ key: string; legs: (LegRoute | null)[] } | null>(null);
  const [draft, setDraft] = useState<RoutePt[] | null>(null);
  const [history, setHistory] = useState<RoutePt[][]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [view, setView] = useState<MapView | null>(null);
  const [weather, setWeather] = useState<{ key: string; grid: WeatherGrid | null; error: string | null } | null>(null);
  const [timeMs, setTimeMs] = useState<number | null>(null);
  const [windy, setWindy] = useState<{ lat: number; lon: number; zoom: number; overlay: WindyOverlay } | null>(null);
  const [fit, setFit] = useState<{ key: number; target: "all" | "berth" | number }>({ key: 0, target: "all" });
  const [layerErrors, setLayerErrors] = useState<Record<string, boolean>>({});

  // ── Leg routes ────────────────────────────────────────────────────────────
  const routesKey = passage ? `${passage.id}/${refreshKey}` : null;
  useEffect(() => {
    if (!passage || !routesKey) return;
    const c = new AbortController();
    Promise.all(passage.legs.map((leg) =>
      fetch(legRouteUrl(passage.id, leg), { signal: c.signal }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    )).then((res) => { if (!c.signal.aborted) setRoutes({ key: routesKey, legs: res.map(toLegRoute) }); });
    return () => c.abort();
  }, [passage, routesKey]);
  const legRoutes = routes?.legs ?? null;
  const routesLoading = !!passage && routes?.key !== routesKey;

  const leg = passage?.legs[legIdx] ?? null;
  const legRoute = legRoutes?.[legIdx] ?? null;
  const editing = draft !== null;
  const dirty = editing && !sameRoute(draft, legRoute?.points ?? null);
  const shownPoints = draft ?? (legRoute?.mode === "manual" ? legRoute.points : null);
  const shallow = useMemo(() => (shownPoints ? shallowStretches(shownPoints) : []), [shownPoints]);
  const draftNm = useMemo(() => (draft ? nmOf(draft) : null), [draft]);

  const fitTarget = useMemo<FitTarget>(() => {
    if (fit.target === "berth") return { key: `berth:${fit.key}`, points: [[HOME_BERTH.lat, HOME_BERTH.lon]] };
    if (!legRoutes) return null;
    const pts = fit.target === "all" ? legRoutes.flatMap((r) => r?.points ?? []) : legRoutes[fit.target]?.points ?? [];
    return pts.length ? { key: `${passage?.id}:${fit.key}`, points: pts.map((p) => [p.lat, p.lon]) } : null;
  }, [fit, legRoutes, passage]);

  const base = resolveBase(layers.base, view?.bounds ?? null);

  // ── Weather grid for the visible area ─────────────────────────────────────
  const weatherOn = layers.wind || layers.waves;
  const wKey = weatherOn && view ? weatherGridQuery(latticeFor(view.bounds), layers.model) : null;
  useEffect(() => {
    if (!wKey) return;
    const c = new AbortController();
    fetch(`/api/weather-grid?${wKey}`, { signal: c.signal })
      .then((r) => r.json())
      .then((d) => setWeather(d.error ? { key: wKey, grid: null, error: d.error } : { key: wKey, grid: d, error: null }))
      .catch((e) => { if (e.name !== "AbortError") setWeather({ key: wKey, grid: null, error: "Weather unavailable (offline?)" }); });
    return () => c.abort();
  }, [wKey]);
  const grid = weatherOn ? weather?.grid ?? null : null;
  const weatherLoading = !!wKey && weather?.key !== wKey;
  const weatherError = weatherOn && weather?.key === wKey ? weather?.error ?? null : null;
  const tIdx = grid ? timeIndexNear(grid.times, timeMs ?? Date.parse(grid.fetchedAt)) : 0;

  // ── Actions ───────────────────────────────────────────────────────────────
  const toggle = (k: keyof LayerState) => {
    setLayers((s) => ({ ...s, [k]: !s[k] }));
    setLayerErrors((e) => ({ ...e, [k]: false }));
  };

  function selectLeg(i: number, refit = true) {
    if (editing) return;
    setLegIdx(i);
    if (refit) setFit((f) => ({ key: f.key + 1, target: i }));
  }

  function changeDraft(next: RoutePt[]) {
    if (sameRoute(draft, next)) return; // e.g. a tap that didn't move the point
    if (draft) setHistory((h) => [...h.slice(-49), draft]);
    setDraft(next);
  }

  function undo() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setDraft(prev);
    setHistory(history.slice(0, -1));
  }

  function cancelEdit() {
    if (dirty && !window.confirm("Discard the changes to this route?")) return;
    setDraft(null);
    setHistory([]);
  }

  async function postRoute(body: object, done: string) {
    if (!passage || !leg) return;
    setBusy("Saving…");
    try {
      const r = await fetch("/api/leg-route", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passageId: passage.id, legIndex: leg.index, ...body }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `HTTP ${r.status}`);
      setRefreshKey((k) => k + 1);
      setNote(done);
      return true;
    } catch (e) {
      setNote(`Save failed: ${errMsg(e)}`);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function saveDraft() {
    if (!draft || !leg) return;
    const ok = await postRoute({ points: draft, notes: "Edited on the map" },
      `Saved ${leg.from.name} → ${leg.to.name}: ${draft.length} points, ${draftNm} NM`);
    if (ok) { setDraft(null); setHistory([]); }
  }

  async function resetAuto() {
    if (!passage || !leg) return;
    if (!window.confirm(`Drop the manual route and go back to the automatic one for ${leg.from.name} → ${leg.to.name}?`)) return;
    setBusy("Resetting…");
    try {
      const r = await fetch(`/api/leg-route?passageId=${passage.id}&legIndex=${leg.index}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setDraft(null);
      setHistory([]);
      setRefreshKey((k) => k + 1);
      setNote("Back on the automatic route");
    } catch (e) {
      setNote(`Reset failed: ${errMsg(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function importGpx(file: File) {
    if (!leg) return;
    const prepared = prepareLegImport(await file.text(), file.name, leg.from, leg.to);
    if (!prepared.ok) { setNote(prepared.error); return; }
    const { summary, warnings } = prepared;
    if (!window.confirm(`Replace ${leg.from.name} → ${leg.to.name} with ${summary}?${warnings.length ? `\n\n${warnings.join("\n")}` : ""}`)) return;
    await postRoute({ points: prepared.points, notes: `Imported from GPX: ${prepared.label}` },
      `Imported ${summary}${warnings.length ? ` · ${warnings.join(" · ")}` : ""}`);
  }

  async function saveDeparture(localIso: string) {
    await postRoute({ departureOverride: localIso }, `Departure set: ${localIso.replace("T", " ")} UTC`);
  }

  async function saveOffline() {
    if (!passage) return;
    setBusy("Saving for offline…");
    try {
      const res = await savePlanOffline(passage.id, passage.legs);
      setSavedPlans((all) => ({ ...all, [passage.id]: res }));
      setNote(res.failed.length
        ? `Saved ${res.ok} items offline; ${res.failed.length} failed (${res.failed.slice(0, 2).join(", ")}${res.failed.length > 2 ? "…" : ""})`
        : `Saved offline: ${res.ok} pages and data files`);
    } catch (e) {
      setNote(`Could not save offline: ${errMsg(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function dropOffline() {
    if (!passage) return;
    try {
      await dropPlanOffline(passage.id, passage.legs);
    } catch { /* the marker goes anyway */ }
    setSavedPlans((all) => {
      const next = { ...all };
      delete next[passage.id];
      return next;
    });
    setNote("Removed the offline copy");
  }

  function openWindy() {
    const v = view ?? { lat: HOME_BERTH.lat, lon: HOME_BERTH.lon, zoom: 8 };
    setWindy((w) => ({ lat: v.lat, lon: v.lon, zoom: v.zoom, overlay: w?.overlay ?? "wind" }));
  }

  const saved = passage ? savedPlans[passage.id] : undefined;

  return (
    <div className="map-wrap hub">
      <HubMap
        showBerth={showBerth}
        layers={layers}
        base={base}
        passage={passage}
        routes={legRoutes}
        legIdx={legIdx}
        onSelectLeg={(i) => selectLeg(i, false)}
        draft={draft}
        onDraft={changeDraft}
        shallow={shallow}
        grid={grid}
        timeIdx={tIdx}
        onView={setView}
        fitTarget={fitTarget}
        onLayerError={(id) => setLayerErrors((e) => (e[id] ? e : { ...e, [id]: true }))}
      />

      <div className="hub-bar">
        <button className={`hub-btn${panel === "plan" ? " on" : ""}`} onClick={() => setPanel(panel === "plan" ? null : "plan")} aria-pressed={panel === "plan"}>
          <Route size={17} /> <span>Plan</span>
        </button>
        <button className={`hub-btn${panel === "layers" ? " on" : ""}`} onClick={() => setPanel(panel === "layers" ? null : "layers")} aria-pressed={panel === "layers"}>
          <Layers size={17} /> <span>Layers</span>
        </button>
        <button className={`hub-btn${windy ? " on" : ""}`} onClick={() => (windy ? setWindy(null) : openWindy())} aria-pressed={!!windy}>
          <Wind size={17} /> <span>Windy</span>
        </button>
      </div>

      {panel === "plan" && (
        <aside className="hub-panel glass" aria-label="Plan">
          <PanelHead title="Plan" onClose={() => setPanel(null)} />
          {passages.length > 0 ? (
            <label className="hub-field">
              <span className="field-label">Passage</span>
              <select className="select" value={passage?.id ?? ""} disabled={editing}
                onChange={(e) => router.push(`/map?p=${e.target.value}`)}>
                {passages.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
          ) : (
            <p className="dim" style={{ fontSize: 13 }}>No passages yet. <Link href="/new" className="hub-link">Plan one</Link> — the map, layers and weather work without one.</p>
          )}

          {passage && (
            <>
              <div className="hub-legs">
                {passage.legs.map((l, i) => {
                  const r = legRoutes?.[i];
                  return (
                    <button key={i} className={`hub-leg${i === legIdx ? " active" : ""}`} onClick={() => selectLeg(i)} disabled={editing && i !== legIdx}>
                      <span className="mono faint" style={{ fontSize: 11 }}>{i + 1}</span>
                      <span className="hub-leg-name">{l.from.name} → {l.to.name}</span>
                      <span className="mono dim" style={{ fontSize: 11.5 }}>
                        {r ? `${r.distanceNm.toFixed(0)} NM${r.mode === "manual" ? " · manual" : ""}` : routesLoading ? "…" : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {leg && (
                <div className="hub-section">
                  <div className="between" style={{ gap: 8 }}>
                    <div style={{ fontWeight: 600 }}>{leg.from.name} → {leg.to.name}</div>
                    <Link href={`/p/${passage.id}/leg/${leg.index}`} className="hub-link" title="Open the leg page"><ExternalLink size={15} /></Link>
                  </div>
                  <div className="mono dim" style={{ fontSize: 12, marginTop: 2 }}>
                    {legRoute ? `${legRoute.distanceNm.toFixed(1)} NM · ${legRoute.mode} route · ${legRoute.points.length} pts` : routesLoading ? "loading route…" : "route unavailable"}
                    {legRoute?.departureOverride && ` · dep. ${legRoute.departureOverride.replace("T", " ")} UTC`}
                  </div>
                  {shallow.length > 0 && !editing && (
                    <div className="hub-warn"><TriangleAlert size={14} /> Crosses land or &lt; 20 m water in {shallow.length} place{shallow.length > 1 ? "s" : ""} ({shallow.reduce((n, s) => n + s.nm, 0).toFixed(1)} NM)</div>
                  )}
                  <div className="hub-actions">
                    <button className="btn btn-sm" onClick={() => { if (legRoute) { setDraft(legRoute.points); setHistory([]); } }} disabled={!legRoute || editing}>
                      <Pencil size={14} /> Edit route
                    </button>
                    <label className={`btn btn-sm${editing ? " disabled" : ""}`} title="Replace this leg's route with a GPX route or track (OpenCPN, Axiom, Navionics)">
                      <Upload size={14} /> Import GPX
                      <input type="file" accept=".gpx,application/gpx+xml" hidden disabled={editing}
                        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importGpx(f); }} />
                    </label>
                    <a className="btn btn-sm" href={exportUrl(passage.id, leg.index)} title="Plotter-safe GPX for this leg (Axiom / Navionics)">
                      <Download size={14} /> GPX
                    </a>
                    {legRoute?.mode === "manual" && !editing && (
                      <button className="btn btn-sm btn-ghost" onClick={resetAuto} title="Back to the automatic route"><RotateCcw size={14} /> Auto</button>
                    )}
                  </div>
                </div>
              )}

              {leg && (
                <div className="hub-dw">
                  <DepartureWindows passageId={passage.id} legIndex={leg.index} refreshKey={refreshKey} onPick={saveDeparture} />
                </div>
              )}

              <div className="hub-section">
                <div className="field-label">Whole passage</div>
                <div className="hub-actions">
                  <a className="btn btn-sm" href={exportUrl(passage.id)}><Download size={14} /> GPX, all legs</a>
                  <button className="btn btn-sm" onClick={saveOffline} disabled={!!busy}>
                    <CloudDownload size={14} /> {saved ? "Update offline copy" : "Save offline"}
                  </button>
                </div>
                {saved && (
                  <div className="mono faint" style={{ fontSize: 11, marginTop: 6 }}>
                    <Check size={12} style={{ verticalAlign: -2, color: "var(--go)" }} /> Offline copy {fmtUtc(saved.savedAt)} UTC · {saved.ok} items
                    {saved.failed.length > 0 && ` · ${saved.failed.length} failed`}
                    {" · "}<button className="hub-link" onClick={dropOffline}>remove</button>
                  </div>
                )}
              </div>
            </>
          )}

          {showBerth && <div className="hub-section">
            <div className="between">
              <span className="center gap-6" style={{ fontWeight: 600 }}><Anchor size={14} style={{ color: "var(--cyan)" }} /> {HOME_BERTH.name}</span>
              <button className="hub-link" onClick={() => setFit((f) => ({ key: f.key + 1, target: "berth" }))}>show</button>
            </div>
            <div className="mono faint" style={{ fontSize: 11 }}>{HOME_BERTH.vessel}&apos;s berth · {HOME_BERTH.alias} · {formatDdm(HOME_BERTH.lat, HOME_BERTH.lon)}</div>
          </div>}
        </aside>
      )}

      {panel === "layers" && (
        <aside className="hub-panel hub-panel-layers glass" aria-label="Layers">
          <PanelHead title="Layers" onClose={() => setPanel(null)} />
          <div className="field-label">Base map</div>
          <div className="hub-seg" role="radiogroup" aria-label="Base map">
            {BASE_CHOICES.map((b) => (
              <button key={b.id} role="radio" aria-checked={layers.base === b.id} className={layers.base === b.id ? "on" : ""}
                onClick={() => setLayers((s) => ({ ...s, base: b.id }))} title={b.title}>{b.label}</button>
            ))}
          </div>
          <p className="faint" style={{ fontSize: 11, lineHeight: 1.45, margin: "2px 2px 0" }}>
            {layers.base === "auto" && <>Showing {base.id === "ihm" ? "IHM charts" : "Dark"} here: IHM ENC over Spain and Portugal, Dark elsewhere.<br /></>}
            {base.id === "ihm" && IHM_ENC.note}
          </p>

          <div className="field-label" style={{ marginTop: 12 }}>Chart</div>
          <LayerRow on={layers.seamarks} onClick={() => toggle("seamarks")} label="Seamarks" sub="OpenSeaMap" title={SEAMARKS.licence} error={layerErrors.seamarks} />
          <LayerRow on={layers.depth} onClick={() => toggle("depth")} label="Depth shading" sub="EMODnet · ~115 m grid, not for navigation" title={depthShaded(layers.depthStyle).licence} error={layerErrors.depth} />
          {layers.depth && (
            <div className="hub-seg hub-seg-sm" role="radiogroup" aria-label="Depth style">
              {DEPTH_STYLES.map((d) => (
                <button key={d.id} role="radio" aria-checked={layers.depthStyle === d.id} className={layers.depthStyle === d.id ? "on" : ""}
                  onClick={() => setLayers((s) => ({ ...s, depthStyle: d.id }))}>{d.label}</button>
              ))}
            </div>
          )}
          <LayerRow on={layers.contours} onClick={() => toggle("contours")} label="Depth contours" sub={`EMODnet · ${DEPTH_CONTOURS.note}`} title={DEPTH_CONTOURS.licence} error={layerErrors.contours} />
          <LayerRow on={layers.isobaths} onClick={() => toggle("isobaths")} label="Isobaths 5–200 m" sub="from EMODnet, works offline · not for navigation" />
          <LayerRow on={layers.orca} onClick={() => toggle("orca")} label="Orca risk" sub="8 km rings at waypoints with reports" />

          <div className="field-label" style={{ marginTop: 12 }}>Weather</div>
          <LayerRow on={layers.wind} onClick={() => toggle("wind")} label="Wind" sub="barbs, kn · Open-Meteo" />
          <LayerRow on={layers.waves} onClick={() => toggle("waves")} label="Waves" sub="significant height, m · Open-Meteo Marine" />
          {weatherOn && (
            <label className="hub-field">
              <span className="field-label">Model</span>
              <select className="select" value={layers.model} onChange={(e) => setLayers((s) => ({ ...s, model: e.target.value as WeatherGridModel }))}>
                {Object.entries(WEATHER_MODELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
          )}
          <p className="mono faint" style={{ fontSize: 10.5, lineHeight: 1.55, marginTop: 10 }}>
            Tiles load as you look and are kept for offline use; areas are never downloaded in bulk. Depth layers are survey models, not charts — navigate on the Axiom.
          </p>
        </aside>
      )}

      {editing && leg && (
        <div className="hub-edit glass" role="toolbar" aria-label="Route editing">
          <div className="hub-edit-info">
            <span style={{ fontWeight: 600 }}>{leg.from.name} → {leg.to.name}</span>
            <span className="mono dim" style={{ fontSize: 12 }}>{draft.length} pts · {draftNm} NM{dirty ? " · edited" : ""}</span>
            {shallow.length > 0 && <span className="hub-warn" style={{ margin: 0 }}><TriangleAlert size={13} /> land / &lt;20 m ×{shallow.length}</span>}
          </div>
          <div className="mono faint hub-edit-help">Drag points · tap + to add · tap a point to delete</div>
          <div className="hub-actions" style={{ marginTop: 0 }}>
            <button className="btn btn-sm btn-ghost" onClick={undo} disabled={!history.length} aria-label="Undo"><Undo2 size={15} /></button>
            <button className="btn btn-sm btn-ghost" onClick={cancelEdit}>Cancel</button>
            <button className="btn btn-sm btn-primary" onClick={saveDraft} disabled={!dirty || !!busy}><Check size={15} /> Save</button>
          </div>
        </div>
      )}

      {weatherOn && (
        <div className="hub-time glass">
          {grid && grid.times.length > 0 ? (
            <>
              <div className="between" style={{ gap: 10 }}>
                <span className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{fmtUtc(grid.times[tIdx])} UTC</span>
                <span className="mono faint" style={{ fontSize: 10.5 }}>
                  {weatherLoading ? "updating…" : `${WEATHER_MODELS[grid.model]} · fetched ${fmtUtc(Date.parse(grid.fetchedAt))}`}
                </span>
              </div>
              <input type="range" className="hub-range" min={0} max={grid.times.length - 1} value={tIdx}
                onChange={(e) => setTimeMs(grid.times[+e.target.value])} aria-label="Forecast time" />
              <div className="hub-legend">
                {layers.wind && (
                  <span className="hub-legend-group">
                    <span className="faint mono">kn</span>
                    {[0, 5, 10, 15, 20, 25].map((k) => <span key={k} className="hub-swatch" style={{ background: windColor(k + 1) }}>{k}</span>)}
                  </span>
                )}
                {layers.waves && (
                  <span className="hub-legend-group">
                    <span className="faint mono">Hs m</span>
                    {WAVE_LEGEND.map((w) => <span key={w.label} className="hub-swatch" style={{ background: w.color }}>{w.label}</span>)}
                  </span>
                )}
              </div>
            </>
          ) : (
            <span className="mono faint" style={{ fontSize: 12 }}>{weatherError ?? (weatherLoading || !view ? "loading weather…" : "no weather data")}</span>
          )}
        </div>
      )}

      {windy && (
        <aside className="hub-windy glass" aria-label="Windy">
          <div className="between" style={{ gap: 8, padding: "8px 10px" }}>
            <div className="hub-seg hub-seg-sm" style={{ margin: 0 }}>
              {WINDY_OVERLAYS.map((o) => (
                <button key={o.id} className={windy.overlay === o.id ? "on" : ""} onClick={() => setWindy({ ...windy, overlay: o.id })}>{o.label}</button>
              ))}
            </div>
            <div className="center gap-6">
              <button className="hub-link" onClick={openWindy} title="Move Windy to the map's current view">sync to map</button>
              <button className="hub-icon-btn" onClick={() => setWindy(null)} aria-label="Close Windy"><X size={16} /></button>
            </div>
          </div>
          <iframe key={`${windy.lat},${windy.lon},${windy.zoom},${windy.overlay}`} title="Windy" src={windyEmbedUrl(windy, windy.overlay)} className="hub-windy-frame" />
        </aside>
      )}

      {(note || busy) && (
        <div className="hub-note glass" role="status">
          <span>{busy ?? note}</span>
          {!busy && <button className="hub-icon-btn" onClick={() => setNote(null)} aria-label="Dismiss"><X size={14} /></button>}
        </div>
      )}
    </div>
  );
}

function PanelHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="between" style={{ marginBottom: 8 }}>
      <span className="display" style={{ fontSize: 18 }}>{title}</span>
      <button className="hub-icon-btn" onClick={onClose} aria-label={`Close ${title}`}><X size={16} /></button>
    </div>
  );
}

function LayerRow({ on, onClick, label, sub, title, error }: {
  on: boolean; onClick: () => void; label: string; sub?: string; title?: string; error?: boolean;
}) {
  return (
    <button className="layer-row hub-row" onClick={onClick} aria-pressed={on} title={title}>
      <span style={{ textAlign: "left" }}>
        <span style={{ fontSize: 14, display: "block" }}>{label}</span>
        {sub && <span className="faint" style={{ fontSize: 11, display: "block", lineHeight: 1.35 }}>{sub}</span>}
        {on && error && <span style={{ fontSize: 11, display: "block", color: "var(--caution)" }}>tiles not loading — server slow or offline</span>}
      </span>
      <span className={`toggle${on ? " on" : ""}`}><span className="knob" /></span>
    </button>
  );
}
