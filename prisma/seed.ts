import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for seeding");
}

const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });

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
    maxDraft: 4.5, vhfCh: "12", phone: "+34 985 541 111", email: "info@marinadeaviles.es",
    website: "https://www.marinadeaviles.es",
    marinaName: "Club Náutico Marina de Avilés",
    marinaHours: "09:00-21:00",
    berthCount: 200, visitorBerths: 20, maxLength: 20,
    approachNotes: "WPT 43°35'.65N 05°56'.77W. Well-marked/lit entrance channel runs E×S for 7ca then turns S for 2M to Club Náutico pontoons at 43°33'.66N 05°55'.28W, W side of chan. Max LOA ~12m. Approach near HW due to silting in entrance. Beware FV wash. Port of refuge except in W/NW >F9.",
    approachDescription: "Approach from SW of Cabo Peñas. The well-marked/lit entrance channel runs E×S for 7ca then turns S for 2M to marina. Two breakwaters protect the entrance. S of Pta del Castillo lighthouse. Follow buoyed channel — strong current on ebb. Marina pontoons on W side. Watch for commercial traffic. MRCC (985) 326050.",
    notes: "River entrance, excellent shelter inside. Good base for visiting Avilés old town and Niemeyer Center. Also: Harbour 3M E at San Esteban de Pravia (minor, few FV berths).",
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
    water: true, shelter: "moderate", maxDraft: 2.0, vhfCh: "27", phone: "+34 985 591 114",
    notes: "Picturesque fishing village. Hammerhead N pontoon or SW of pontoons on yellow/red fore/aft pick-up buoys. Aft buoy held underwater by weight (2016). FVs moor/berth at NW end. Old drying harbour S of entrance exposed to swell. HM ☎591114. €25/night.",
    approachNotes: "WPT 43°34'.33N 06°08'.71W, 190°/3½ca to W bkwtr head. From W keep ≥5ca offshore until clear of Piedras las Colinas (tall islets/reefs NW of entrance). From E approach with Pta Rebollera lt ho on initial bearing 200°. Rocky entrance opens only when close. Narrow chan skirts W bkwtr into basin. Before leaving: look over bkwtr to assess swell.",
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
    approachNotes: "WPT 43°33'.51N 06°32'.29W, 170°/6ca to E bkwtr head. Outer harbour protected from all but N'lies, but swell can intrude (reported to badly affect the anchorages). No room to anchor inside harbour. Narrow chan leads SE to inner harbour dredged 2m (prone to silting). Lights: approach on ldg lights/marks 170° to clear rocky shoals either side. Cabo Busto 3M ENE of harbour entrance — Pta Blanca conspicuous headland.",
    approachDescription: "Approach from N on leading lights 170°. WPT 43°33'.51N 06°32'.29W. Harbor entrance between E and W breakwaters (Fl.G and Fl.R lights). Outer harbour sheltered from all but N'lies. Narrow channel leads SE to inner harbour. Pontoons in SE corner (mostly local craft). Possible berth on NW side from FV quay. Visitor berths limited — check with HM.",
    notes: "Well-sheltered inner harbour. Charming fishing town. Less than 0.5m at LW at outer end of bkwtr — approach with care at low springs. Good overnight stop on passage westward.",
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
    maxDraft: 3.0, vhfCh: "09", phone: "+34 982 120 428",
    email: "vela@cnribadeo.com",
    marinaName: "Marina/CN de Ribadeo",
    berthCount: 240, visitorBerths: 20, maxLength: 18,
    approachNotes: "WPT 43°33'.84N 07°02'.30W, 170°/4½ca to intersect 140° ldg line. Thence pick-up inner ldg line 205° to W span of bridge (lts on pillars, 32m clearance). Tides run hard. S of bridge: extensive drying sandbanks on E side of ría. Depths may be less than charted. Ldg marks: conspicuous R onion-shaped tower in town (off chartlet) on 205° line. White lookout tower at E end of bridge conspicuous. MRCC (982) 326050.",
    approachDescription: "Enter Ría de Ribadeo from N. Pick up 140° leading line to the bridge. Strong tidal currents at entrance, especially on springs (up to 2kt). Follow buoyed channel under bridge (32m clearance). Marina/CN de Ribadeo is inside, past the bridge. Good anchorage off Figueras or off Castropol (8ca S of bridge) in 4m.",
    notes: "Ría entrance on Asturias/Galicia border. €0.78/m² (LOA × beam) May-Oct. Travel lift. Visit Playa de las Catedrales (30min drive).",
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
    website: "https://www.northwestmarinas.com/en/marina-viveiro/the-marina/marina",
    email: "viveiro@marinaviveiro.com",
    marinaName: "Marina Viveiro (Celeiro)",
    marinaHours: "Mon-Sun 09:00-14:00, 16:00-20:00",
    berthCount: 243, visitorBerths: 30, maxLength: 18,
    approachNotes: "WPT 43°43'.25N 07°35'.30W (mouth of ría), 195°/2.4M to round Celeiro bkwtr. Easy entrance, 7ca wide between Isla Gabeira and Pta de Faro. Mte Faro Juances — distinctive conical peak (193m) close SE of Pta de Faro, conspicuous landmark. Shelter good except in N'lies. In E'lies inside Isla Insua d'Area, 1-3M NE of Celeiro. In S-W winds anchor at head of ría off Playa de Covas in 6-7m. Celeiro Port VHF Ch 16; Marina VHF Ch 09.",
    notes: "Well-sheltered ría. Marina at Celeiro on S quayside pontoon. €2.80, max 18m LOA on fingers, 30m on quay. Fuel by tanker/hose from nearby depot. Wi-Fi. Guardia Civil del Mar pontoon (N) — no visitors. Historic town of Viveiro 3km.",
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
    notes: "Dramatic cape. Strong currents and wind acceleration. Lighthouse: Fl(1+3)16s. Offlying needle rocks Los Aguillones — keep ≥2M off.",
    passageNotes: "DANGER: Cabo Ortegal should be rounded at least 2M off due to the offlying needle rocks, Los Aguillones. Tidal streams set SW on the ebb and NE on the flood. Any current tends to run SW, then S. Coast deeply indented, 600m high mountains rising only 5M inland. Coastal features hard to identify against this background. Major lights sited so high they are often obscured by low cloud/mist in onshore weather. Combined with Estaca de Bares, this is the most challenging section of the route. Refuge: Ría de Cedeira 3M SSW of Pta Candelaria.",
    orcaRisk: "medium",
  },
  {
    name: "Cariño", slug: "carino", lat: 43.7367, lon: -7.8667, type: "port" as const,
    country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 133,
    water: true, shelter: "good", maxDraft: 3.0, vhfCh: "09", phone: "+34 981 420 002",
    notes: "2M S of Cabo Ortegal. Well-sheltered from all W'lies. Commercial outer jetty. In E'lies, anchor off Espasante FV harbour 2-3M ESE of Cariño. Good refuge after rounding the capes.",
    approachNotes: "Enter from NW into Ría de Ortigueira. Well-sheltered inside. Anchor in NW corner or berth alongside if space.",
    orcaRisk: "medium",
  },
  {
    name: "Cedeira", slug: "cedeira", lat: 43.6600, lon: -8.0567, type: "marina" as const,
    country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 140,
    fuel: true, water: true, electric: true, shelter: "good",
    maxDraft: 3.0, vhfCh: "09", phone: "+34 981 492 212",
    marinaName: "Puerto Deportivo de Cedeira",
    berthCount: 100, visitorBerths: 10, maxLength: 12,
    approachNotes: "WPT 43°41'.00N 08°05'.41W, 155°/1.7M to Pta del Sarridal. From N keep >1M off Pta Candelaria until ría opens. From S a similar offing clears rocks N/NW of Pta Chirlateira. 155° ldg line: Pta Promontorio lt ho ≠ Pta del Sarridal. Abeam Pta Chirlateira with Pta Xian brg 161°, track midway between Pta del Sarridal and Piedras de Media Mar. When bkwtr hd bears 060° turn towards anchorage. Piedras de Media Mar — BRB lt tower conspicuous in centre of ría. Whole ría is a marine reserve — no constraints on visitors, anchor anywhere for free.",
    notes: "Very good shelter. Handy for awaiting a fair wind to round Cabo Ortegal. Modern FV port, 500m SE. Crane 110t. Anchor in 3-4m about 500m SE, excellent holding on sand. MRSC (981) 209541. Fishermen Cofradía ☎480389.",
    orcaRisk: "medium",
  },
  {
    name: "Ferrol", slug: "ferrol", lat: 43.4833, lon: -8.2333, type: "marina" as const,
    country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 150,
    fuel: true, water: true, electric: true, repairs: true, shelter: "good",
    maxDraft: 5.0, vhfCh: "12", phone: "+34 981 321 594",
    website: "https://www.apfsc.es",
    marinaName: "Marina Terramar / Dársena de Curuxeiras",
    berthCount: 300, visitorBerths: 30, maxLength: 25,
    approachNotes: "WPT 43°26'.59N 08°20'.17W (close to WCM lt buoy). White sector 041.5°-042.5° of Batería de San Cristóbal Dir lt. From near Cabo Prioriño Chico lt ho, a substantial bkwtr extends 145°/0.5M, halfway across ent to ría. Chan is deep and adequately buoyed/lit. In bad weather avoid outer banks (Tarracidos, Cabaleiro, Leixiñas) to N and W. Marina Terramar at La Graña: ~50 berths. Dársena de Curuxeiras central but in 2m on NE side, prone to ferry wash. MRSC (981) 209541.",
    approachDescription: "The ría entrance is narrow between Cabo Prioriño Chico bkwtr head (Fl R 5s 21m 7M) and adjacent T-jetty Fl(2) R 7s 10m 3M. Ldg lts 085.2° through the narrows. In bad weather avoid outer banks to N and W. Deep channel inside. Major naval base — watch for military vessels. Marina Terramar at La Graña offers ~50 berths or anchor. Dársena de Curuxeiras is central, 3 pontoons at head not for visitors. Also: Ría de Ares has yacht pontoons in small FV harbour. Sada (Ría de Betanzos) has two marinas with bus links to La Coruña.",
    notes: "Major naval port. Very good shelter inside ría (but beware strong tides and occasional squalls in narrows). Limited yacht facilities in naval/commercial/ship-building port. Best options: Marina Terramar at La Graña (~50 berths, bus every ½hr to city 20min). City all facilities.",
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
    approachNotes: "Enter from NW past Torre de Hércules. CAUTION: 5M W of Torre de Hércules, beware large ships using Punta Langosteira (huge new commercial port). Direct course across 19M bight W to Islas Sisargas will keep clear of this and other inshore hazards. Passage between Islas Sisargas and mainland is not advised. Contact Port Control on VHF 12 before entering inner harbour.",
    approachDescription: "Approach from NW past Torre de Hércules (UNESCO World Heritage lighthouse, Fl(4) 20s 104m 23M). La Coruña is a port of refuge, accessible in all weathers. Outer harbor is large and busy with commercial traffic. 5M W: beware Punta Langosteira commercial port — large ships. Marina Coruña is in the inner harbour basin (S side), well-marked with pontoons A-H. Also: Real Club Náutico (RCN) on E side, limited visitor berths.",
    notes: "Major city marina, port of refuge accessible in all weathers. All services. Two marinas: Marina Coruña (700 berths, full facilities) and RCN. Good base for crew changes, reprovisioning, repairs, and weather window waiting before Finisterre.",
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
    tier: "major",
  },
  {
    name: "Burela", slug: "burela", lat: 43.6617, lon: -7.3583, type: "port" as const,
    country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 100,
    water: true, shelter: "moderate", maxDraft: 3.0, vhfCh: "09", phone: "+34 982 586 002",
    notes: "Working fishing port. Limited visitor facilities. Fuel available. Good bail-out between Viveiro and capes.",
    orcaRisk: "medium", tier: "minor",
  },
  {
    name: "Sada", slug: "sada", lat: 43.3550, lon: -8.2550, type: "marina" as const,
    country: "ES", region: "Galicia", coastSegment: "galicia-north", coastlineNm: 155,
    fuel: true, water: true, electric: true, shelter: "good",
    maxDraft: 3.5, vhfCh: "09", phone: "+34 981 619 015",
    email: "marinasada@marinasada.com",
    website: "https://www.marinasada.com",
    marinaName: "Marina Sada / Club Náutico de Sada",
    berthCount: 630, visitorBerths: 30, maxLength: 20,
    approachNotes: "WPT 43°24'.34N 08°15'.07W, 171°/2.6M to Fontán harbour N mole head. Keep clear of Bajo La Miranda (3.7m) 6ca SW of WPT, and Bajo Cagarroso (2.1m) 5 cables SSW of E mole head. Two marinas: Marina Sada (☎619015, €2.72, 630+ berths, max 20m, safe over-wintering, max stay 6 months) and Club Náutico de Sada (☎619018, €2.50, 313 berths, max 20m). Cabo Prioriño Chico 5M WNW. Ría is wide and easy to enter, but shoals steadily S of harbour.",
    notes: "Alternative to La Coruña. Two marinas at Fontán (Ría de Betanzos). Town 10min walk — better facilities than Fontán. La Coruña by taxi 20min, hourly bus 30min. Very good shelter in Fontán harbour S side and Club Náutico NW side.",
    orcaRisk: "medium", tier: "medium",
  },
];

type PortSeed = (typeof ports)[number];

const VERIFIED_AT = "2026-04-13";
function verification(source: string, url?: string, notes?: string) {
  return { source, url, checkedAt: VERIFIED_AT, notes };
}

const PORT_ENRICHMENTS: Record<string, Partial<PortSeed>> = {
  gijon: {
    extras: [
      { category: "laundry", name: "Lavandería Autoservicio Mistral", phone: null, hours: "08:00-22:00", address: "C/ Rodríguez San Pedro 8", description: "Self-service laundry useful after offshore legs. About 12 min walk from the marina." },
      { category: "pharmacy", name: "Farmacia Corrida", phone: "+34 985 350 216", hours: "Mon-Sat 09:30-21:30", address: "C/ Corrida 21", description: "Central pharmacy for basics, seasickness meds and first-aid restock." },
      { category: "atm", name: "Santander ATM", phone: null, hours: "24/7 ATM", address: "Plaza del Marqués", description: "Closest reliable ATM by the old port." },
      { category: "taxi", name: "Radio Taxi Gijón", phone: "+34 985 141 111", hours: "24/7", address: "Citywide", description: "Useful for late crew changes or chandlery runs." },
    ],
    marinaFacilities: {
      showers: true, toilets: true, laundry: false, wifi: true, fuelDock: true,
      repairs: true, chandlery: true, securityGate: true, pumpOut: false,
    },
    sourceVerification: {
      phone: verification("Official marina contact", "https://puertodeportivogijon.com"),
      hours: verification("Official marina contact", "https://puertodeportivogijon.com"),
      approach: verification("Official marina notes + curated pilotage", "https://puertodeportivogijon.com"),
      poi: verification("Curated local shore services", undefined, "To be rechecked in-season"),
      facilities: verification("Official marina description", "https://puertodeportivogijon.com"),
    },
  },
  candas: {
    restaurants: [
      { name: "Casa Alicia", rating: 4.3, cuisine: "Asturian seafood", phone: "+34 985 872 361", hours: "13:00-16:00, 20:00-23:00", address: "C/ Rosario 6", description: "Reliable local seafood and hearty post-passage meals in the town center." },
      { name: "Restaurante La Playa", rating: 4.2, cuisine: "Fish & tapas", phone: "+34 985 884 432", hours: "13:00-16:00, 20:00-23:00", address: "Paseo de San Antonio", description: "Short walk from the harbor with easy informal dinner option." },
    ],
    groceryStores: [
      { name: "Alimerka", hours: "09:00-21:00", address: "C/ Valdés Pumarino", description: "Closest practical provisioning option in town." },
      { name: "Panadería Manín", hours: "07:30-14:30, 17:00-20:00", address: "C/ Pedro Herrero", description: "Good bakery for early departure supplies." },
    ],
    yachtShops: [
      { name: "Astur Náutica Gijón", phone: "+34 985 151 616", hours: "10:00-14:00, 17:00-20:00", address: "Puerto Deportivo de Gijón", description: "Nearest proper chandlery if Candás stop turns technical." },
    ],
    extras: [
      { category: "pharmacy", name: "Farmacia Candás", phone: "+34 985 870 192", hours: "Mon-Sat 09:30-21:30", address: "C/ Pedro Herrero", description: "Closest pharmacy for basic medical supplies." },
      { category: "atm", name: "Caja Rural ATM", hours: "24/7 ATM", address: "Plaza Baragaña", description: "Central ATM in the town square." },
      { category: "taxi", name: "Taxi Carreño", phone: "+34 985 872 222", hours: "24/7 on call", address: "Candás", description: "Useful if diverting crew or provisioning." },
    ],
    marinaFacilities: {
      showers: false, toilets: false, laundry: false, wifi: false, fuelDock: false,
      repairs: false, chandlery: false, securityGate: false, pumpOut: false,
    },
    sourceVerification: {
      phone: verification("Port contact and local harbour notes"),
      approach: verification("Curated pilotage notes"),
      poi: verification("Curated local listing", undefined, "Secondary stop; verify in season"),
    },
  },
  luanco: {
    restaurants: [
      { name: "La Posada de Luanco", rating: 4.3, cuisine: "Seafood / Asturian", phone: "+34 985 880 140", hours: "13:00-16:00, 20:30-23:00", address: "C/ Riba 1", description: "Comfortable sit-down option close to the waterfront." },
      { name: "Restaurante Guernica", rating: 4.2, cuisine: "Seafood", phone: "+34 985 880 354", hours: "13:00-16:00, 20:00-23:00", address: "Muelle de Luanco", description: "Harbor-side seafood, useful if sheltering behind Cabo Peñas." },
    ],
    groceryStores: [
      { name: "Alimerka", hours: "09:00-21:00", address: "C/ Ramón Pérez de Ayala", description: "Main provisioning point in town." },
      { name: "Panadería El Comercio", hours: "07:30-14:30, 17:00-20:00", address: "C/ La Riba", description: "Easy pickup for next-leg breakfast and bread." },
    ],
    extras: [
      { category: "pharmacy", name: "Farmacia Luanco", phone: "+34 985 880 173", hours: "Mon-Sat 09:30-21:30", address: "C/ Ramón Pérez de Ayala", description: "Central pharmacy in walking range." },
      { category: "atm", name: "Caja Rural ATM", hours: "24/7 ATM", address: "Plaza del Reloj", description: "Nearest ATM for cash." },
    ],
    marinaFacilities: {
      showers: false, toilets: true, laundry: false, wifi: false, fuelDock: false,
      repairs: false, chandlery: false, securityGate: false, pumpOut: false,
    },
    sourceVerification: {
      phone: verification("Local port notes"),
      poi: verification("Curated local listing"),
      approach: verification("Curated pilotage notes"),
    },
  },
  aviles: {
    yachtShops: [
      { name: "Accastillaje Avilés", phone: "+34 985 560 998", hours: "09:30-13:30, 16:30-19:30", address: "Zona portuaria de Avilés", description: "Closest practical marine supplies and hardware around the ría." },
      { name: "Náutica Río", phone: "+34 985 520 471", hours: "10:00-14:00, 17:00-20:00", address: "Avilés / nearby ría area", description: "General boating accessories and maintenance consumables." },
    ],
    extras: [
      { category: "laundry", name: "OpenBlue Laundry", hours: "08:00-22:00", address: "C/ La Cámara", description: "Self-service laundry in the center, useful after a wet coastal leg." },
      { category: "pharmacy", name: "Farmacia Las Meanas", phone: "+34 985 540 650", hours: "Mon-Sat 09:30-21:30", address: "C/ Las Meanas", description: "Large central pharmacy." },
      { category: "atm", name: "Santander ATM", hours: "24/7 ATM", address: "C/ La Cámara", description: "Central ATM walking distance from the marina." },
      { category: "taxi", name: "Radio Taxi Avilés", phone: "+34 985 525 252", hours: "24/7", address: "Citywide", description: "Useful for late arrivals or provisioning runs." },
    ],
    marinaFacilities: {
      showers: true, toilets: true, laundry: false, wifi: true, fuelDock: true,
      repairs: false, chandlery: true, securityGate: true, pumpOut: false,
    },
    sourceVerification: {
      phone: verification("Official marina website", "https://www.marinadeaviles.es"),
      hours: verification("Official marina website", "https://www.marinadeaviles.es"),
      approach: verification("Official marina website + curated notes", "https://www.marinadeaviles.es"),
      poi: verification("Curated local listing"),
      facilities: verification("Official marina website", "https://www.marinadeaviles.es"),
    },
  },
  cudillero: {
    restaurants: [
      { name: "Mariño", rating: 4.3, cuisine: "Seafood", phone: "+34 985 590 186", hours: "13:00-16:00, 20:00-23:00", address: "Puerto de Cudillero", description: "Right on the harbor. Fresh fish and excellent views." },
      { name: "El Remo", rating: 4.2, cuisine: "Asturian seafood", phone: "+34 985 590 151", hours: "13:00-16:00, 20:00-23:00", address: "Plaza de la Marina", description: "Reliable second option in the amphitheatre of the village." },
    ],
    yachtShops: [
      { name: "Náutica Luarca Service", phone: "+34 985 470 998", hours: "09:30-13:30, 16:30-19:30", address: "Puerto de Luarca", description: "Nearest workable chandlery if Cudillero stop turns technical." },
    ],
    groceryStores: [
      { name: "Alimerka", hours: "09:00-21:00", address: "Av. Selgas", description: "Best practical stop for provisions in town." },
      { name: "Panadería La Marina", hours: "07:30-14:30, 17:00-20:00", address: "Puerto de Cudillero", description: "Fresh bread and simple breakfast supplies close to the harbor." },
    ],
    extras: [
      { category: "pharmacy", name: "Farmacia Cudillero", phone: "+34 985 590 045", hours: "Mon-Sat 09:30-21:30", address: "C/ Suárez Inclán", description: "Closest pharmacy up from the waterfront." },
      { category: "atm", name: "Caja Rural ATM", hours: "24/7 ATM", address: "Plaza de la Marina", description: "Nearest cash point in the village." },
      { category: "taxi", name: "Taxi Cudillero", phone: "+34 985 591 111", hours: "On call", address: "Cudillero", description: "Useful if the harbor becomes untenable and crew needs transfer." },
    ],
    marinaFacilities: {
      showers: false, toilets: true, laundry: false, wifi: false, fuelDock: false,
      repairs: false, chandlery: false, securityGate: false, pumpOut: false,
    },
    sourceVerification: {
      phone: verification("Local port notes"),
      poi: verification("Curated local listing"),
      approach: verification("Curated pilotage notes"),
    },
  },
  luarca: {
    yachtShops: [
      { name: "Náutica Luarca Service", phone: "+34 985 470 998", hours: "09:30-13:30, 16:30-19:30", address: "Puerto de Luarca", description: "Basic chandlery, rigging consumables and emergency boating items." },
    ],
    extras: [
      { category: "laundry", name: "Lavandería Autoservicio Luarca", hours: "08:00-22:00", address: "C/ Párroco Camino", description: "Useful self-service laundry within walking distance." },
      { category: "pharmacy", name: "Farmacia Luarca Centro", phone: "+34 985 640 022", hours: "Mon-Sat 09:30-21:30", address: "C/ Uría", description: "Central pharmacy for crew needs." },
      { category: "atm", name: "BBVA ATM", hours: "24/7 ATM", address: "Plaza Alfonso X", description: "Closest reliable ATM." },
      { category: "taxi", name: "Radio Taxi Valdés", phone: "+34 985 470 005", hours: "24/7", address: "Luarca", description: "Useful for chandlery or crew transfer." },
    ],
    marinaFacilities: {
      showers: true, toilets: true, laundry: false, wifi: true, fuelDock: true,
      repairs: false, chandlery: true, securityGate: true, pumpOut: false,
    },
    sourceVerification: {
      phone: verification("Official port website", "https://www.puertodeluarca.es"),
      hours: verification("Official port website", "https://www.puertodeluarca.es"),
      approach: verification("Official port website + curated notes", "https://www.puertodeluarca.es"),
      poi: verification("Curated local listing"),
      facilities: verification("Official port website", "https://www.puertodeluarca.es"),
    },
  },
  navia: {
    restaurants: [
      { name: "Restaurante La Barca", rating: 4.2, cuisine: "Seafood", phone: "+34 985 630 271", hours: "13:00-16:00, 20:00-23:00", address: "Puerto de Navia", description: "Simple harbor-side meal if waiting on tide." },
      { name: "Casa Fermin", rating: 4.1, cuisine: "Asturian", phone: "+34 985 630 129", hours: "13:00-16:00, 20:00-23:00", address: "Centro de Navia", description: "Solid traditional option in town." },
    ],
    yachtShops: [
      { name: "Náutica Luarca Service", phone: "+34 985 470 998", hours: "09:30-13:30, 16:30-19:30", address: "Puerto de Luarca", description: "Nearest chandlery if Navia stop becomes a technical diversion." },
    ],
    groceryStores: [
      { name: "Alimerka", hours: "09:00-21:00", address: "Av. Manuel Suárez", description: "Main grocery stop in Navia." },
      { name: "Panadería Jovellanos", hours: "07:30-14:30, 17:00-20:00", address: "C/ Jovellanos", description: "Good bakery for tide-gate departure." },
    ],
    extras: [
      { category: "pharmacy", name: "Farmacia Navia", phone: "+34 985 630 007", hours: "Mon-Sat 09:30-21:30", address: "C/ Real", description: "Central pharmacy." },
      { category: "atm", name: "Liberbank ATM", hours: "24/7 ATM", address: "C/ Real", description: "Cash point in town center." },
    ],
    marinaFacilities: {
      showers: false, toilets: false, laundry: false, wifi: false, fuelDock: false,
      repairs: false, chandlery: false, securityGate: false, pumpOut: false,
    },
    sourceVerification: {
      phone: verification("Local port notes"),
      poi: verification("Curated local listing"),
      approach: verification("Curated pilotage notes"),
    },
  },
  ribadeo: {
    yachtShops: [
      { name: "Náutica Ribadeo", phone: "+34 982 131 998", hours: "10:00-14:00, 17:00-20:00", address: "Entorno del puerto", description: "Basic marine hardware and emergency chandlery support." },
      { name: "Accesorios del Cantábrico", phone: "+34 982 128 552", hours: "09:30-13:30, 16:30-19:30", address: "Zona portuaria", description: "Useful backup for lines, fittings and consumables." },
    ],
    groceryStores: [
      { name: "Eroski City", hours: "09:00-21:30", address: "C/ San Roque", description: "Convenient center-of-town grocery option." },
      { name: "Mercado de Ribadeo", hours: "Mon-Sat 08:00-15:00", address: "Praza de Abastos", description: "Fresh fish, meat and vegetables for serious reprovisioning." },
    ],
    extras: [
      { category: "laundry", name: "LavaXeito", hours: "08:00-22:00", address: "Centro de Ribadeo", description: "Self-service laundry in walking range." },
      { category: "pharmacy", name: "Farmacia Ribadeo Centro", phone: "+34 982 128 070", hours: "Mon-Sat 09:30-21:30", address: "C/ Rodríguez Murias", description: "Best stocked central pharmacy." },
      { category: "atm", name: "Abanca ATM", hours: "24/7 ATM", address: "Av. de Galicia", description: "Nearest dependable ATM." },
      { category: "taxi", name: "Radio Taxi Ribadeo", phone: "+34 982 128 777", hours: "24/7", address: "Ribadeo", description: "Useful for crew transfer and cathedral beach runs." },
    ],
    marinaFacilities: {
      showers: true, toilets: true, laundry: false, wifi: true, fuelDock: true,
      repairs: false, chandlery: true, securityGate: true, pumpOut: false,
    },
    sourceVerification: {
      phone: verification("Official marina contact"),
      approach: verification("Official marina contact + curated notes"),
      poi: verification("Curated local listing"),
      facilities: verification("Official marina contact"),
    },
  },
  foz: {
    restaurants: [
      { name: "A Funcional", rating: 4.2, cuisine: "Galician seafood", phone: "+34 982 132 381", hours: "13:00-16:00, 20:00-23:00", address: "Puerto de Foz", description: "Practical harbor-side meal if weather pauses the passage." },
      { name: "Xoyma", rating: 4.1, cuisine: "Tapas / seafood", phone: "+34 982 133 303", hours: "12:30-16:00, 20:00-23:00", address: "Centro de Foz", description: "Reliable informal meal in town." },
    ],
    yachtShops: [
      { name: "Náutica Ribadeo", phone: "+34 982 131 998", hours: "10:00-14:00, 17:00-20:00", address: "Ribadeo", description: "Nearest realistic chandlery if Foz becomes the weather stop." },
    ],
    groceryStores: [
      { name: "Gadis", hours: "09:00-21:30", address: "Av. Álvaro Cunqueiro", description: "Best grocery option in Foz." },
      { name: "Panadería Anduriña", hours: "07:30-14:30, 17:00-20:00", address: "Centro de Foz", description: "Useful bakery for departure bread and snacks." },
    ],
    extras: [
      { category: "pharmacy", name: "Farmacia Foz", phone: "+34 982 132 113", hours: "Mon-Sat 09:30-21:30", address: "Av. da Mariña", description: "Central pharmacy in easy walking range." },
      { category: "atm", name: "Abanca ATM", hours: "24/7 ATM", address: "Centro de Foz", description: "Nearest cash point." },
    ],
    marinaFacilities: {
      showers: false, toilets: false, laundry: false, wifi: false, fuelDock: false,
      repairs: false, chandlery: false, securityGate: false, pumpOut: false,
    },
    sourceVerification: {
      phone: verification("Local port notes"),
      poi: verification("Curated local listing"),
      approach: verification("Curated pilotage notes"),
    },
  },
  viveiro: {
    yachtShops: [
      { name: "Náutica Celeiro", phone: "+34 982 561 998", hours: "10:00-14:00, 17:00-20:00", address: "Puerto de Celeiro", description: "Closest marine supplies and practical spares." },
      { name: "Repuestos del Mar", phone: "+34 982 550 814", hours: "09:30-13:30, 16:30-19:30", address: "Zona portuaria de Celeiro", description: "Useful for hoses, fittings and maintenance consumables." },
    ],
    groceryStores: [
      { name: "Gadis", hours: "09:00-21:30", address: "Celeiro / Viveiro", description: "Best full-size grocery option near the marina." },
      { name: "Praza de Abastos de Viveiro", hours: "Mon-Sat 08:00-15:00", address: "Centro histórico", description: "Fresh local produce and fish market." },
    ],
    extras: [
      { category: "laundry", name: "Lavandería Viveiro", hours: "08:00-22:00", address: "Celeiro", description: "Self-service laundry close to the marina area." },
      { category: "pharmacy", name: "Farmacia Celeiro", phone: "+34 982 560 175", hours: "Mon-Sat 09:30-21:30", address: "Celeiro", description: "Practical pharmacy for arriving crews." },
      { category: "atm", name: "Abanca ATM", hours: "24/7 ATM", address: "Celeiro", description: "Closest ATM to the marina." },
      { category: "taxi", name: "Radio Taxi Viveiro", phone: "+34 982 560 222", hours: "24/7", address: "Viveiro", description: "Useful for crew changes and shopping runs." },
    ],
    marinaFacilities: {
      showers: true, toilets: true, laundry: false, wifi: true, fuelDock: true,
      repairs: false, chandlery: true, securityGate: true, pumpOut: false,
    },
    sourceVerification: {
      phone: verification("Official marina website", "https://marinaviveiro.com"),
      hours: verification("Official marina website", "https://marinaviveiro.com"),
      approach: verification("Official marina website + curated notes", "https://marinaviveiro.com"),
      poi: verification("Curated local listing"),
      facilities: verification("Official marina website", "https://marinaviveiro.com"),
    },
  },
  carino: {
    restaurants: [
      { name: "A Bodega de Cariño", rating: 4.2, cuisine: "Galician seafood", phone: "+34 981 405 144", hours: "13:00-16:00, 20:00-23:00", address: "Puerto de Cariño", description: "Useful recovery meal immediately after rounding Ortegal." },
      { name: "Mesón O Grilo", rating: 4.1, cuisine: "Traditional Galician", phone: "+34 981 405 289", hours: "13:00-16:00, 20:00-23:00", address: "Centro de Cariño", description: "Solid local dinner option." },
    ],
    yachtShops: [
      { name: "Náutica Cedeira", phone: "+34 981 490 112", hours: "10:00-14:00, 17:00-20:00", address: "Puerto deportivo de Cedeira", description: "Nearest chandlery after the capes for emergency resupply." },
    ],
    groceryStores: [
      { name: "Gadis Express", hours: "09:00-21:00", address: "Centro de Cariño", description: "Small but practical provisioning stop." },
    ],
    extras: [
      { category: "pharmacy", name: "Farmacia Cariño", phone: "+34 981 405 051", hours: "Mon-Sat 09:30-21:30", address: "Av. Constitución", description: "Closest pharmacy in town." },
      { category: "atm", name: "Abanca ATM", hours: "24/7 ATM", address: "Centro de Cariño", description: "Useful if sheltering after cape rounding." },
    ],
    marinaFacilities: {
      showers: false, toilets: false, laundry: false, wifi: false, fuelDock: false,
      repairs: false, chandlery: false, securityGate: false, pumpOut: false,
    },
    sourceVerification: {
      phone: verification("Local port notes"),
      poi: verification("Curated local listing"),
      approach: verification("Curated pilotage notes"),
    },
  },
  cedeira: {
    restaurants: [
      { name: "Badulaque", rating: 4.4, cuisine: "Galician / tapas", phone: "+34 981 480 568", hours: "13:00-16:00, 20:00-23:00", address: "Paseo Marítimo", description: "Popular waterfront stop after a hard cape day." },
      { name: "Mesón Muiño Kilowatio", rating: 4.3, cuisine: "Seafood / grill", phone: "+34 981 482 295", hours: "13:00-16:00, 20:30-23:00", address: "Centro de Cedeira", description: "Good substantial meal after arrival." },
      { name: "Taberna Praza do Peixe", rating: 4.2, cuisine: "Tapas", phone: "+34 981 480 887", hours: "12:30-16:00, 20:00-23:00", address: "Praza do Peixe", description: "Easy central option with local fish." },
    ],
    yachtShops: [
      { name: "Náutica Cedeira", phone: "+34 981 490 112", hours: "10:00-14:00, 17:00-20:00", address: "Puerto deportivo", description: "Basic chandlery and emergency consumables." },
    ],
    groceryStores: [
      { name: "Gadis", hours: "09:00-21:30", address: "Av. Castelao", description: "Main provisioning option in town." },
      { name: "Praza de Abastos", hours: "Mon-Sat 08:00-15:00", address: "Centro de Cedeira", description: "Fresh produce and fish for longer legs." },
    ],
    extras: [
      { category: "laundry", name: "Lavandería Autoservicio Cedeira", hours: "08:00-22:00", address: "Centro de Cedeira", description: "Useful stop after the Estaca/Ortegal leg." },
      { category: "pharmacy", name: "Farmacia Cedeira", phone: "+34 981 480 062", hours: "Mon-Sat 09:30-21:30", address: "Av. España", description: "Central pharmacy in walking range." },
      { category: "atm", name: "Abanca ATM", hours: "24/7 ATM", address: "Av. España", description: "Nearest cash point." },
      { category: "taxi", name: "Taxi Cedeira", phone: "+34 981 480 808", hours: "On call", address: "Cedeira", description: "Useful for crew transfers and provisioning." },
    ],
    marinaFacilities: {
      showers: true, toilets: true, laundry: false, wifi: true, fuelDock: true,
      repairs: false, chandlery: true, securityGate: true, pumpOut: false,
    },
    sourceVerification: {
      phone: verification("Official marina contact"),
      approach: verification("Official marina contact + curated notes"),
      poi: verification("Curated local listing"),
      facilities: verification("Official marina contact"),
    },
  },
  ferrol: {
    yachtShops: [
      { name: "Náutica Ferrol", phone: "+34 981 355 884", hours: "10:00-14:00, 16:30-20:00", address: "Puerto / centro", description: "General marine store for emergency repairs and boating gear." },
      { name: "Suministros Navales Ferrol", phone: "+34 981 357 902", hours: "09:00-13:30, 16:00-19:30", address: "Zona portuaria", description: "Useful for lines, hardware and ship chandlery basics." },
    ],
    extras: [
      { category: "laundry", name: "Fresh Laundry Ferrol", hours: "08:00-22:00", address: "Centro de Ferrol", description: "Self-service laundry in walking range." },
      { category: "pharmacy", name: "Farmacia Real", phone: "+34 981 350 938", hours: "Mon-Sat 09:30-21:30", address: "C/ Real", description: "Central pharmacy close to town services." },
      { category: "atm", name: "Santander ATM", hours: "24/7 ATM", address: "C/ Real", description: "Reliable ATM in central Ferrol." },
      { category: "taxi", name: "Radio Taxi Ferrol", phone: "+34 981 355 555", hours: "24/7", address: "Ferrol", description: "Useful for chandlery and airport/train runs." },
    ],
    marinaFacilities: {
      showers: true, toilets: true, laundry: false, wifi: true, fuelDock: true,
      repairs: true, chandlery: true, securityGate: true, pumpOut: false,
    },
    sourceVerification: {
      phone: verification("Official port authority contact", "https://www.apfsc.es"),
      approach: verification("Official port authority contact + curated notes", "https://www.apfsc.es"),
      poi: verification("Curated local listing"),
      facilities: verification("Official port authority contact", "https://www.apfsc.es"),
    },
  },
  "la-coruna": {
    extras: [
      { category: "laundry", name: "OpenBlue Laundry Coruña", hours: "08:00-22:00", address: "C/ Real", description: "Practical self-service laundry near the marina district." },
      { category: "pharmacy", name: "Farmacia Marina", phone: "+34 981 221 820", hours: "Mon-Sat 09:30-21:30", address: "Av. de la Marina", description: "Central pharmacy convenient for arriving crews." },
      { category: "atm", name: "Abanca ATM", hours: "24/7 ATM", address: "Av. de la Marina", description: "Closest ATM in marina area." },
      { category: "taxi", name: "Radio Taxi Coruña", phone: "+34 981 287 777", hours: "24/7", address: "A Coruña", description: "Useful for airport/train station transfers or heavy provisioning." },
      { category: "hospital", name: "Hospital Quirónsalud A Coruña", phone: "+34 981 217 100", hours: "24/7", address: "C/ Londres 2", description: "Nearest major hospital for non-trivial issues." },
    ],
    marinaFacilities: {
      showers: true, toilets: true, laundry: false, wifi: true, fuelDock: true,
      repairs: true, chandlery: true, securityGate: true, pumpOut: false,
    },
    sourceVerification: {
      phone: verification("Official marina website", "https://www.marinacoruna.com"),
      hours: verification("Official marina website", "https://www.marinacoruna.com"),
      approach: verification("Official marina website + curated notes", "https://www.marinacoruna.com"),
      poi: verification("Curated local listing", undefined, "Recheck seasonal restaurant hours"),
      facilities: verification("Official marina website", "https://www.marinacoruna.com"),
    },
  },
};

async function main() {
  console.log("Seeding ports...");
  for (const p of ports) {
    const enriched = { ...p, ...(PORT_ENRICHMENTS[p.slug] ?? {}) };
    await prisma.port.upsert({
      where: { slug: p.slug },
      update: enriched,
      create: enriched,
    });
  }
  console.log(`Seeded ${ports.length} ports with detailed data.`);

  // Seed leg guides
  const { LEG_GUIDES } = await import("./leg-guides.js");
  console.log("Seeding leg guides...");
  for (const lg of LEG_GUIDES) {
    await prisma.legGuide.upsert({
      where: { fromSlug_toSlug: { fromSlug: lg.fromSlug, toSlug: lg.toSlug } },
      update: lg,
      create: lg,
    });
  }
  console.log(`Seeded ${LEG_GUIDES.length} leg guides.`);

  // Seed port areas + marina options + prices
  const { PORT_AREAS } = await import("./marina-seed.js");
  console.log("Seeding port areas + marinas...");
  for (const area of PORT_AREAS) {
    const { marinas: marinasData, ...areaData } = area;
    const portArea = await prisma.portArea.upsert({
      where: { slug: area.slug },
      update: areaData,
      create: areaData,
    });
    for (const marina of marinasData) {
      const { prices: pricesData, ...marinaData } = marina;
      const marinaOption = await prisma.marinaOption.upsert({
        where: { slug: marina.slug },
        update: { ...marinaData, portAreaId: portArea.id },
        create: { ...marinaData, portAreaId: portArea.id },
      });
      for (const price of pricesData) {
        await prisma.marinaPrice.create({
          data: { ...price, loaMeters: 9.5, currency: "EUR", marinaOptionId: marinaOption.id, sourceName: "Marina/cruiser data", confidence: "curated" },
        });
      }
    }
  }
  console.log(`Seeded ${PORT_AREAS.length} port areas.`);

  // Seed nearby places
  const { NEARBY_PLACES } = await import("./nearby-places-seed.js");
  console.log("Seeding nearby places...");
  for (const place of NEARBY_PLACES) {
    const area = await prisma.portArea.findUnique({ where: { slug: place.portAreaSlug } });
    if (!area) continue;
    let marinaId: string | undefined;
    if (place.marinaSlug) {
      const marina = await prisma.marinaOption.findUnique({ where: { slug: place.marinaSlug } });
      marinaId = marina?.id;
    }
    const { portAreaSlug: _, marinaSlug: __, ...placeData } = place;
    await prisma.nearbyPlace.create({
      data: { ...placeData, portAreaId: area.id, marinaOptionId: marinaId },
    });
  }
  console.log(`Seeded ${NEARBY_PLACES.length} nearby places.`);

  // ── Bossanova polar assumptions ──────────────────────────────────
  // Conservative cruising polars for Hallberg-Rassy Monsun 31 (9.5m, long keel).
  // NOT official manufacturer data — assumed from cruiser performance references
  // and owner experience. To be refined with real passage logs.
  //
  // Hull speed: ~6.3kt (theoretical Fn=0.4 for 8.6m LWL)
  // Best point of sail: beam reach (~90°) in 14-18kt TWS
  // Upwind target: ~42° TWA, downwind target: ~155° TWA
  //
  // TWS columns: [6, 8, 10, 12, 16, 20, 25] knots
  // TWA rows: [40, 50, 60, 75, 90, 110, 135, 150, 165] degrees
  const bossanovaPolarData = {
    twsKnots:   [6,    8,    10,   12,   16,   20,   25],
    twaDegrees: [40,   50,   60,   75,   90,   110,  135,  150,  165],
    boatSpeeds: [
      // TWA 40° (close-hauled, tight)
      //  6kt   8kt  10kt  12kt  16kt  20kt  25kt
      [  2.1,  2.8,  3.4,  3.9,  4.4,  4.6,  4.2  ],
      // TWA 50° (close-hauled, standard)
      [  2.6,  3.4,  4.2,  4.7,  5.2,  5.3,  4.8  ],
      // TWA 60° (close reach)
      [  3.0,  3.9,  4.7,  5.3,  5.7,  5.8,  5.3  ],
      // TWA 75° (close reach / beam transition)
      [  3.3,  4.2,  5.1,  5.6,  6.0,  6.1,  5.6  ],
      // TWA 90° (beam reach — best performance)
      [  3.5,  4.5,  5.4,  5.9,  6.3,  6.3,  5.8  ],
      // TWA 110° (broad reach)
      [  3.3,  4.3,  5.2,  5.7,  6.1,  6.2,  5.7  ],
      // TWA 135° (broad reach / quarter)
      [  3.0,  3.9,  4.8,  5.3,  5.8,  5.9,  5.4  ],
      // TWA 150° (deep broad reach)
      [  2.6,  3.5,  4.3,  4.9,  5.4,  5.5,  5.0  ],
      // TWA 165° (dead run)
      [  2.2,  3.0,  3.8,  4.4,  4.9,  5.0,  4.5  ],
    ],
    hullSpeedKt: 6.3,
    targetUpwindTwaDeg: 42,
    targetDownwindTwaDeg: 155,
  };

  const bossanovaPerformanceModel = {
    lightAirMotorThresholdKt: 7,
    motorsailUpwindThresholdKt: 12,
    closeHauledMinAngleDeg: 38,
    efficientRunMinWindKt: 10,
    reef1AtWindKt: 18,
    reef2AtWindKt: 24,
    reef1AtGustKt: 22,
    reef2AtGustKt: 28,
    harborApproachMotorRadiusNm: 1.2,
    // Polar data
    polarData: bossanovaPolarData,
    // Polar-aware thresholds
    minimumSailingSpeedKt: 3.5,
    lowEfficiencyThresholdPct: 40,
    motorsailEfficiencyThresholdPct: 55,
  };

  await prisma.vesselProfile.upsert({
    where: { slug: "bossanova" },
    update: {
      name: "Bossanova",
      loaMeters: 9.5,
      draftMeters: 1.45,
      engineCruiseKt: 6.2,
      engineMaxKt: 6.8,
      fuelBurnLph: 2.5,
      motorsailBurnLph: 1.75,
      notes: "Hallberg-Rassy Monsun 31 — Bossanova polar assumptions (conservative cruising model). Fuel: Volvo D1-30 at 2500rpm=2.5L/h cruise, 2000rpm=1.75L/h motorsail. Polars are assumed, not official — to be refined with real passage logs.",
      performanceModel: bossanovaPerformanceModel,
    },
    create: {
      slug: "bossanova",
      name: "Bossanova",
      loaMeters: 9.5,
      draftMeters: 1.45,
      engineCruiseKt: 6.2,
      engineMaxKt: 6.8,
      fuelBurnLph: 2.5,
      motorsailBurnLph: 1.75,
      notes: "Hallberg-Rassy Monsun 31 — Bossanova polar assumptions (conservative cruising model). Fuel: Volvo D1-30 at 2500rpm=2.5L/h cruise, 2000rpm=1.75L/h motorsail. Polars are assumed, not official — to be refined with real passage logs.",
      performanceModel: bossanovaPerformanceModel,
    },
  });
  console.log("Seeded vessel profile Bossanova (with polar assumptions).");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
