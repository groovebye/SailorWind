/**
 * Curated leg guide data for Gijón → La Coruña passage.
 * Each entry is keyed by fromSlug__toSlug.
 */

export const LEG_GUIDES = [
  {
    fromSlug: "gijon", toSlug: "luarca",
    difficulty: "moderate",
    description: "45 NM passage along the Asturian coast. The key challenge is rounding Cabo Peñas, the northernmost point of Asturias, where wind accelerates significantly in W/NW conditions. After the cape, the coast offers steady westward progress with several bail-out ports.",
    bestWindow: "Depart early morning 07:00-09:00 to round Cabo Peñas before afternoon thermal winds build. If W/NW >15kt forecast, consider delaying or taking the inshore route via Luanco.",
    tidalNotes: "Tidal range ~3.5m at springs. Tidal streams are weak along this coast (<0.5kt) except around Cabo Peñas where they can reach 1kt on springs. Enter Luarca at any state of tide — deep entrance.",
    tidalGate: "No strict tidal gate. Cabo Peñas is best rounded within 2h of slack water.",
    currentNotes: "East-going flood, west-going ebb along the coast. Streams negligible except at Cabo Peñas.",
    nightNotes: "Arrival in Luarca before dark is strongly recommended. The entrance is well-lit (Fl.G/Fl.R) but narrow.",
    pilotageText: `## Departure from Gijón
Exit Puerto Deportivo heading NE through the breakwater gap. Turn NW once clear of the outer mole. The commercial port entrance is to the east — stay clear of cargo traffic.

## Cabo Peñas (NM 15)
The cape is the most exposed section of this leg. Wind typically accelerates 5-10kt around the headland. Keep at least 1NM offshore. The lighthouse (Fl(3)15s, 117m) is an excellent visual reference.

**CRITICAL**: In W/NW winds >20kt, seas steepen significantly on the east side due to wind-against-tide. Consider the alternative route via Luanco (inshore, east of cape).

## Avilés (NM 25)
Ría entrance is straightforward — follow the buoyed channel. Good bail-out option with full services. River current can run 1-2kt on ebb.

## Cudillero (NM 35)
Small fishing harbor. **Do NOT enter in NW swell >1.5m** — the entrance is exposed and dangerous. Only a bail-out in calm conditions.

## Arrival Luarca (NM 45)
Approach from N. The breakwaters are clearly visible. Enter between the heads (Fl.G and Fl.R lights). Visitor berths on the first pontoon to port. Report to the marina office.`,
    milestones: JSON.stringify([
      { name: "Clear Gijón breakwater", eta_offset_hours: 0.2, lat: 43.550, lon: -5.660, bearing: "315°", visual_ref: "Torre del Reloj behind, Cabo Torres to starboard", type: "clear_breakwater" },
      { name: "Settle on westbound track", eta_offset_hours: 0.7, lat: 43.565, lon: -5.705, bearing: "285°", visual_ref: "Breakwaters opening astern, steady offshore lane ahead", type: "course_change" },
      { name: "Abeam Candás", eta_offset_hours: 1.5, lat: 43.590, lon: -5.762, bearing: "280°", visual_ref: "Candás church spire visible to port", type: "course_change" },
      { name: "Luanco / Peñas east check", eta_offset_hours: 2.3, lat: 43.620, lon: -5.750, bearing: "265°", visual_ref: "Luanco low coastline ahead, cape cliffs developing to port", type: "course_change", notes: "Last easy moment to reassess before rounding." },
      { name: "Round Cabo Peñas", eta_offset_hours: 3.0, lat: 43.675, lon: -5.850, bearing: "250°", visual_ref: "Lighthouse Fl(3)15s clearly visible. Keep 1NM off.", type: "round_cape", notes: "Wind acceleration zone. Monitor closely." },
      { name: "Abeam Avilés entrance", eta_offset_hours: 5.0, lat: 43.605, lon: -5.930, bearing: "260°", visual_ref: "Avilés breakwater and ría entrance visible to port", type: "course_change", notes: "Bail-out option. VHF 12 for port control." },
      { name: "Pass Cudillero", eta_offset_hours: 7.0, lat: 43.575, lon: -6.150, bearing: "265°", visual_ref: "Colorful houses visible in the cove to port", type: "course_change" },
      { name: "Luarca outer alignment", eta_offset_hours: 8.2, lat: 43.555, lon: -6.520, bearing: "200°", visual_ref: "Cemetery chapel prominent on the headland, breakwater gap opening ahead", type: "approach" },
      { name: "Approach Luarca", eta_offset_hours: 8.5, lat: 43.555, lon: -6.530, bearing: "180°", visual_ref: "Cemetery chapel on the cliff, breakwater heads", type: "approach" },
      { name: "Berth Luarca marina", eta_offset_hours: 9.0, lat: 43.542, lon: -6.533, bearing: null, visual_ref: "First pontoon to port after entrance", type: "berth" },
    ]),
    hazards: JSON.stringify([
      { name: "Cabo Peñas wind acceleration", lat: 43.655, lon: -5.849, type: "wind_acceleration", severity: "high", description: "Wind accelerates 5-15kt around the headland. Worst in W/NW. Seas steepen on the east side with wind against tide." },
      { name: "Bajo de la Osa (rock)", lat: 43.600, lon: -5.880, type: "rock", severity: "medium", description: "Submerged rock 0.5NM NW of Luanco. Depth 2m. Keep N of this when rounding Peñas from the west." },
      { name: "Cudillero entrance shoaling", lat: 43.564, lon: -6.148, type: "shoal", severity: "medium", description: "Harbor entrance exposed to NW swell. Dangerous in swell >1.5m. Breaking waves at entrance." },
    ]),
    fallbackPorts: JSON.stringify([
      { name: "Candás", slug: "candas", distance_nm: 8, time_hours: 1.6, conditions: "Shelter from S/SW. Exposed to N/NE." },
      { name: "Luanco", slug: "luanco", distance_nm: 18, time_hours: 3.6, conditions: "Good shelter behind Cabo Peñas. Small port." },
      { name: "Avilés", slug: "aviles", distance_nm: 25, time_hours: 5.0, conditions: "Excellent all-weather shelter in the ría. Full services." },
      { name: "Cudillero", slug: "cudillero", distance_nm: 35, time_hours: 7.0, conditions: "Only in calm conditions. Exposed to NW swell." },
    ]),
  },

  {
    fromSlug: "luarca", toSlug: "ribadeo",
    difficulty: "easy",
    description: "35 NM straightforward coastal passage. No major headlands. The coast runs roughly E-W with gentle indentations. Navia offers a mid-leg bail-out.",
    bestWindow: "Flexible — no critical timing. Morning departure recommended for daylight arrival.",
    tidalNotes: "Tidal range ~3.5m. Ribadeo ría has significant tidal flow — enter within 2h of HW for easiest approach. Low water can reduce depth in the upper ría.",
    tidalGate: "Ribadeo ría entrance: best HW-2 to HW+1. Avoid entering at LW springs — shallow patches.",
    currentNotes: "Tidal streams weak (<0.5kt) along the open coast. Inside Ribadeo ría, ebb can run 1-2kt.",
    nightNotes: "Night arrival possible — Ribadeo entrance is well-lit. But ría navigation in darkness is not recommended for first visit.",
    pilotageText: `## Departure from Luarca
Exit between breakwaters heading N, then turn W. Simple departure.

## Coastal passage
Straightforward westward track ~1-2NM offshore. Coast is mostly cliffy with few dangers. Keep clear of offshore rocks near Navia river entrance.

## Navia (NM 15)
River port — limited depth at LW. Only enter on rising tide if needed as bail-out.

## Arrival Ribadeo (NM 35)
The ría entrance opens between Illa Pancha (lighthouse) and Punta de la Cruz. Follow the buoyed channel SW into the ría. Marina is on the S side of the inner basin. Best entry on rising tide.`,
    milestones: JSON.stringify([
      { name: "Clear Luarca", eta_offset_hours: 0.3, lat: 43.555, lon: -6.533, bearing: "270°", visual_ref: "Luarca lighthouse behind", type: "clear_breakwater" },
      { name: "Open coast settled track", eta_offset_hours: 1.0, lat: 43.560, lon: -6.610, bearing: "270°", visual_ref: "Continuous cliff coast to port, no major off-lying dangers", type: "course_change" },
      { name: "Abeam Navia", eta_offset_hours: 3.0, lat: 43.565, lon: -6.730, bearing: "270°", visual_ref: "Navia river mouth visible to port", type: "course_change", notes: "Bail-out option if needed" },
      { name: "Illa Pancha sighting", eta_offset_hours: 5.8, lat: 43.560, lon: -6.960, bearing: "255°", visual_ref: "Distinct lighthouse on Illa Pancha appears ahead on the Ribadeo side", type: "approach" },
      { name: "Approach Ribadeo ría", eta_offset_hours: 6.5, lat: 43.560, lon: -7.040, bearing: "210°", visual_ref: "Illa Pancha lighthouse (distinctive). Ría opens to SW.", type: "approach" },
      { name: "Berth Ribadeo", eta_offset_hours: 7.0, lat: 43.535, lon: -7.042, bearing: null, visual_ref: "Marina pontoons on S side of inner basin", type: "berth" },
    ]),
    hazards: JSON.stringify([
      { name: "Navia bar", lat: 43.555, lon: -6.728, type: "shoal", severity: "low", description: "River bar — breaks in heavy swell. Avoid entry in NW swell >2m." },
    ]),
    fallbackPorts: JSON.stringify([
      { name: "Navia", slug: "navia", distance_nm: 15, time_hours: 3.0, conditions: "River port. Enter on rising tide only. Limited depth at LW." },
    ]),
  },

  {
    fromSlug: "ribadeo", toSlug: "viveiro",
    difficulty: "moderate",
    description: "30 NM passage entering Galicia. The coast becomes more rugged with deeper rías. Foz is the only intermediate port. The approach to Viveiro involves entering the large Ría de Viveiro — well-sheltered once inside.",
    bestWindow: "Morning departure. Allow time to reach Viveiro before dark — the ría entrance can be confusing in poor visibility.",
    tidalNotes: "Tidal range ~3m. Viveiro ría has moderate tidal flow. Enter at any state of tide — deep entrance.",
    currentNotes: "Weak coastal streams. Inside Viveiro ría, ebb current 0.5-1kt.",
    nightNotes: "Night entry to Viveiro ría is possible but not recommended for first visit. The ría is wide and deep but identifying the marina in darkness requires local knowledge.",
    pilotageText: `## Departure from Ribadeo
Exit the ría heading NE. Watch for tidal current at the entrance — can run 1-2kt on springs.

## Foz (NM 12)
Small port. Available as bail-out in moderate conditions.

## Viveiro approach (NM 30)
The Ría de Viveiro opens wide to the N. Enter between Punta del Faro (E) and Punta de San Martín (W). The ría is deep and wide — no dangers. Marina Viveiro (Celeiro) is on the E side, well-marked.`,
    milestones: JSON.stringify([
      { name: "Clear Ribadeo ría", eta_offset_hours: 0.5, lat: 43.565, lon: -7.040, bearing: "350°", visual_ref: "Illa Pancha lighthouse abeam", type: "clear_breakwater" },
      { name: "Abeam Foz", eta_offset_hours: 2.5, lat: 43.580, lon: -7.255, bearing: "290°", visual_ref: "Foz harbor visible to port", type: "course_change" },
      { name: "Punta Roncadoira bearing check", eta_offset_hours: 4.0, lat: 43.620, lon: -7.390, bearing: "300°", visual_ref: "Cliffy point ahead, useful waypoint before turning for Viveiro", type: "course_change" },
      { name: "Enter Ría de Viveiro", eta_offset_hours: 5.5, lat: 43.705, lon: -7.560, bearing: "200°", visual_ref: "Wide ría opening. Punta del Faro to port.", type: "approach" },
      { name: "Celeiro fishing harbor alignment", eta_offset_hours: 5.8, lat: 43.680, lon: -7.585, bearing: "165°", visual_ref: "Fishing harbor infrastructure and breakwater become clear on the east side", type: "approach" },
      { name: "Berth Marina Viveiro", eta_offset_hours: 6.0, lat: 43.662, lon: -7.595, bearing: null, visual_ref: "Celeiro fishing port. Marina on E side.", type: "berth" },
    ]),
    hazards: JSON.stringify([]),
    fallbackPorts: JSON.stringify([
      { name: "Foz", slug: "foz", distance_nm: 12, time_hours: 2.4, conditions: "Small port. Moderate shelter. Enter in calm conditions." },
    ]),
  },

  {
    fromSlug: "viveiro", toSlug: "cedeira",
    difficulty: "challenging",
    description: "30 NM — the most challenging section of the entire passage. Two major capes to round: Estaca de Bares (northernmost point of Spain) and Cabo Ortegal. Both are wind acceleration zones with potential 15-20kt increase over prevailing conditions. This leg should only be attempted in settled weather.",
    bestWindow: "EARLY morning departure 05:00-07:00 essential. Round Estaca de Bares before 10:00 when thermal winds build. Postpone if W/NW wind forecast >15kt at the capes.",
    tidalNotes: "Tidal streams around both capes can reach 2kt on springs. Round with the tide — check tidal atlas.",
    tidalGate: "Round Estaca de Bares with E-going stream (HW Dover -3 to HW Dover). This gives a fair tide and calmer seas.",
    currentNotes: "STRONG tidal streams at both capes, up to 2kt. Wind against tide creates dangerous steep seas. NEVER round these capes with wind against tide.",
    nightNotes: "DO NOT attempt this leg at night. Both capes are hazardous even in daylight.",
    pilotageText: `## Departure from Viveiro
Exit Ría de Viveiro heading N. **Depart at dawn or before.** Every hour counts for reaching the capes in calm conditions.

## Estaca de Bares (NM 10)
**DANGER — Most exposed point on the route.**
- Northernmost point of Iberian Peninsula
- Wind accelerates 10-20kt
- Tidal streams up to 2kt
- Keep at least 2NM offshore
- Lighthouse: Fl(2)7.5s, 101m, 25M — unmistakable
- In moderate conditions, the cape can be rounded 1NM off
- In strong W/NW, stay 3NM+ off or ABORT back to Viveiro

## Cabo Ortegal (NM 20)
**DANGER — Second major cape, equally hazardous.**
- Dramatic cliffs
- Strong currents
- Wind acceleration
- Lighthouse: Fl(1+3)16s
- Keep 2NM offshore minimum
- Cariño (just S of the cape) is an emergency shelter

## Cedeira approach (NM 30)
After rounding both capes, the coast turns S. The Ría de Cedeira opens to the NW. Enter between the headlands — deep and well-sheltered once inside. Marina is at the head of the ría.`,
    milestones: JSON.stringify([
      { name: "Exit Ría de Viveiro", eta_offset_hours: 0.5, lat: 43.705, lon: -7.560, bearing: "350°", visual_ref: "Ría mouth", type: "clear_breakwater" },
      { name: "Commit point before Estaca", eta_offset_hours: 1.2, lat: 43.760, lon: -7.610, bearing: "315°", visual_ref: "Open sea on the bow, Estaca lighthouse still low ahead", type: "course_change", notes: "Turn back to Viveiro here if sea state already steepens." },
      { name: "Round Estaca de Bares", eta_offset_hours: 2.0, lat: 43.825, lon: -7.685, bearing: "280°", visual_ref: "Lighthouse Fl(2)7.5s on the cliff. Keep 2NM off.", type: "round_cape", notes: "MAXIMUM DANGER POINT. Monitor wind and sea state continuously." },
      { name: "Sea-state reassessment west of Estaca", eta_offset_hours: 2.7, lat: 43.815, lon: -7.760, bearing: "245°", visual_ref: "Estaca now astern, open water before Ortegal", type: "course_change", notes: "If confused sea persists, consider slowing and preparing for Cariño escape." },
      { name: "Round Cabo Ortegal", eta_offset_hours: 4.0, lat: 43.810, lon: -7.880, bearing: "220°", visual_ref: "Dramatic cliffs. Lighthouse Fl(1+3)16s.", type: "round_cape", notes: "Second danger point. Consider Cariño as bail-out." },
      { name: "Abeam Cariño", eta_offset_hours: 4.5, lat: 43.755, lon: -7.867, bearing: "230°", visual_ref: "Cariño harbor visible in the ría", type: "course_change", notes: "Last bail-out before Cedeira" },
      { name: "Cedeira outer turn-in", eta_offset_hours: 5.2, lat: 43.705, lon: -8.000, bearing: "190°", visual_ref: "Lower coast and broad ría opening ahead", type: "approach" },
      { name: "Enter Ría de Cedeira", eta_offset_hours: 5.5, lat: 43.730, lon: -8.055, bearing: "180°", visual_ref: "Ría opens between green headlands", type: "approach" },
      { name: "Berth Cedeira", eta_offset_hours: 6.0, lat: 43.660, lon: -8.057, bearing: null, visual_ref: "Marina at head of ría", type: "berth" },
    ]),
    hazards: JSON.stringify([
      { name: "Estaca de Bares wind acceleration", lat: 43.788, lon: -7.685, type: "wind_acceleration", severity: "critical", description: "Northernmost point of Spain. Wind accelerates 10-20kt. Tidal streams 2kt. Wind against tide creates breaking seas. LIFE-THREATENING in strong W/NW." },
      { name: "Cabo Ortegal currents", lat: 43.770, lon: -7.870, type: "current", severity: "critical", description: "Strong tidal streams around the cape. Combined with wind acceleration, creates extremely confused seas in opposing conditions." },
      { name: "Orca interaction zone", lat: 43.750, lon: -7.800, type: "orca", severity: "medium", description: "Galician coast — moderate orca interaction risk. Monitor GT Orcas app. Keep engine in neutral if approached. Do NOT attempt to flee." },
    ]),
    fallbackPorts: JSON.stringify([
      { name: "Viveiro (return)", slug: "viveiro", distance_nm: 10, time_hours: 2.0, conditions: "Best option if Estaca conditions deteriorate. Deep shelter." },
      { name: "Cariño", slug: "carino", distance_nm: 23, time_hours: 4.6, conditions: "After rounding Ortegal. Good shelter in Ría de Ortigueira." },
    ]),
  },

  {
    fromSlug: "cedeira", toSlug: "la-coruna",
    difficulty: "moderate",
    description: "20 NM passage heading south along the Galician coast. Includes passage through or past the Ría de Ferrol (major naval port). The approach to La Coruña is straightforward — Torre de Hércules (UNESCO lighthouse) is an unmistakable landmark.",
    bestWindow: "Morning departure. Allow time for Ferrol ría crossing and La Coruña approach in daylight.",
    tidalNotes: "Tidal range ~3.5m. La Coruña harbor has moderate tidal flow. Enter at any state of tide.",
    currentNotes: "Tidal streams moderate along this coast, <1kt. Stronger at Ferrol ría entrance.",
    nightNotes: "Night approach to La Coruña is feasible — Torre de Hércules is lit and the harbor is well-marked. But commercial traffic requires vigilance.",
    pilotageText: `## Departure from Cedeira
Exit Ría de Cedeira heading NW. Turn S once clear of the headlands.

## Ferrol (NM 10)
The Ría de Ferrol has a narrow entrance between two castles (San Felipe and La Palma). This is a major naval base — expect military traffic. Contact port control VHF 12 if entering.

If not stopping: pass the ría entrance heading S, keeping 1NM offshore.

## La Coruña approach (NM 20)
**Torre de Hércules** — the Roman lighthouse (UNESCO World Heritage) is unmistakable. It marks the NW corner of the city.

Approach from N or NW. Contact Port Control VHF 12 before entering. The outer harbor is large — follow the channel to the inner basin. Marina Coruña is on the S side of the inner harbor.

**WATCH FOR**: Commercial traffic, fishing boats, and the local ferry.`,
    milestones: JSON.stringify([
      { name: "Clear Cedeira ría", eta_offset_hours: 0.3, lat: 43.730, lon: -8.055, bearing: "340°", visual_ref: "Ría mouth, headlands abeam", type: "clear_breakwater" },
      { name: "Southbound coastal lane", eta_offset_hours: 0.9, lat: 43.685, lon: -8.080, bearing: "205°", visual_ref: "Open coast to port with Ferrol sector ahead", type: "course_change" },
      { name: "Abeam Ferrol entrance", eta_offset_hours: 2.0, lat: 43.640, lon: -8.215, bearing: "200°", visual_ref: "Castle San Felipe to port, Castle La Palma to starboard", type: "course_change", notes: "VHF 12 if entering. Watch for naval traffic." },
      { name: "Offshore of Punta Prior", eta_offset_hours: 2.8, lat: 43.520, lon: -8.285, bearing: "190°", visual_ref: "Prominent cliff and headland before the Coruña sector", type: "course_change" },
      { name: "Torre de Hércules abeam", eta_offset_hours: 3.5, lat: 43.385, lon: -8.405, bearing: "160°", visual_ref: "UNESCO Roman lighthouse — tallest ancient lighthouse still in use", type: "approach" },
      { name: "Berth Marina Coruña", eta_offset_hours: 4.0, lat: 43.370, lon: -8.400, bearing: null, visual_ref: "Inner harbor basin. Pontoons A-H. Report on VHF 12.", type: "berth" },
    ]),
    hazards: JSON.stringify([
      { name: "Ferrol naval traffic", lat: 43.490, lon: -8.233, type: "traffic", severity: "medium", description: "Major naval base. Military vessels have priority. Contact VHF 12." },
      { name: "La Coruña commercial traffic", lat: 43.370, lon: -8.390, type: "traffic", severity: "medium", description: "Large commercial port. Cargo ships, tankers, and ferries. Stay clear of main shipping channel." },
    ]),
    fallbackPorts: JSON.stringify([
      { name: "Ferrol", slug: "ferrol", distance_nm: 10, time_hours: 2.0, conditions: "Excellent all-weather shelter. Full services. Naval port — VHF 12." },
    ]),
  },
];
