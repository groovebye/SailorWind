import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient();

const ports = [
  { name: "Gijón", slug: "gijon", lat: 43.5453, lon: -5.6621, type: "marina" as const, country: "ES", region: "Asturias", coastSegment: "biscay-north", coastlineNm: 0, fuel: true, water: true, electric: true, repairs: true, shelter: "good", maxDraft: 4.0, vhfCh: "09", website: "https://www.puertogijon.es", notes: "Large marina, all facilities. Good departure point. Tel: +34 985 344 543" },
  { name: "Candás", slug: "candas", lat: 43.5883, lon: -5.7617, type: "port" as const, country: "ES", region: "Asturias", coastSegment: "biscay-north", coastlineNm: 8, water: true, shelter: "moderate", maxDraft: 2.5, vhfCh: "09", notes: "Small fishing port, limited visitor berths. Tel: +34 985 870 021" },
  { name: "Cabo Peñas", slug: "cabo-penas", lat: 43.6553, lon: -5.8492, type: "cape" as const, country: "ES", region: "Asturias", coastSegment: "biscay-north", coastlineNm: 15, notes: "Northernmost point of Asturias. Wind acceleration zone. Lighthouse: Fl(3)15s." },
  { name: "Luanco", slug: "luanco", lat: 43.6117, lon: -5.7917, type: "port" as const, country: "ES", region: "Asturias", coastSegment: "biscay-north", coastlineNm: 18, water: true, shelter: "moderate", maxDraft: 2.0, vhfCh: "09", notes: "Small port west of Cabo Peñas. Tel: +34 985 880 006" },
  { name: "Avilés", slug: "aviles", lat: 43.5917, lon: -5.9250, type: "marina" as const, country: "ES", region: "Asturias", coastSegment: "biscay-north", coastlineNm: 25, fuel: true, water: true, electric: true, shelter: "good", maxDraft: 4.5, vhfCh: "12", website: "https://www.puertoaviles.es", notes: "River entrance, good shelter inside. Tel: +34 985 540 112" },
  { name: "Cudillero", slug: "cudillero", lat: 43.5633, lon: -6.1500, type: "port" as const, country: "ES", region: "Asturias", coastSegment: "biscay-north", coastlineNm: 35, water: true, shelter: "moderate", maxDraft: 2.0, vhfCh: "09", notes: "Picturesque fishing village. Exposed in N/NW winds. Tel: +34 985 590 006" },
  { name: "Luarca", slug: "luarca", lat: 43.5417, lon: -6.5333, type: "marina" as const, country: "ES", region: "Asturias", coastSegment: "biscay-north", coastlineNm: 45, fuel: true, water: true, electric: true, shelter: "good", maxDraft: 3.5, vhfCh: "09", website: "https://www.puertodeluarca.es", notes: "Well-sheltered marina. Good overnight stop. Tel: +34 985 640 842" },
  { name: "Navia", slug: "navia", lat: 43.5500, lon: -6.7283, type: "port" as const, country: "ES", region: "Asturias", coastSegment: "biscay-north", coastlineNm: 60, water: true, shelter: "moderate", maxDraft: 2.5, vhfCh: "09", notes: "River port, limited depth at low tide. Tel: +34 985 630 040" },
  { name: "Ribadeo", slug: "ribadeo", lat: 43.5350, lon: -7.0417, type: "marina" as const, country: "ES", region: "Galicia", coastSegment: "biscay-north", coastlineNm: 80, fuel: true, water: true, electric: true, shelter: "good", maxDraft: 3.0, vhfCh: "09", notes: "Ría entrance. Asturias/Galicia border. Good facilities. Tel: +34 982 131 464" },
  { name: "Foz", slug: "foz", lat: 43.5717, lon: -7.2550, type: "port" as const, country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 92, water: true, shelter: "moderate", maxDraft: 2.0, vhfCh: "09", notes: "Small port in Ría de Foz. Tel: +34 982 132 190" },
  { name: "Viveiro", slug: "viveiro", lat: 43.6617, lon: -7.5950, type: "marina" as const, country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 110, fuel: true, water: true, electric: true, shelter: "good", maxDraft: 3.5, vhfCh: "09", website: "https://www.celeiroviveiro.es", notes: "Well-sheltered ría. Good marina facilities. Tel: +34 982 560 600" },
  { name: "Estaca de Bares", slug: "estaca-de-bares", lat: 43.7883, lon: -7.6850, type: "cape" as const, country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 120, notes: "Northernmost point of Spain! Major wind acceleration. Dangerous in strong W/NW. Lighthouse: Fl(2)7.5s." },
  { name: "Cabo Ortegal", slug: "cabo-ortegal", lat: 43.7700, lon: -7.8700, type: "cape" as const, country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 130, notes: "Dramatic cape. Strong currents and wind acceleration. Lighthouse: Fl(1+3)16s." },
  { name: "Cariño", slug: "carino", lat: 43.7367, lon: -7.8667, type: "port" as const, country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 133, water: true, shelter: "good", maxDraft: 3.0, vhfCh: "09", notes: "Sheltered port just south of Cabo Ortegal. Good refuge. Tel: +34 981 420 002" },
  { name: "Cedeira", slug: "cedeira", lat: 43.6600, lon: -8.0567, type: "marina" as const, country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 140, fuel: true, water: true, electric: true, shelter: "good", maxDraft: 3.0, vhfCh: "09", notes: "Well-sheltered ría. Safe stop after rounding capes. Tel: +34 981 480 200" },
  { name: "Ferrol", slug: "ferrol", lat: 43.4833, lon: -8.2333, type: "marina" as const, country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 150, fuel: true, water: true, electric: true, repairs: true, shelter: "good", maxDraft: 5.0, vhfCh: "12", website: "https://www.apfsc.es", notes: "Major naval port. Excellent shelter and facilities. Tel: +34 981 336 008" },
  { name: "La Coruña", slug: "la-coruna", lat: 43.3700, lon: -8.4000, type: "marina" as const, country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 160, fuel: true, water: true, electric: true, repairs: true, customs: true, shelter: "good", maxDraft: 6.0, vhfCh: "12", website: "https://www.marinacoruna.com", notes: "Major city marina. All services. Good provisioning. Tel: +34 981 205 658" },
];

async function main() {
  console.log("Seeding ports...");
  for (const p of ports) {
    await prisma.port.upsert({
      where: { slug: p.slug },
      update: p,
      create: p,
    });
  }
  console.log(`Seeded ${ports.length} ports.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
