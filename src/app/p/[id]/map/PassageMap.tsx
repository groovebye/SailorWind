"use client";

import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface Port {
  name: string; lat: number; lon: number; type: string; coastlineNm: number;
}
interface Waypoint { port: Port; isStop: boolean; isCape: boolean; sortOrder: number; }

const COLORS: Record<string, { fill: string; stroke: string }> = {
  cape:      { fill: "#facc15", stroke: "#a16207" },  // yellow
  marina:    { fill: "#4ade80", stroke: "#166534" },  // green
  port:      { fill: "#60a5fa", stroke: "#1e40af" },  // blue
  anchorage: { fill: "#c084fc", stroke: "#6b21a8" },  // purple
};

export default function PassageMap({ waypoints }: { waypoints: Waypoint[] }) {
  const positions = waypoints.map((w) => [w.port.lat, w.port.lon] as [number, number]);

  // Fit bounds
  const lats = positions.map((p) => p[0]);
  const lons = positions.map((p) => p[1]);
  const center: [number, number] = [
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lons) + Math.max(...lons)) / 2,
  ];

  // Route line: only through checked stops and capes
  const routePositions = waypoints
    .filter((w) => w.isStop || w.isCape)
    .map((w) => [w.port.lat, w.port.lon] as [number, number]);

  return (
    <MapContainer
      center={center}
      zoom={9}
      className="h-full w-full"
      style={{ background: "#0f172a" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {/* Route line */}
      <Polyline
        positions={routePositions}
        pathOptions={{ color: "#3b82f6", weight: 2, opacity: 0.6, dashArray: "8 4" }}
      />

      {/* Waypoints */}
      {waypoints.map((w) => {
        const c = COLORS[w.port.type] || COLORS.port;
        const isStop = w.isStop;
        const isCape = w.isCape;

        return (
          <CircleMarker
            key={w.sortOrder}
            center={[w.port.lat, w.port.lon]}
            radius={isCape ? 6 : isStop ? 8 : 4}
            pathOptions={{
              fillColor: c.fill,
              color: c.stroke,
              weight: 2,
              fillOpacity: isStop || isCape ? 0.9 : 0.5,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} className="map-tooltip">
              <span className="font-semibold">{w.port.name}</span>
              <br />
              <span className="text-xs">{w.port.type.toUpperCase()}</span>
              {isStop && <span className="text-xs ml-1 text-green-600">STOP</span>}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
