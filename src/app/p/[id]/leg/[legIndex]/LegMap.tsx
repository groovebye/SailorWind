"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, Polyline, Rectangle, useMap, useMapEvents, GeoJSON as GeoJSONLayer, Marker } from "react-leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { buildSeaRoute } from "@/lib/coastline";
import type { FeatureCollection } from "geojson";
// OpenSeaMap tiles used instead of custom SeamarkOverlay for reliability

interface Port {
  name: string; lat: number; lon: number; type: string;
  orcaRisk?: string | null; tier?: string | null;
}
interface Waypoint { port: Port; isStop: boolean; isCape: boolean; }
interface Hazard { name: string; lat: number; lon: number; type: string; severity: string; description: string; }
interface Milestone { name: string; lat: number; lon: number; eta_offset_hours: number; bearing: string | null; visual_ref: string; type: string; notes?: string; }

const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png";
const COLORS: Record<string, string> = {
  cape: "#facc15", marina: "#4ade80", port: "#60a5fa", anchorage: "#c084fc",
};

const CONTOUR_STYLES: Record<number, { color: string; weight: number; dash?: string }> = {
  5:   { color: "#ef4444", weight: 1.5 },
  10:  { color: "#f97316", weight: 1.2 },
  20:  { color: "#eab308", weight: 1, dash: "4 2" },
  50:  { color: "#94a3b8", weight: 0.8, dash: "4 2" },
  100: { color: "#64748b", weight: 0.6, dash: "6 3" },
  200: { color: "#475569", weight: 0.5, dash: "8 4" },
};

const ORCA_ZONES = [
  {
    name: "Galicia North Coast",
    bounds: [[43.3, -8.5], [43.85, -7.5]] as [[number, number], [number, number]],
    risk: "medium",
    source: "Orca Ibérica / GTOA",
    season: "Year-round, peak May-Oct",
    advisory: "Interactions reported along Galician coast. Keep engine in neutral if approached. Report to GT Orcas app.",
    lastReport: "2026 season — monitoring active",
  },
  {
    name: "Cape Finisterre Zone",
    bounds: [[42.5, -9.5], [43.0, -8.8]] as [[number, number], [number, number]],
    risk: "high",
    source: "GTOA advisory",
    season: "Peak Jun-Oct",
    advisory: "High interaction area. Multiple rudder/keel damage reports. Avoid if possible or transit quickly. Engine neutral, rudder centered.",
    lastReport: "Active monitoring zone",
  },
];

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current) return;
    if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions.map(p => L.latLng(p[0], p[1]))), { padding: [40, 40] });
      didFit.current = true;
    } else if (positions.length === 1) {
      map.setView(positions[0], 13);
      didFit.current = true;
    }
  }, [map, positions]);
  return null;
}

const HAZARD_COLORS: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#94a3b8",
};

export default function LegMap({ waypoints, fromPort, toPort, theme, hazards = [], milestones = [], isEditing = false, routeDraft = [], onMapClick, onRemovePoint, manualRoutePoints }: {
  waypoints: Waypoint[];
  fromPort: Port;
  toPort: Port;
  theme: string;
  hazards?: Hazard[];
  milestones?: Milestone[];
  isEditing?: boolean;
  routeDraft?: { lat: number; lon: number; label?: string }[];
  onMapClick?: (lat: number, lon: number) => void;
  onRemovePoint?: (index: number) => void;
  manualRoutePoints?: { lat: number; lon: number }[] | null;
}) {
  const [contours, setContours] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch("/data/contours.json").then(r => r.json()).then(setContours).catch(() => {});
  }, []);

  const positions = useMemo(
    () => waypoints.map((w) => [w.port.lat, w.port.lon] as [number, number]),
    [waypoints]
  );

  // Build route geometry — use manual route if provided, otherwise auto
  const routePositions = useMemo(() => {
    if (manualRoutePoints && manualRoutePoints.length >= 2) {
      return manualRoutePoints.map(p => [p.lat, p.lon] as [number, number]);
    }

    // Auto-route from routing graph
    const routeAnchors = [
      { port: fromPort, isCape: false },
      ...waypoints.filter((w) => w.isCape).map((w) => ({ port: w.port, isCape: true })),
      { port: toPort, isCape: false },
    ];

    const merged: [number, number][] = [];
    for (let i = 0; i < routeAnchors.length - 1; i++) {
      const from = routeAnchors[i];
      const to = routeAnchors[i + 1];
      const fromName = from.isCape ? `${from.port.name} Rounding` : from.port.name;
      const toName = to.isCape ? `${to.port.name} Rounding` : to.port.name;
      const seg = buildSeaRoute(
        { name: fromName, lat: from.port.lat, lon: from.port.lon },
        { name: toName, lat: to.port.lat, lon: to.port.lon }
      );

      if (merged.length > 0 && seg.length > 0) merged.push(...seg.slice(1));
      else merged.push(...seg);
    }
    return merged;
  }, [fromPort, toPort, waypoints, manualRoutePoints]);

  const tileUrl = theme === "light" ? LIGHT_TILES : DARK_TILES;
  const legBounds = positions.length > 1
    ? L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])))
    : null;

  const relevantOrcaZones = ORCA_ZONES.filter(z => {
    if (!legBounds) return false;
    return legBounds.intersects(L.latLngBounds(z.bounds[0], z.bounds[1]));
  });

  return (
    <MapContainer center={[fromPort.lat, fromPort.lon]} zoom={11} className="h-full w-full"
      style={{ background: theme === "dark" ? "#0f172a" : "#f8fafc" }}>
      <FitBounds positions={routePositions.length > 0 ? routePositions : positions} />

      <TileLayer url={tileUrl} attribution='&copy; OSM &copy; CARTO' />

      {/* Depth contours (5/10/20/50/100/200m) from static GeoJSON — stable, no flicker */}
      {contours && (
        <GeoJSONLayer
          key="depth-contours"
          data={contours}
          interactive={!isEditing}
          style={(feature) => {
            const depth = feature?.properties?.depth || 50;
            const style = CONTOUR_STYLES[depth] || CONTOUR_STYLES[50];
            return { color: style.color, weight: style.weight, opacity: isEditing ? 0.4 : 0.7, dashArray: style.dash, interactive: !isEditing };
          }}
          onEachFeature={isEditing ? undefined : (feature, layer) => {
            const depth = feature.properties?.depth;
            if (depth) {
              const isPrimary = depth <= 10;
              layer.bindTooltip(`${depth}m`, {
                permanent: isPrimary,
                direction: "center",
                className: isPrimary ? "depth-label-permanent" : "",
                opacity: isPrimary ? 0.9 : 0.7,
              });
            }
          }}
        />
      )}

      {/* OpenSeaMap seamark tiles — may be unavailable (external service) */}
      <TileLayer
        url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
        opacity={0.85}
        eventHandlers={{ tileerror: () => { if (!document.getElementById("seamark-warn")) { const d = document.createElement("div"); d.id = "seamark-warn"; d.style.cssText = "position:absolute;top:8px;right:8px;z-index:1000;background:rgba(0,0,0,0.8);color:#f97316;padding:4px 8px;border-radius:4px;font-size:10px;pointer-events:none;"; d.textContent = "⚠ Seamarks tiles unavailable"; document.querySelector(".leaflet-container")?.appendChild(d); } } }}
      />

      {/* Orca danger zones */}
      {relevantOrcaZones.map((z, i) => (
        <Rectangle key={i} bounds={z.bounds}
          pathOptions={{
            color: z.risk === "high" ? "#ef4444" : "#f97316",
            fillColor: z.risk === "high" ? "#ef4444" : "#f97316",
            fillOpacity: 0.06, weight: 1.5, dashArray: "8 4",
          }}>
          <Popup maxWidth={280}>
            <div style={{ fontFamily: "monospace", fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: z.risk === "high" ? "#ef4444" : "#f97316" }}>🐋 {z.name}</div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>Risk: {z.risk.toUpperCase()} · {z.season}</div>
              <div style={{ fontSize: 11, margin: "6px 0" }}>{z.advisory}</div>
              <div style={{ fontSize: 10, color: "#64748b" }}>Source: {z.source}</div>
              <div style={{ fontSize: 10, color: "#64748b" }}>{z.lastReport}</div>
            </div>
          </Popup>
          <Tooltip sticky>🐋 {z.name} ({z.risk.toUpperCase()} risk)</Tooltip>
        </Rectangle>
      ))}

      {/* Route line from routing graph (hidden in edit mode) */}
      {!isEditing && routePositions.length > 1 && (
        <Polyline positions={routePositions}
          pathOptions={{ color: "#3b82f6", weight: 3, opacity: 0.8 }} />
      )}

      {/* Waypoints (dimmed in edit mode) */}
      {waypoints.map((w, i) => (
        <CircleMarker key={i} center={[w.port.lat, w.port.lon]}
          radius={w.isCape ? 6 : w.port.tier === "major" ? 11 : w.port.tier === "medium" ? 8 : 5}
          pathOptions={{
            fillColor: COLORS[w.port.type] || "#60a5fa",
            color: COLORS[w.port.type] || "#1e40af",
            opacity: isEditing ? 0.3 : 1,
            fillOpacity: isEditing ? 0.2 : 0.9,
            weight: 2,
          }}>
          <Tooltip direction="top" offset={[0, -8]}>
            <strong>{w.port.name}</strong><br />
            <span style={{ fontSize: 10, color: "#94a3b8" }}>
              {w.port.type.toUpperCase()}{w.isStop ? " STOP" : ""}{w.isCape ? " CAPE" : ""}
            </span>
          </Tooltip>
        </CircleMarker>
      ))}

      {/* Hazard markers */}
      {hazards.map((h, i) => (
        <CircleMarker key={`hz-${i}`} center={[h.lat, h.lon]} radius={8}
          pathOptions={{
            fillColor: HAZARD_COLORS[h.severity] || "#eab308",
            color: HAZARD_COLORS[h.severity] || "#eab308",
            weight: 2, fillOpacity: 0.3, dashArray: "4 3",
          }}>
          <Popup maxWidth={250}>
            <div style={{ fontFamily: "monospace", fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: HAZARD_COLORS[h.severity] }}>{h.name}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>{h.type.toUpperCase()} · {h.severity}</div>
              <div style={{ fontSize: 11 }}>{h.description}</div>
            </div>
          </Popup>
          <Tooltip direction="top" offset={[0, -10]}>
            <span style={{ color: HAZARD_COLORS[h.severity], fontWeight: 700 }}>⚠ {h.name}</span>
          </Tooltip>
        </CircleMarker>
      ))}

      {/* Milestone markers */}
      {milestones.filter(m => m.lat && m.lon).map((m, i) => (
        <CircleMarker key={`ms-${i}`} center={[m.lat, m.lon]} radius={4}
          pathOptions={{ fillColor: "#93c5fd", color: "#3b82f6", weight: 1.5, fillOpacity: 0.7 }}>
          <Tooltip direction="top" offset={[0, -6]}>
            <span style={{ fontWeight: 600 }}>{m.name}</span><br />
            <span style={{ fontSize: 10, color: "#94a3b8" }}>
              +{m.eta_offset_hours}h {m.bearing && `· BRG ${m.bearing}`}
            </span><br />
            <span style={{ fontSize: 10 }}>{m.visual_ref}</span>
          </Tooltip>
        </CircleMarker>
      ))}

      {/* Edit mode: click handler + draft route */}
      {isEditing && onMapClick && <MapClickHandler onClick={onMapClick} />}
      {isEditing && routeDraft.length > 0 && (
        <>
          <Polyline positions={routeDraft.map(p => [p.lat, p.lon] as [number, number])} pathOptions={{ color: "#f97316", weight: 3, dashArray: "8 4" }} />
          {routeDraft.map((p, i) => (
            <CircleMarker key={`draft-${i}`} center={[p.lat, p.lon]} radius={7}
              pathOptions={{ fillColor: i === 0 ? "#4ade80" : "#f97316", color: "#fff", weight: 2, fillOpacity: 0.9 }}
              eventHandlers={onRemovePoint ? { click: (e) => { e.originalEvent.stopPropagation(); onRemovePoint(i); } } : {}}>
              <Tooltip permanent direction="top" offset={[0, -10]}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>{i + 1}{p.label ? ` ${p.label}` : ""}</span>
              </Tooltip>
            </CircleMarker>
          ))}
        </>
      )}
    </MapContainer>
  );
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click: (e) => { onClick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}
