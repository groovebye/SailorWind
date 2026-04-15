/**
 * Static curated seamark data for key navigation areas.
 * Used as fallback when OpenSeaMap tiles are unavailable.
 *
 * Source: OpenSeaMap / Admiralty charts / pilot books
 * Covers: Gijón → La Coruña route
 */

export interface StaticSeamark {
  lat: number;
  lon: number;
  type: "lighthouse" | "buoy_cardinal" | "buoy_lateral" | "beacon" | "light" | "landmark";
  name: string;
  characteristic?: string; // e.g. "Fl(3)15s"
  color?: string;
  notes?: string;
}

export const STATIC_SEAMARKS: StaticSeamark[] = [
  // ═══ LIGHTHOUSES ═══
  { lat: 43.6553, lon: -5.8492, type: "lighthouse", name: "Cabo Peñas", characteristic: "Fl(3)15s 117m 35M", notes: "Northernmost point of Asturias" },
  { lat: 43.5645, lon: -5.6950, type: "lighthouse", name: "Cabo Torres", characteristic: "Fl(2)10s 80m 18M" },
  { lat: 43.5575, lon: -5.9320, type: "lighthouse", name: "Avilés (San Juan de Nieva)", characteristic: "Fl(3+1)20s 40m 18M" },
  { lat: 43.5540, lon: -6.5300, type: "lighthouse", name: "Luarca", characteristic: "Fl(2+1)15s 65m 14M" },
  { lat: 43.5600, lon: -7.0500, type: "lighthouse", name: "Illa Pancha (Ribadeo)", characteristic: "Fl(3+1)20s 26m 21M", notes: "Ría de Ribadeo entrance" },
  { lat: 43.7883, lon: -7.6850, type: "lighthouse", name: "Estaca de Bares", characteristic: "Fl(2)7.5s 101m 25M", notes: "Northernmost point of Spain" },
  { lat: 43.7700, lon: -7.8700, type: "lighthouse", name: "Cabo Ortegal", characteristic: "Fl(1+3)16s 124m 18M" },
  { lat: 43.4575, lon: -8.3450, type: "lighthouse", name: "Cabo Prior", characteristic: "Fl(1+2)15s 107m 22M" },
  { lat: 43.3860, lon: -8.4060, type: "lighthouse", name: "Torre de Hércules (La Coruña)", characteristic: "Fl(4)20s 106m 23M", notes: "UNESCO. Oldest working Roman lighthouse" },
  { lat: 43.5633, lon: -6.1480, type: "lighthouse", name: "Cudillero", characteristic: "Oc(2)6s 40m 12M" },

  // ═══ ENTRANCE BUOYS & MARKS ═══
  // Gijón
  { lat: 43.5490, lon: -5.6600, type: "buoy_lateral", name: "Gijón Port Entrance (G)", color: "green", notes: "Fl.G.3s" },
  { lat: 43.5480, lon: -5.6580, type: "buoy_lateral", name: "Gijón Port Entrance (R)", color: "red", notes: "Fl.R.3s" },
  // Avilés
  { lat: 43.5950, lon: -5.9330, type: "buoy_lateral", name: "Avilés Channel (G)", color: "green" },
  { lat: 43.5945, lon: -5.9310, type: "buoy_lateral", name: "Avilés Channel (R)", color: "red" },
  // Luarca
  { lat: 43.5445, lon: -6.5340, type: "buoy_lateral", name: "Luarca Entrance (G)", color: "green" },
  { lat: 43.5440, lon: -6.5320, type: "buoy_lateral", name: "Luarca Entrance (R)", color: "red" },
  // La Coruña
  { lat: 43.3720, lon: -8.3990, type: "buoy_lateral", name: "La Coruña Channel (G)", color: "green" },
  { lat: 43.3715, lon: -8.3970, type: "buoy_lateral", name: "La Coruña Channel (R)", color: "red" },

  // ═══ CARDINAL MARKS (key hazards) ═══
  { lat: 43.6000, lon: -5.8800, type: "buoy_cardinal", name: "Bajo de la Osa (N Cardinal)", color: "black-yellow", notes: "Submerged rock NW of Luanco. Q" },
  { lat: 43.5900, lon: -5.7600, type: "buoy_cardinal", name: "Candás Approach (E Cardinal)", color: "black-yellow-black" },

  // ═══ LANDMARKS ═══
  { lat: 43.5350, lon: -5.6630, type: "landmark", name: "Universidad Laboral (Gijón)", notes: "Prominent building, good visual reference" },
  { lat: 43.5420, lon: -6.5340, type: "landmark", name: "Luarca Cemetery Chapel", notes: "White chapel on cliff, visible from sea" },
  { lat: 43.4600, lon: -8.2250, type: "landmark", name: "Castillo San Felipe (Ferrol)", notes: "Castle at S side of ría entrance" },
  { lat: 43.4650, lon: -8.2200, type: "landmark", name: "Castillo La Palma (Ferrol)", notes: "Castle at N side of ría entrance" },
];

/**
 * Get seamarks within a bounding box.
 */
export function getStaticSeamarks(south: number, west: number, north: number, east: number): StaticSeamark[] {
  return STATIC_SEAMARKS.filter(s =>
    s.lat >= south && s.lat <= north && s.lon >= west && s.lon <= east
  );
}
