import { NextRequest, NextResponse } from "next/server";

/**
 * AEMET Marine Zone Forecasts
 *
 * AEMET (Agencia Estatal de Meteorología) provides official Spanish
 * marine forecasts by coastal zone.
 *
 * Zones covering our route:
 * - Costa Asturiana (Asturias coast: Gijón → Navia)
 * - Costa de Lugo (Galicia N coast: Ribadeo → Viveiro)
 * - Costa de A Coruña (Galicia NW: Cedeira → La Coruña)
 *
 * AEMET API: https://opendata.aemet.es/
 * Requires free API key from: https://opendata.aemet.es/centrodedescargas/altaUsuario
 */

// Marine zone mapping for our route
const MARINE_ZONES: Record<string, {
  name: string;
  aemetCode: string;
  description: string;
  coverage: string;
}> = {
  asturias: {
    name: "Costa Asturiana",
    aemetCode: "costa-asturiana",
    description: "From Tina Mayor to Ría del Eo. Covers Gijón, Cabo Peñas, Avilés, Luarca, Navia.",
    coverage: "Gijón → Navia",
  },
  lugo: {
    name: "Costa de Lugo",
    aemetCode: "costa-lugo",
    description: "From Ría del Eo to Estaca de Bares. Covers Ribadeo, Foz, Viveiro.",
    coverage: "Ribadeo → Viveiro",
  },
  coruna: {
    name: "Costa de A Coruña",
    aemetCode: "costa-coruna",
    description: "From Estaca de Bares to Finisterre. Covers Cedeira, Ferrol, La Coruña.",
    coverage: "Cedeira → La Coruña",
  },
};

// Map port slugs to AEMET zones
const PORT_TO_ZONE: Record<string, string> = {
  gijon: "asturias", candas: "asturias", luanco: "asturias",
  aviles: "asturias", cudillero: "asturias", luarca: "asturias", navia: "asturias",
  ribadeo: "lugo", foz: "lugo", burela: "lugo", viveiro: "lugo",
  "estaca-de-bares": "coruna", "cabo-ortegal": "coruna",
  carino: "coruna", cedeira: "coruna", ferrol: "coruna",
  sada: "coruna", "la-coruna": "coruna",
};

export async function GET(req: NextRequest) {
  const port = req.nextUrl.searchParams.get("port");

  if (port) {
    const zoneKey = PORT_TO_ZONE[port];
    const zone = zoneKey ? MARINE_ZONES[zoneKey] : null;

    return NextResponse.json({
      port,
      zone: zone || null,
      forecast: null, // Will contain AEMET text forecast when API key is configured
      note: zone
        ? `Zone: ${zone.name} — ${zone.description}. For official forecast, check AEMET: https://www.aemet.es/es/eltiempo/prediccion/maritima`
        : "Port not mapped to AEMET marine zone",
      aemetUrl: "https://www.aemet.es/es/eltiempo/prediccion/maritima",
    });
  }

  return NextResponse.json({
    zones: MARINE_ZONES,
    portMapping: PORT_TO_ZONE,
    note: "AEMET marine zone mapping. Live forecast integration requires API key from opendata.aemet.es",
  });
}
