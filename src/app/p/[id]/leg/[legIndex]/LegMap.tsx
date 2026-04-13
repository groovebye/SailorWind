"use client";

import { MapContainer, TileLayer, WMSTileLayer, CircleMarker, Tooltip, Polyline, Rectangle, useMap, GeoJSON as GeoJSONLayer } from "react-leaflet";
import { useEffect, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { buildSeaRoute } from "@/lib/coastline";
import type { FeatureCollection } from "geojson";

interface Port {
  name: string; lat: number; lon: number; type: string;
  orcaRisk?: string | null;
}
interface Waypoint { port: Port; isStop: boolean; isCape: boolean; }

const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png";
const OPENSEAMAP = "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png";

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
  { name: "Galicia Coast", bounds: [[42.5, -9.5], [43.5, -7.5]] as [[number, number], [number, number]], risk: "medium" },
  { name: "Cape Finisterre", bounds: [[42.5, -9.5], [43.0, -8.8]] as [[number, number], [number, number]], risk: "high" },
];

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions.map(p => L.latLng(p[0], p[1]))), { padding: [40, 40] });
    } else if (positions.length === 1) {
      map.setView(positions[0], 13);
    }
  }, [map, positions]);
  return null;
}

export default function LegMap({ waypoints, fromPort, toPort, theme }: {
  waypoints: Waypoint[];
  fromPort: Port;
  toPort: Port;
  theme: string;
}) {
  const [contours, setContours] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch("/data/contours.json").then(r => r.json()).then(setContours).catch(() => {});
  }, []);

  const positions = waypoints.map(w => [w.port.lat, w.port.lon] as [number, number]);

  // Build route geometry using the same routing graph as main map
  const routeAnchors = waypoints.filter((w, i) =>
    i === 0 || i === waypoints.length - 1 || w.isCape
  );

  const routePositions: [number, number][] = [];
  for (let i = 0; i < routeAnchors.length - 1; i++) {
    const from = routeAnchors[i];
    const to = routeAnchors[i + 1];
    // Use cape rounding names if applicable
    const fromName = from.isCape && from.port.name !== fromPort.name
      ? `${from.port.name} Rounding` : from.port.name;
    const toName = to.isCape && to.port.name !== toPort.name
      ? `${to.port.name} Rounding` : to.port.name;

    const seg = buildSeaRoute(
      { name: fromName, lat: from.port.lat, lon: from.port.lon },
      { name: toName, lat: to.port.lat, lon: to.port.lon }
    );
    if (routePositions.length > 0 && seg.length > 0) {
      routePositions.push(...seg.slice(1));
    } else {
      routePositions.push(...seg);
    }
  }

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

      {/* EMODnet depth shading */}
      <WMSTileLayer
        url="https://ows.emodnet-bathymetry.eu/wms"
        params={{ layers: "emodnet:mean_multicolour", format: "image/png", transparent: true, version: "1.3.0" }}
        opacity={theme === "dark" ? 0.3 : 0.2}
      />

      {/* Local depth contours (5/10/20/50/100/200m) */}
      {contours && (
        <GeoJSONLayer
          data={contours}
          style={(feature) => {
            const depth = feature?.properties?.depth || 50;
            const style = CONTOUR_STYLES[depth] || CONTOUR_STYLES[50];
            return { color: style.color, weight: style.weight, opacity: 0.7, dashArray: style.dash };
          }}
          onEachFeature={(feature, layer) => {
            const depth = feature.properties?.depth;
            if (depth) layer.bindTooltip(`${depth}m`, { permanent: false, direction: "center" });
          }}
        />
      )}

      {/* OpenSeaMap — buoys, lights */}
      <TileLayer url={OPENSEAMAP} opacity={0.8} />

      {/* Orca danger zones */}
      {relevantOrcaZones.map((z, i) => (
        <Rectangle key={i} bounds={z.bounds}
          pathOptions={{
            color: z.risk === "high" ? "#ef4444" : "#f97316",
            fillColor: z.risk === "high" ? "#ef4444" : "#f97316",
            fillOpacity: 0.08, weight: 1, dashArray: "6 4",
          }}>
          <Tooltip sticky>&#128011; Orca zone: {z.name} ({z.risk} risk)</Tooltip>
        </Rectangle>
      ))}

      {/* Route line from routing graph */}
      {routePositions.length > 1 && (
        <Polyline positions={routePositions}
          pathOptions={{ color: "#3b82f6", weight: 3, opacity: 0.8 }} />
      )}

      {/* Waypoints */}
      {waypoints.map((w, i) => (
        <CircleMarker key={i} center={[w.port.lat, w.port.lon]}
          radius={w.isCape ? 7 : w.isStop ? 9 : 5}
          pathOptions={{
            fillColor: COLORS[w.port.type] || "#60a5fa",
            color: COLORS[w.port.type] || "#1e40af",
            weight: 2, fillOpacity: 0.9,
          }}>
          <Tooltip direction="top" offset={[0, -8]}>
            <strong>{w.port.name}</strong><br />
            <span style={{ fontSize: 10, color: "#94a3b8" }}>
              {w.port.type.toUpperCase()}{w.isStop ? " STOP" : ""}{w.isCape ? " CAPE" : ""}
            </span>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
