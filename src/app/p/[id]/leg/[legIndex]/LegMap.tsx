"use client";

import { MapContainer, TileLayer, WMSTileLayer, CircleMarker, Tooltip, Polyline, Rectangle, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

// Known orca interaction zones (lat/lon bounds)
const ORCA_ZONES = [
  { name: "Galicia Coast", bounds: [[42.5, -9.5], [43.5, -7.5]] as [[number, number], [number, number]], risk: "medium" },
  { name: "Cape Finisterre", bounds: [[42.5, -9.5], [43.0, -8.8]] as [[number, number], [number, number]], risk: "high" },
];

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions.map(p => L.latLng(p[0], p[1]))), { padding: [30, 30] });
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
  const positions = waypoints.map(w => [w.port.lat, w.port.lon] as [number, number]);
  const routeLine = [
    [fromPort.lat, fromPort.lon] as [number, number],
    ...waypoints.filter(w => w.isCape).map(w => [w.port.lat, w.port.lon] as [number, number]),
    [toPort.lat, toPort.lon] as [number, number],
  ];

  const tileUrl = theme === "light" ? LIGHT_TILES : DARK_TILES;

  // Check if any orca zones overlap with this leg
  const legBounds = L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])));
  const relevantOrcaZones = ORCA_ZONES.filter(z => {
    const zBounds = L.latLngBounds(z.bounds[0], z.bounds[1]);
    return legBounds.intersects(zBounds);
  });

  return (
    <MapContainer center={[fromPort.lat, fromPort.lon]} zoom={11} className="h-full w-full" style={{ background: theme === "dark" ? "#0f172a" : "#f8fafc" }}>
      <FitBounds positions={positions} />

      <TileLayer url={tileUrl} attribution='&copy; OSM &copy; CARTO' />

      {/* EMODnet depth shading */}
      <WMSTileLayer
        url="https://ows.emodnet-bathymetry.eu/wms"
        params={{ layers: "emodnet:mean_multicolour", format: "image/png", transparent: true, version: "1.3.0" }}
        opacity={theme === "dark" ? 0.3 : 0.2}
      />

      {/* EMODnet contour lines */}
      <WMSTileLayer
        url="https://ows.emodnet-bathymetry.eu/wms"
        params={{ layers: "emodnet:contours", format: "image/png", transparent: true, version: "1.3.0" }}
        opacity={0.6}
      />

      {/* OpenSeaMap — buoys, lights */}
      <TileLayer url={OPENSEAMAP} opacity={0.8} />

      {/* Orca danger zones */}
      {relevantOrcaZones.map((z, i) => (
        <Rectangle
          key={i}
          bounds={z.bounds}
          pathOptions={{
            color: z.risk === "high" ? "#ef4444" : "#f97316",
            fillColor: z.risk === "high" ? "#ef4444" : "#f97316",
            fillOpacity: 0.08,
            weight: 1,
            dashArray: "6 4",
          }}
        >
          <Tooltip sticky>&#128011; Orca zone: {z.name} ({z.risk} risk)</Tooltip>
        </Rectangle>
      ))}

      {/* Route line */}
      <Polyline positions={routeLine} pathOptions={{ color: "#3b82f6", weight: 3, opacity: 0.7 }} />

      {/* Waypoints */}
      {waypoints.map((w, i) => (
        <CircleMarker
          key={i}
          center={[w.port.lat, w.port.lon]}
          radius={w.isCape ? 7 : w.isStop ? 9 : 5}
          pathOptions={{
            fillColor: COLORS[w.port.type] || "#60a5fa",
            color: COLORS[w.port.type] || "#1e40af",
            weight: 2,
            fillOpacity: 0.9,
          }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            <strong>{w.port.name}</strong><br />
            <span style={{ fontSize: 10, color: "#94a3b8" }}>
              {w.port.type.toUpperCase()}
              {w.isStop ? " STOP" : ""}
              {w.isCape ? " CAPE" : ""}
            </span>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
