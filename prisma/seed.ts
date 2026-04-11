import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient();

const ports = [
  {
    name: "Gijón", slug: "gijon", lat: 43.5453, lon: -5.6621, type: "marina" as const,
    country: "ES", region: "Asturias", coastSegment: "biscay-north", coastlineNm: 0,
    fuel: true, water: true, electric: true, repairs: true, shelter: "good",
    maxDraft: 4.0, vhfCh: "09", phone: "+34 985 344 543", email: "info@puertodeportivogijon.es",
    website: "https://puertodeportivogijon.com",
    marinaName: "Puerto Deportivo de Gijón",
    marinaHours: "Office 09:00-21:00, fuel 08:00-20:00",
    berthCount: 728, visitorBerths: 50, maxLength: 24,
    approachNotes: "Enter from NE, follow green/red channel buoys. Min depth 4m at entrance. Visitor berths on pontoon F.",
    approachDescription: "Approach from N or NE. The harbor is well-protected by two breakwaters. Main entrance faces NE between the outer breakwater heads, marked by Fl.G and Fl.R lights. Follow the buoyed channel SW into the marina basin. Fuel dock on starboard immediately after entrance.",
    notes: "Large marina, all facilities. Major city with excellent provisioning. Good departure point for westbound passage.",
    orcaRisk: "low", orcaNotes: "Rare in Bay of Biscay east of Cabo Peñas. Monitor VHF 16 and GT Orcas app.",
    passageNotes: "Gijón is well-sheltered from prevailing W/NW winds. Departure best with morning offshore breeze. Watch for commercial traffic in approach channel.",
    restaurants: JSON.stringify([
      { name: "Restaurante Auga", rating: 4.4, cuisine: "Creative seafood", phone: "+34 985 168 186", hours: "13:30-16:00, 20:30-23:00", address: "Marina, Claudio Alvargonzález", description: "Michelin-recommended. Exceptional seafood tasting menu with marina views." },
      { name: "La Galana", rating: 4.5, cuisine: "Asturian", phone: "+34 985 172 429", hours: "12:00-16:00, 19:30-23:30", address: "Plaza Mayor 10", description: "Traditional Asturian cuisine in the old town. Famous for fabada and fresh fish." },
      { name: "Sidrería Tierra Astur", rating: 4.3, cuisine: "Cider house", phone: "+34 985 350 424", hours: "12:00-00:00", address: "C/ Gascona 1", description: "Authentic cider house on 'Cider Boulevard'. Cider poured from height, excellent cheese boards." },
      { name: "El Puerto", rating: 4.2, cuisine: "Seafood", phone: "+34 985 340 996", hours: "13:00-16:00, 20:00-23:30", address: "Av. Claudio Alvargonzález", description: "Waterfront seafood. Fresh catch of the day, reasonable prices." },
      { name: "Casa Gerardo", rating: 4.6, cuisine: "Fine dining", phone: "+34 985 887 797", hours: "13:30-15:30, 21:00-23:00", address: "Prendes (20min by car)", description: "Michelin star. Worth the trip for special occasion. Reservations essential." },
    ]),
    yachtShops: JSON.stringify([
      { name: "REPNAVAL", phone: "+34 985 327 580", hours: "09:30-13:30, 16:30-20:00", address: "C/ Marqués de San Esteban 14", description: "Since 1968. Full range of sailing gear, technical clothing, electronics, safety equipment." },
      { name: "Astur-Náutica", phone: "+34 985 151 616", hours: "10:00-14:00, 17:00-20:00", address: "Puerto Deportivo", description: "Chandlery at the marina. Boat repairs, sailmaker, rigging services." },
    ]),
    groceryStores: JSON.stringify([
      { name: "Mercadona", phone: null, hours: "09:00-21:30", address: "C/ Velázquez 54 (15min walk)", description: "Large supermarket, good selection of fresh produce and provisions." },
      { name: "Carrefour Express", phone: null, hours: "08:00-22:00", address: "C/ Corrida 35 (10min walk)", description: "Convenient city-center location." },
    ]),
  },
  {
    name: "Candás", slug: "candas", lat: 43.5883, lon: -5.7617, type: "port" as const,
    country: "ES", region: "Asturias", coastSegment: "biscay-north", coastlineNm: 8,
    water: true, shelter: "moderate", maxDraft: 2.5, vhfCh: "09", phone: "+34 985 870 021",
    notes: "Small fishing port, limited visitor berths. Exposed to NE swell.",
    approachNotes: "Small harbor, enter from N. Watch for fishing boats. Limited depth at LW.",
    orcaRisk: "low",
  },
  {
    name: "Cabo Peñas", slug: "cabo-penas", lat: 43.6553, lon: -5.8492, type: "cape" as const,
    country: "ES", region: "Asturias", coastSegment: "biscay-north", coastlineNm: 15,
    notes: "Northernmost point of Asturias. Wind acceleration zone. Lighthouse: Fl(3)15s, 117m, 35M.",
    passageNotes: "CAUTION: Wind accelerates around the cape, especially with W/NW winds. Keep 1-2NM offshore. Strong tidal streams on spring tides. Best rounded in morning calm.",
    orcaRisk: "low",
  },
  {
    name: "Luanco", slug: "luanco", lat: 43.6117, lon: -5.7917, type: "port" as const,
    country: "ES", region: "Asturias", coastSegment: "biscay-north", coastlineNm: 18,
    water: true, shelter: "moderate", maxDraft: 2.0, vhfCh: "09", phone: "+34 985 880 006",
    notes: "Small port west of Cabo Peñas. Good refuge if weather deteriorates.",
    orcaRisk: "low",
  },
  {
    name: "Avilés", slug: "aviles", lat: 43.5917, lon: -5.9250, type: "marina" as const,
    country: "ES", region: "Asturias", coastSegment: "biscay-north", coastlineNm: 25,
    fuel: true, water: true, electric: true, shelter: "good",
    maxDraft: 4.5, vhfCh: "12", phone: "+34 607 810 888", email: "info@marinadeaviles.es",
    website: "https://www.marinadeaviles.es",
    marinaName: "Marina de Avilés",
    marinaHours: "09:00-21:00",
    berthCount: 200, visitorBerths: 20, maxLength: 20,
    approachNotes: "River entrance from N. Follow leading lights. Strong current on ebb. Min depth 3m in channel.",
    approachDescription: "Approach the ría entrance from N. Two breakwaters protect the entrance. Follow the buoyed channel S into the ría. Marina is 1NM up the river on starboard side. Watch for commercial traffic.",
    notes: "River entrance, excellent shelter inside. Good base for visiting Avilés old town and Niemeyer Center.",
    orcaRisk: "low",
    restaurants: JSON.stringify([
      { name: "Casa Lin", rating: 4.4, cuisine: "Asturian", phone: "+34 985 540 027", hours: "13:00-16:00, 20:00-23:00", address: "Av. de Los Telares 32", description: "Excellent traditional Asturian food. Try the cachopo." },
      { name: "La Serrana", rating: 4.3, cuisine: "Seafood", phone: "+34 985 564 020", hours: "13:00-16:00, 20:30-23:00", address: "C/ La Fruta 9", description: "Fresh local seafood in the old quarter." },
    ]),
    groceryStores: JSON.stringify([
      { name: "Mercadona", phone: null, hours: "09:00-21:30", address: "Centro Comercial (10min walk)", description: "Full-size supermarket near town center." },
    ]),
  },
  {
    name: "Cudillero", slug: "cudillero", lat: 43.5633, lon: -6.1500, type: "port" as const,
    country: "ES", region: "Asturias", coastSegment: "biscay-north", coastlineNm: 35,
    water: true, shelter: "moderate", maxDraft: 2.0, vhfCh: "09", phone: "+34 985 590 006",
    notes: "Picturesque fishing village. Exposed in N/NW winds — do not attempt entry in heavy swell.",
    approachNotes: "Small harbor, enter from N. Very exposed to NW swell. Only enter in calm conditions.",
    orcaRisk: "low",
    restaurants: JSON.stringify([
      { name: "Mariño", rating: 4.3, cuisine: "Seafood", phone: "+34 985 590 186", hours: "13:00-16:00, 20:00-23:00", address: "Puerto de Cudillero", description: "Right on the harbor. Fresh fish and excellent views." },
    ]),
  },
  {
    name: "Luarca", slug: "luarca", lat: 43.5417, lon: -6.5333, type: "marina" as const,
    country: "ES", region: "Asturias", coastSegment: "biscay-north", coastlineNm: 45,
    fuel: true, water: true, electric: true, shelter: "good",
    maxDraft: 3.5, vhfCh: "09", phone: "+34 985 640 842",
    website: "https://www.puertodeluarca.es",
    marinaName: "Puerto Deportivo de Luarca",
    marinaHours: "Summer: 15:00-21:00 daily (weekends 09:00-21:00). Winter: weekends 09:30-18:30",
    berthCount: 100, visitorBerths: 15, maxLength: 15,
    approachNotes: "Enter from N between breakwaters. Well-sheltered once inside. Visitor pontoon on port side.",
    approachDescription: "Approach from N. Harbor entrance between two breakwaters, Fl.G and Fl.R lights. Follow the inner harbor wall to port, visitor berths on the first pontoon. Excellent shelter from all directions once inside.",
    notes: "Well-sheltered marina. Charming fishing town. Good overnight stop on passage westward.",
    orcaRisk: "low",
    passageNotes: "Luarca is a natural stopping point between Gijón and Ribadeo. Well-sheltered from prevailing W/NW winds.",
    restaurants: JSON.stringify([
      { name: "La Dársena de Luarca", rating: 4.2, cuisine: "Seafood", phone: "+34 985 470 672", hours: "13:00-16:00, 20:00-23:00", address: "Paseo del Muelle 11", description: "Waterfront dining, fresh local catch. Try the merluza a la sidra." },
      { name: "La Mariña de Luarca", rating: 4.4, cuisine: "Asturian", phone: "+34 985 640 115", hours: "12:30-16:00, 20:00-23:00", address: "C/ Rivero 14", description: "Traditional Asturian cuisine, cozy atmosphere." },
      { name: "Sport", rating: 4.1, cuisine: "Bar/tapas", phone: "+34 985 640 078", hours: "10:00-00:00", address: "Plaza Alfonso X", description: "Good tapas bar on the main square. Popular with locals." },
    ]),
    groceryStores: JSON.stringify([
      { name: "Alimerka", phone: null, hours: "09:00-21:00", address: "C/ Crucero 2 (5min walk)", description: "Local supermarket chain, good fresh produce." },
    ]),
  },
  {
    name: "Navia", slug: "navia", lat: 43.5500, lon: -6.7283, type: "port" as const,
    country: "ES", region: "Asturias", coastSegment: "biscay-north", coastlineNm: 60,
    water: true, shelter: "moderate", maxDraft: 2.5, vhfCh: "09", phone: "+34 985 630 040",
    notes: "River port, limited depth at low tide. Check tide tables before entering.",
    approachNotes: "River entrance, follow buoys. Depth reduces significantly at LW springs.",
    orcaRisk: "low",
  },
  {
    name: "Ribadeo", slug: "ribadeo", lat: 43.5350, lon: -7.0417, type: "marina" as const,
    country: "ES", region: "Galicia", coastSegment: "biscay-north", coastlineNm: 80,
    fuel: true, water: true, electric: true, shelter: "good",
    maxDraft: 3.0, vhfCh: "09", phone: "+34 982 131 464",
    marinaName: "Puerto Deportivo de Ribadeo",
    berthCount: 150, visitorBerths: 20, maxLength: 15,
    approachNotes: "Enter Ría de Ribadeo from N. Strong tidal currents at entrance. Follow buoyed channel.",
    notes: "Ría entrance. Asturias/Galicia border. Good facilities. Visit Playa de las Catedrales (30min drive).",
    orcaRisk: "medium", orcaNotes: "Occasional orca sightings in Galician waters. Monitor GT Orcas app and VHF 16.",
    restaurants: JSON.stringify([
      { name: "Restaurante Marinero", rating: 4.3, cuisine: "Galician seafood", phone: "+34 982 130 218", hours: "Tue-Sun 08:00-23:00", address: "C/ San Roque 12", description: "Fresh Galician seafood. Excellent pulpo and percebes." },
      { name: "Mar de Rinlo", rating: 4.5, cuisine: "Seafood", phone: "+34 982 129 916", hours: "13:00-16:00, 20:30-23:00", address: "Rinlo (10min drive)", description: "Outstanding seafood restaurant in nearby fishing village. Worth the trip." },
    ]),
  },
  {
    name: "Foz", slug: "foz", lat: 43.5717, lon: -7.2550, type: "port" as const,
    country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 92,
    water: true, shelter: "moderate", maxDraft: 2.0, vhfCh: "09", phone: "+34 982 132 190",
    notes: "Small port in Ría de Foz.",
    orcaRisk: "medium", orcaNotes: "Monitor GT Orcas app. Orca sightings reported along Galician coast.",
  },
  {
    name: "Viveiro", slug: "viveiro", lat: 43.6617, lon: -7.5950, type: "marina" as const,
    country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 110,
    fuel: true, water: true, electric: true, shelter: "good",
    maxDraft: 3.5, vhfCh: "09", phone: "+34 690 604 452",
    website: "https://marinaviveiro.com",
    marinaName: "Marina Viveiro (Celeiro)",
    marinaHours: "Mon-Sun 09:00-14:00, 16:00-20:00",
    berthCount: 235, visitorBerths: 30, maxLength: 16,
    approachNotes: "Enter Ría de Viveiro from N. Deep ría with good shelter. Marina in Celeiro on E side.",
    notes: "Well-sheltered ría. Good marina facilities. Historic town.",
    orcaRisk: "medium", orcaNotes: "Galician coast — moderate orca risk. Use GT Orcas app.",
    restaurants: JSON.stringify([
      { name: "Restaurante Nito", rating: 4.5, cuisine: "Galician", phone: "+34 982 560 987", hours: "13:00-16:00, 20:30-23:00", address: "Av. Cervantes", description: "Highly rated Galician cuisine. Try the empanada and fresh fish." },
    ]),
  },
  {
    name: "Estaca de Bares", slug: "estaca-de-bares", lat: 43.7883, lon: -7.6850, type: "cape" as const,
    country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 120,
    notes: "Northernmost point of Spain! Major wind acceleration. Lighthouse: Fl(2)7.5s, 101m, 25M.",
    passageNotes: "DANGER: Strongest wind acceleration zone on the route. Can add 15-20kt to prevailing wind. Strong tidal streams. Round at least 2NM offshore. Best in early morning or calm conditions. Have a fallback plan (Viveiro or Cariño).",
    orcaRisk: "medium",
  },
  {
    name: "Cabo Ortegal", slug: "cabo-ortegal", lat: 43.7700, lon: -7.8700, type: "cape" as const,
    country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 130,
    notes: "Dramatic cape. Strong currents and wind acceleration. Lighthouse: Fl(1+3)16s.",
    passageNotes: "DANGER: Second major cape. Strong currents around the point. Wind acceleration in W/NW. Round at least 2NM offshore. Combined with Estaca de Bares, this is the most challenging section of the route.",
    orcaRisk: "medium",
  },
  {
    name: "Cariño", slug: "carino", lat: 43.7367, lon: -7.8667, type: "port" as const,
    country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 133,
    water: true, shelter: "good", maxDraft: 3.0, vhfCh: "09", phone: "+34 981 420 002",
    notes: "Sheltered port just south of Cabo Ortegal. Good refuge after rounding the capes.",
    approachNotes: "Enter from NW. Well-sheltered inside Ría de Ortigueira.",
    orcaRisk: "medium",
  },
  {
    name: "Cedeira", slug: "cedeira", lat: 43.6600, lon: -8.0567, type: "marina" as const,
    country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 140,
    fuel: true, water: true, electric: true, shelter: "good",
    maxDraft: 3.0, vhfCh: "09", phone: "+34 981 480 200",
    marinaName: "Puerto Deportivo de Cedeira",
    berthCount: 100, visitorBerths: 10, maxLength: 14,
    approachNotes: "Enter Ría de Cedeira from NW. Deep ría with good shelter.",
    notes: "Well-sheltered ría. Safe stop after rounding Estaca/Ortegal capes.",
    orcaRisk: "medium",
  },
  {
    name: "Ferrol", slug: "ferrol", lat: 43.4833, lon: -8.2333, type: "marina" as const,
    country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 150,
    fuel: true, water: true, electric: true, repairs: true, shelter: "good",
    maxDraft: 5.0, vhfCh: "12", phone: "+34 981 336 008",
    website: "https://www.apfsc.es",
    marinaName: "Marina de Ferrol",
    berthCount: 300, visitorBerths: 30, maxLength: 25,
    approachNotes: "Enter Ría de Ferrol from NW. Narrow entrance between castles. Deep water inside. Watch for naval traffic.",
    approachDescription: "The ría entrance is narrow (400m) between Castillo de San Felipe (S) and Castillo de La Palma (N). Fl.G/Fl.R entrance lights. Deep water throughout. Major naval base — watch for military vessels. Marina is on S side of inner harbor.",
    notes: "Major naval port. Excellent shelter and all facilities. Good boatyard for repairs.",
    orcaRisk: "medium", orcaNotes: "Galician coast — moderate orca risk. Deep inside ría = safe.",
    restaurants: JSON.stringify([
      { name: "A Gabeira", rating: 4.4, cuisine: "Galician", phone: "+34 981 351 447", hours: "13:00-16:00, 20:30-23:00", address: "C/ Dolores 44", description: "Excellent Galician cuisine in old town. Famous for caldeirada and lacón." },
      { name: "O Pazo", rating: 4.3, cuisine: "Seafood", phone: "+34 981 347 285", hours: "13:00-16:00, 21:00-23:30", address: "Av. de Catabois 185", description: "Quality seafood restaurant. Try the mariscada for two." },
    ]),
    groceryStores: JSON.stringify([
      { name: "Mercadona", phone: null, hours: "09:00-21:30", address: "C/ Real (15min walk)", description: "Standard supermarket in town center." },
    ]),
  },
  {
    name: "La Coruña", slug: "la-coruna", lat: 43.3700, lon: -8.4000, type: "marina" as const,
    country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 160,
    fuel: true, water: true, electric: true, repairs: true, customs: true, shelter: "good",
    maxDraft: 6.0, vhfCh: "12", phone: "+34 881 920 482", email: "info@marinacoruna.com",
    website: "https://www.marinacoruna.com",
    marinaName: "Marina Coruña",
    marinaHours: "24/7. Office: 09:00-21:00",
    berthCount: 700, visitorBerths: 100, maxLength: 50,
    approachNotes: "Enter from NW. Large commercial port — stay clear of cargo ships. Marina on S side of inner harbor. Follow port control instructions on VHF 12.",
    approachDescription: "Approach from NW past Torre de Hércules (UNESCO World Heritage lighthouse). The outer harbor is large and busy with commercial traffic. Contact Port Control on VHF 12 before entering. Marina Coruña is in the inner harbor basin, accessed through the marina entrance on the S side. Well-marked with pontoons A-H.",
    notes: "Major city marina. All services. Excellent provisioning. Good base for crew changes and repairs.",
    orcaRisk: "medium", orcaNotes: "Galician coast — moderate orca risk offshore. Inside harbor = safe. Monitor GT Orcas app before departing.",
    passageNotes: "La Coruña is a major waypoint. Good place for crew rest, reprovisioning, and weather window waiting before continuing south toward Finisterre.",
    restaurants: JSON.stringify([
      { name: "Adega O Bebedeiro", rating: 4.5, cuisine: "Galician fine dining", phone: "+34 981 210 609", hours: "13:30-15:30, 21:00-23:00", address: "C/ Angel Rebollo 34", description: "Outstanding Galician cuisine. Excellent wine cellar. Reservations recommended." },
      { name: "Cervecería La Bombilla", rating: 4.3, cuisine: "Seafood/tapas", phone: "+34 981 220 052", hours: "12:00-00:00", address: "C/ Galera 5", description: "Famous for pulpo a feira and fresh oysters. Lively atmosphere." },
      { name: "Pablo Gallego", rating: 4.6, cuisine: "Modern Galician", phone: "+34 981 208 888", hours: "13:30-15:30, 21:00-23:00", address: "Av. de la Marina", description: "Michelin-recommended. Creative Galician cuisine with harbor views." },
      { name: "A Taberna de Cunqueiro", rating: 4.2, cuisine: "Traditional", phone: "+34 981 200 013", hours: "13:00-16:00, 20:00-23:30", address: "C/ Estrella 24", description: "Traditional Galician taberna in the old town. Authentic atmosphere." },
      { name: "Mesón do Pulpo", rating: 4.1, cuisine: "Pulpo specialist", phone: "+34 981 201 147", hours: "12:00-16:00, 19:30-23:00", address: "C/ Franja 9-11", description: "Best pulpo in town. Simple but excellent. No reservations." },
    ]),
    yachtShops: JSON.stringify([
      { name: "Tienda del Mar", phone: "+34 981 228 420", hours: "10:00-14:00, 16:30-20:00", address: "Av. de la Marina", description: "4000+ nautical products. Charts, electronics, safety equipment, clothing." },
      { name: "Naval Chicolino", phone: "+34 981 205 658", hours: "09:00-13:30, 16:00-19:30", address: "Muelle de San Diego", description: "Ropes, cables, marine safety equipment. Good for rigging supplies." },
      { name: "Náutica Pombo", phone: "+34 981 212 345", hours: "10:00-14:00, 17:00-20:00", address: "C/ San Andrés 134", description: "Sailing clothing and accessories since 1997." },
    ]),
    groceryStores: JSON.stringify([
      { name: "Mercadona", phone: null, hours: "09:00-21:30", address: "Multiple locations (closest: C/ Juan Flórez)", description: "Standard large supermarket. Good for provisioning." },
      { name: "Carrefour Express", phone: null, hours: "08:00-22:00", address: "C/ Real (10min walk from marina)", description: "City-center convenience store." },
      { name: "Mercado de San Agustín", phone: null, hours: "Mon-Sat 08:00-15:00", address: "C/ San Agustín", description: "Traditional market. Best for fresh fish, meat, vegetables, and local cheeses." },
    ]),
  },
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
  console.log(`Seeded ${ports.length} ports with detailed data.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
