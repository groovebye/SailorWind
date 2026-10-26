"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { FeatureCollection } from "geojson";
import { useEffect, useRef, useState } from "react";
import {
  Circle, CircleMarker, GeoJSON, LayerGroup, MapContainer, Marker, Pane, Polyline, Popup, TileLayer, Tooltip,
  WMSTileLayer, ZoomControl, useMap, useMapEvents,
} from "react-leaflet";
import {
  BASE_LAYERS, DEPTH_CONTOURS, EMODNET_ATTR, HOME_BERTH, SEAMARKS, depthShaded, formatDdm, type TileSource,
} from "@/lib/map-layers";
import { insertMidpoint, midpoints, moveVertex, removeVertex, type RoutePt } from "@/lib/route-edit";
import type { ShallowStretch } from "@/lib/searoute";
import type { WeatherGrid } from "@/lib/weather-grid";
import type { FitTarget, HubPassage, LayerState, LegRoute, MapView } from "./MapHub";
import WeatherLayer from "./WeatherLayer";

const BERTH_ICON = L.divIcon({
  className: "", iconSize: [30, 30], iconAnchor: [15, 15],
  html: `<div class="hub-berth" title="${HOME_BERTH.vessel}">⚓</div>`,
});
// Big hit areas: these are dragged with a finger on the iPad.
const VERTEX_ICON = L.divIcon({ className: "", iconSize: [36, 36], iconAnchor: [18, 18], html: `<div class="hub-vertex"><i></i></div>` });
const END_ICON = L.divIcon({ className: "", iconSize: [36, 36], iconAnchor: [18, 18], html: `<div class="hub-vertex end"><i></i></div>` });
const MID_ICON = L.divIcon({ className: "", iconSize: [30, 30], iconAnchor: [15, 15], html: `<div class="hub-mid">+</div>` });

// Isobath colours shared with the leg map: 5 m red (danger) → 20 m yellow → blues.
const ISOBATH: Record<number, string> = { 5: "#e11d2e", 10: "#ff8a00", 20: "#ffd400", 50: "#2ec6e6", 100: "#2f7fe6", 200: "#1f3f9e" };

const viewOf = (m: L.Map): MapView => {
  const b = m.getBounds(), c = m.getCenter();
  return { bounds: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }, lat: c.lat, lon: c.lng, zoom: m.getZoom() };
};

export default function HubMap(props: {
  layers: LayerState;
  passage: HubPassage | null;
  routes: (LegRoute | null)[] | null;
  legIdx: number;
  onSelectLeg: (i: number) => void;
  draft: RoutePt[] | null;
  onDraft: (pts: RoutePt[]) => void;
  shallow: ShallowStretch[];
  grid: WeatherGrid | null;
  timeIdx: number;
  onView: (v: MapView) => void;
  fitTarget: FitTarget;
  onLayerError: (id: string) => void;
}) {
  const { layers, passage, routes, legIdx, draft, grid } = props;
  const base = BASE_LAYERS.find((b) => b.id === layers.base) ?? BASE_LAYERS[0];

  return (
    <MapContainer center={[HOME_BERTH.lat, HOME_BERTH.lon]} zoom={11} zoomControl={false} className="hub-map">
      <ZoomControl position="bottomright" />
      <ViewReporter onView={props.onView} />
      <FitTo target={props.fitTarget} />

      <Tiles key={base.id} src={base} zIndex={1} />
      {layers.depth && <Tiles key={layers.depthStyle} src={depthShaded(layers.depthStyle)} zIndex={2} opacity={0.6} onError={() => props.onLayerError("depth")} />}
      {layers.contours && <Tiles src={DEPTH_CONTOURS} zIndex={3} onError={() => props.onLayerError("contours")} />}
      {layers.seamarks && <Tiles src={SEAMARKS} zIndex={4} onError={() => props.onLayerError("seamarks")} />}
      {layers.isobaths && <Isobaths />}

      {layers.orca && passage?.waypoints.filter((w) => w.orcaRisk && w.orcaRisk !== "none").map((w, i) => {
        const c = w.orcaRisk === "high" ? "#ff6b8a" : w.orcaRisk === "medium" ? "#b794ff" : "#4fb0ff";
        return (
          <Circle key={`orca${i}`} center={[w.lat, w.lon]} radius={8000} interactive={false}
            pathOptions={{ color: c, weight: 1.5, fillColor: c, fillOpacity: 0.12, dashArray: "4 6" }} />
        );
      })}

      {routes?.map((r, i) => {
        if (!r || (i === legIdx && draft)) return null;
        const sel = i === legIdx;
        const pos = r.points.map((p) => [p.lat, p.lon] as [number, number]);
        const leg = passage?.legs[i];
        return (
          <LayerGroup key={`leg${i}`}>
            {sel && <Polyline positions={pos} interactive={false} pathOptions={{ color: "#34e0ff", weight: 9, opacity: 0.18 }} />}
            <Polyline positions={pos} interactive={false}
              pathOptions={{ color: sel ? "#34e0ff" : "#8ab4d6", weight: sel ? 3 : 2, opacity: sel ? 0.95 : 0.65, dashArray: sel ? undefined : "6 8" }} />
            {/* wide invisible line: easy to tap */}
            <Polyline positions={pos} pathOptions={{ color: "#000", weight: 22, opacity: 0 }} eventHandlers={{ click: () => props.onSelectLeg(i) }}>
              {leg && <Tooltip sticky className="lf-tip">{leg.from.name} → {leg.to.name} · {r.distanceNm.toFixed(0)} NM</Tooltip>}
            </Polyline>
          </LayerGroup>
        );
      })}

      {passage?.waypoints.map((w, i) => (
        <CircleMarker key={`wp${i}`} center={[w.lat, w.lon]} radius={w.isStop ? 6 : 4.5}
          pathOptions={{ color: "#ffffff", weight: 1.5, fillColor: w.isStop ? "#34e0ff" : w.isCape ? "#ffc24b" : "#9fb6cc", fillOpacity: 1 }}>
          <Tooltip direction="top" offset={[0, -6]} className="lf-tip">{w.name}{w.isCape ? " (cape)" : ""}</Tooltip>
        </CircleMarker>
      ))}
      {passage?.waypoints.filter((w) => w.approach).map((w, i) => (
        <CircleMarker key={`ap${i}`} center={[w.approach!.lat, w.approach!.lon]} radius={4}
          pathOptions={{ color: "#8ce8ff", weight: 1.5, fillColor: "#8ce8ff", fillOpacity: 0.25 }}>
          <Tooltip direction="top" className="lf-tip">Approach WPT — {w.name}{w.approach!.note ? ` · ${w.approach!.note}` : ""}</Tooltip>
        </CircleMarker>
      ))}

      {grid && (layers.wind || layers.waves) && <WeatherLayer grid={grid} timeIdx={props.timeIdx} wind={layers.wind} waves={layers.waves} />}

      {props.shallow.map((s, i) => (
        <Polyline key={`sh${i}`} positions={[[s.start.lat, s.start.lon], [s.end.lat, s.end.lon]]} interactive={false}
          pathOptions={{ color: "#ff4d4d", weight: 7, opacity: 0.75, lineCap: "butt" }} />
      ))}

      {draft && <EditHandles pts={draft} onChange={props.onDraft} />}

      <Marker position={[HOME_BERTH.lat, HOME_BERTH.lon]} icon={BERTH_ICON} zIndexOffset={500}>
        <Popup>
          <div style={{ fontWeight: 700 }}>{HOME_BERTH.vessel} — home berth</div>
          <div>{HOME_BERTH.name} ({HOME_BERTH.alias})</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, marginTop: 4 }}>{formatDdm(HOME_BERTH.lat, HOME_BERTH.lon)}</div>
          <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 2 }}>{HOME_BERTH.source}</div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}

function Tiles({ src, zIndex, opacity, onError }: { src: TileSource; zIndex: number; opacity?: number; onError?: () => void }) {
  const events = onError ? { tileerror: onError } : undefined;
  if (src.kind === "wms" && src.wms) {
    return (
      <WMSTileLayer url={src.url} params={{ ...src.wms }} attribution={src.attribution} zIndex={zIndex} opacity={opacity}
        crossOrigin="anonymous" eventHandlers={events} />
    );
  }
  return (
    <TileLayer url={src.url} attribution={src.attribution} subdomains={src.subdomains ?? "abc"} maxNativeZoom={src.maxNativeZoom}
      maxZoom={19} zIndex={zIndex} opacity={opacity} className={src.className} crossOrigin="anonymous" eventHandlers={events} />
  );
}

function ViewReporter({ onView }: { onView: (v: MapView) => void }) {
  const map = useMapEvents({ moveend: () => onView(viewOf(map)) });
  useEffect(() => { onView(viewOf(map)); }, [map, onView]);
  return null;
}

function FitTo({ target }: { target: FitTarget }) {
  const map = useMap();
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (!target || done.current === target.key) return;
    done.current = target.key;
    if (target.points.length === 1) { map.setView(target.points[0], 14); return; }
    // Above 720 px the Plan panel sits on the left; below, it's a bottom sheet.
    const side = map.getSize().x > 720;
    map.fitBounds(L.latLngBounds(target.points), {
      paddingTopLeft: [side ? 400 : 24, 70], paddingBottomRight: [24, side ? 90 : 300], maxZoom: 13,
    });
  }, [map, target]);
  return null;
}

function Isobaths() {
  const [fc, setFc] = useState<FeatureCollection | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/depth-contours.geojson").then((r) => r.json()).then((d) => { if (live) setFc(d); }).catch(() => {});
    return () => { live = false; };
  }, []);
  if (!fc) return null;
  return (
    <Pane name="isobaths" style={{ zIndex: 350 }}>
      <GeoJSON data={fc} interactive={false} attribution={EMODNET_ATTR}
        style={(f) => {
          const d = f?.properties?.d as number;
          return { color: ISOBATH[d] ?? "#2f7fe6", weight: d <= 5 ? 1.8 : d <= 20 ? 1.4 : 1.1, opacity: 0.9 };
        }} />
    </Pane>
  );
}

/** Draggable points of the route being edited; the ports (ends) stay fixed. */
function EditHandles({ pts, onChange }: { pts: RoutePt[]; onChange: (pts: RoutePt[]) => void }) {
  const [drag, setDrag] = useState<{ i: number; lat: number; lon: number } | null>(null);
  // Leaflet can deliver a last `drag` (from a pending animation frame) after
  // `dragend`; only honour drags between dragstart and dragend.
  const dragging = useRef<number | null>(null);
  const live = drag ? pts.map((p, k) => (k === drag.i ? { ...p, lat: drag.lat, lon: drag.lon } : p)) : pts;
  const last = pts.length - 1;
  return (
    <>
      <Polyline positions={live.map((p) => [p.lat, p.lon] as [number, number])} interactive={false}
        pathOptions={{ color: "#ffc24b", weight: 3, opacity: 0.95, dashArray: "8 6" }} />
      {!drag && midpoints(pts).map((m) => (
        <Marker key={`mid${m.after}-${pts.length}`} position={[m.lat, m.lon]} icon={MID_ICON} keyboard={false}
          eventHandlers={{ click: () => onChange(insertMidpoint(pts, m.after)) }} />
      ))}
      {pts.map((p, i) => {
        const end = i === 0 || i === last;
        return (
          <Marker key={`v${i}-${pts.length}`} position={[p.lat, p.lon]} icon={end ? END_ICON : VERTEX_ICON} draggable={!end} keyboard={false}
            zIndexOffset={end ? 0 : 200}
            eventHandlers={end ? undefined : {
              dragstart: () => { dragging.current = i; },
              drag: (e) => {
                if (dragging.current !== i) return;
                const ll = (e.target as L.Marker).getLatLng();
                setDrag({ i, lat: ll.lat, lon: ll.lng });
              },
              dragend: (e) => {
                dragging.current = null;
                const ll = (e.target as L.Marker).getLatLng();
                setDrag(null);
                onChange(moveVertex(pts, i, ll.lat, ll.lng));
              },
            }}>
            {end ? (
              <Tooltip direction="top" offset={[0, -12]} className="lf-tip">{p.label ?? (i === 0 ? "Start" : "End")} (fixed)</Tooltip>
            ) : (
              <Popup closeButton={false}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{p.label ?? `Point ${i}`} · {formatDdm(p.lat, p.lon)}</span>
                  <button className="btn btn-sm btn-danger" onClick={() => onChange(removeVertex(pts, i))}>Delete point</button>
                </div>
              </Popup>
            )}
          </Marker>
        );
      })}
    </>
  );
}
