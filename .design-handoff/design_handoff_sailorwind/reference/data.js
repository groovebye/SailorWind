/* ============================================================
   SailorWind — data layer (plain JS, attaches to window.SW)
   Sourced from the SailorWind passage planner exports.
   ============================================================ */
(function () {
  // ---- Ports & marinas (NW Spain → Portugal → Gibraltar) ----
  // [id, name, distNm, region, berths, eurPerDay|null, [facilities], orca|null, stars]
  const F = { f: "fuel", r: "repair" };
  const raw = [
    [1,"Gijón",5,"Asturias",728,28,["f","r"],null,3],
    [2,"Candás",2,"Asturias",50,null,[],null,0],
    [3,"Luanco",6,"Asturias",40,null,[],null,0],
    [4,"Avilés",10,"Asturias",200,22,["f"],null,0],
    [5,"Cudillero",17,"Asturias",30,null,[],null,0],
    [6,"Luarca",9,"Asturias",100,18,["f"],null,1],
    [7,"Navia",14,"Asturias",40,null,[],null,0],
    [8,"Ribadeo",10,"Galicia",150,20,["f"],"medium",0],
    [9,"Foz",7,"Galicia",30,null,[],"medium",0],
    [10,"Burela",10,"Galicia",60,null,["f"],"medium",0],
    [11,"Viveiro",13,"Galicia",235,22,["f"],"medium",1],
    [12,"Cariño",9,"Galicia",50,null,[],"medium",0],
    [13,"Cedeira",13,"Galicia",100,18,["f"],"medium",0],
    [14,"Ferrol",8,"Galicia",300,25,["f","r"],"medium",1],
    [15,"Sada",6,"Galicia",200,20,["f"],"medium",1],
    [16,"La Coruña",37,"Galicia",1053,25,["f","r"],"medium",3],
    [17,"Camariñas",2,"Costa da Morte",143,null,["f","r"],"medium",0],
    [18,"Muxía",12,"Costa da Morte",232,null,["f"],"medium",0],
    [19,"Fisterra",4,"Costa da Morte",30,null,["f"],"high",0],
    [20,"Corcubión",11,"Costa da Morte",0,null,[],"medium",0],
    [21,"Muros",5,"Ría de Muros e Noia",210,null,["f","r"],null,0],
    [22,"Portosín",12,"Ría de Muros e Noia",262,null,["f","r"],null,0],
    [23,"Ribeira",3,"Ría de Arousa",263,null,["f","r"],null,0],
    [24,"Aguiño",6,"Ría de Arousa",0,null,["f","r"],"medium",0],
    [25,"A Pobra do Caramiñal",7,"Ría de Arousa",298,null,[],null,0],
    [26,"Vilagarcía de Arousa",3,"Ría de Arousa",495,null,["f","r"],null,0],
    [27,"Vilanova de Arousa",3,"Ría de Arousa",248,null,["f","r"],null,0],
    [28,"Cambados",6,"Ría de Arousa",0,null,[],null,0],
    [29,"O Grove",6,"Ría de Arousa",148,null,["f","r"],null,0],
    [30,"Sanxenxo / Portonovo",5,"Ría de Pontevedra",676,null,["f","r"],null,0],
    [31,"Illa de Ons",10,"P.N. Illas Atlánticas",0,null,[],"medium",0],
    [32,"Combarro",3,"Ría de Pontevedra",334,null,["f","r"],null,0],
    [33,"Pontevedra",3,"Ría de Pontevedra",142,null,[],null,0],
    [34,"Marín",5,"Ría de Pontevedra",0,null,["f","r"],null,0],
    [35,"Bueu",1,"Ría de Pontevedra",100,null,["f","r"],null,0],
    [36,"Ría de Aldán",4,"Ría de Aldán",0,null,[],null,0],
    [37,"Cangas",3,"Ría de Vigo",293,null,["f","r"],null,0],
    [38,"Moaña Mar",0.5,"Ría de Vigo",0,null,["f"],null,0],
    [39,"Ensenada de Barra",7,"Ría de Vigo",0,null,[],null,0],
    [40,"Islas Cíes",8,"P.N. Illas Atlánticas",0,null,[],"high",0],
    [41,"Vigo",9,"Ría de Vigo",1298,null,["f","r"],null,0],
    [42,"Baiona",13,"Baiona",484,null,["f","r"],"high",0],
    [43,"A Guarda",3,"O Baixo Miño",0,null,["r"],"high",0],
    [44,"Caminha",13,"Portugal · Norte",12,null,[],"medium",0],
    [45,"Viana do Castelo",20,"Portugal · Norte",307,null,["f","r"],"medium",0],
    [46,"Póvoa de Varzim",12,"Portugal · Norte",241,null,["f","r"],"medium",0],
    [47,"Leixões",3,"Portugal · Porto",248,null,["f","r"],"medium",0],
    [48,"Vila Nova de Gaia",31,"Portugal · Porto",300,null,["f","r"],"medium",0],
    [49,"Aveiro",29,"Portugal · Centro",0,null,["f","r"],"medium",0],
    [50,"Figueira da Foz",35,"Portugal · Centro",350,null,[],"medium",0],
    [51,"Nazaré",20,"Portugal · Centro",52,null,["f"],"medium",0],
    [52,"Peniche",7,"Portugal · Centro",140,null,["f","r"],"medium",0],
    [53,"Berlengas",43,"Biosphere Reserve",0,null,[],"medium",0],
    [54,"Cascais",5,"Portugal · Lisboa",650,null,["f","r"],"medium",0],
    [55,"Oeiras",5,"Portugal · Lisboa",284,null,["f","r"],null,0],
    [56,"Lisboa (Tejo)",6,"Portugal · Lisboa",1386,null,["f","r"],null,0],
    [57,"Seixal Bay",12,"Portugal · Setúbal",0,null,[],null,0],
    [58,"Sesimbra",10,"Portugal · Setúbal",207,null,[],null,0],
    [59,"Setúbal",33,"Portugal · Setúbal",320,null,["r"],null,0],
    [60,"Sines",57,"Portugal · Alentejo",230,null,["f","r"],"medium",0],
    [61,"Enseada de Sagres",0.5,"Portugal · Algarve",0,null,[],"high",0],
    [62,"Sagres (Baleeira)",13,"Portugal · Algarve",0,null,[],"high",0],
    [63,"Lagos",3,"Portugal · Algarve",474,null,["f","r"],"medium",0],
    [64,"Alvor",4,"Portugal · Algarve",0,null,[],null,0],
    [65,"Portimão",13,"Portugal · Algarve",620,null,["f","r"],null,0],
    [66,"Albufeira",6,"Portugal · Algarve",475,null,["f","r"],null,0],
    [67,"Vilamoura",13,"Portugal · Algarve",825,null,["f","r"],null,0],
    [68,"Ria Formosa",1,"Portugal · Algarve",0,null,[],null,0],
    [69,"Ilha da Culatra",4,"Portugal · Algarve",0,null,[],null,0],
    [70,"Faro",4,"Portugal · Algarve",0,null,["r"],null,0],
    [71,"Olhão",12,"Portugal · Algarve",250,null,["f","r"],null,0],
    [72,"Tavira",11,"Portugal · Algarve",0,null,[],null,0],
    [73,"Vila Real de Santo António",0.5,"Portugal · Algarve",360,null,["f","r"],null,0],
    [74,"Ayamonte",4,"Spain · Huelva",316,null,["f","r"],"medium",0],
    [75,"Isla Canela",0.5,"Spain · Huelva",231,null,[],"medium",0],
    [76,"Isla Cristina",10,"Spain · Huelva",204,null,["f","r"],"medium",0],
    [77,"El Rompido",8,"Spain · Huelva",331,null,["f"],"medium",0],
    [78,"Punta Umbría",7,"Spain · Huelva",998,null,["f","r"],"medium",0],
    [79,"Mazagón",30,"Spain · Huelva",500,null,["f","r"],"medium",0],
    [80,"Chipiona",9,"Spain · Cádiz",453,null,["f","r"],"medium",0],
    [81,"Rota",5,"Spain · Cádiz",508,null,["f","r"],"high",0],
    [82,"El Puerto de Santa María",3,"Spain · Cádiz",1017,null,["f","r"],"high",0],
    [83,"Cádiz",11,"Spain · Cádiz",482,null,["f","r"],"high",0],
    [84,"Sancti Petri",18,"Spain · Cádiz",200,null,["f","r"],"high",0],
    [85,"Barbate",19,"Spain · Cádiz",314,null,["f","r"],"high",0],
    [86,"Tarifa",15,"Spain · Cádiz",118,null,[],"high",0],
    [87,"La Línea",1,"Spain · Cádiz",624,null,["f","r"],"high",0],
    [88,"Gibraltar",0,"Gibraltar",574,null,["f"],"high",0],
  ];
  const ports = raw.map((p) => ({
    id: p[0], name: p[1], dist: p[2], region: p[3],
    berths: p[4], price: p[5], facilities: p[6],
    orca: p[7], stars: p[8],
    anchorage: p[4] === 0,
  }));

  // ---- Recent passages (dashboard) ----
  const recent = [
    { id: "p1", from: "Viveiro", to: "La Coruña", date: "23 Apr 2026", wp: 8, nm: 75.9, hours: 12.7, verdict: "GO", capes: 2 },
    { id: "p2", from: "Ribadeo", to: "Viveiro", date: "21 Apr 2026", wp: 4, nm: 31.0, hours: 5.2, verdict: "GO", capes: 0 },
    { id: "p3", from: "Gijón", to: "Ribadeo", date: "20 Apr 2026", wp: 9, nm: 64.0, hours: 10.6, verdict: "CAUTION", capes: 1 },
    { id: "p4", from: "Gijón", to: "La Coruña", date: "20 Apr 2026", wp: 14, nm: 138.0, hours: 23.0, verdict: "CAUTION", capes: 3 },
    { id: "p5", from: "Ribadeo", to: "Cariño", date: "21 Apr 2026", wp: 7, nm: 49.0, hours: 8.1, verdict: "GO", capes: 1 },
    { id: "p6", from: "Gijón", to: "Cudillero", date: "19 Apr 2026", wp: 4, nm: 21.0, hours: 3.5, verdict: "GO", capes: 0 },
  ];

  // ---- Active passage: Viveiro → La Coruña ----
  // waypoints with [lat,lng], type, eta, wind, beaufort, gust, wave m/s, swell m/s, power, verdict
  const wp = [
    { name: "Viveiro", type: "STOP", lat: 43.659, lng: -7.595, eta: "10:00", wind: 6, bf: 2, gust: 9, wave: "1.5m / 8s", swell: "1.1m / 8s", power: 9.0, verdict: "GO" },
    { name: "Estaca de Bares", type: "CAPE", lat: 43.789, lng: -7.688, eta: "12:31", wind: 6, bf: 2, gust: 9, wave: "1.4m / 8s", swell: "1.1m / 8s", power: 7.8, verdict: "GO" },
    { name: "Cabo Ortegal", type: "CAPE", lat: 43.770, lng: -7.862, eta: "15:03", wind: 7, bf: 2, gust: 10, wave: "1.5m / 9s", swell: "1.4m / 8s", power: 10.1, verdict: "GO" },
    { name: "Cariño", type: "PORT", lat: 43.740, lng: -7.870, eta: "15:49", wind: 7, bf: 2, gust: 10, wave: "1.5m / 9s", swell: "1.4m / 8s", power: 10.1, verdict: "GO" },
    { name: "Cedeira", type: "PORT", lat: 43.661, lng: -8.062, eta: "17:35", wind: 4, bf: 1, gust: 10, wave: "1.4m / 9s", swell: "1.3m / 8s", power: 8.8, verdict: "GO" },
    { name: "Ferrol", type: "PORT", lat: 43.493, lng: -8.234, eta: "20:07", wind: 2, bf: 1, gust: 5, wave: "1.0m / 9s", swell: "0.9m / 8s", power: 4.5, verdict: "GO" },
    { name: "Sada", type: "PORT", lat: 43.357, lng: -8.276, eta: "21:23", wind: 1, bf: 0, gust: 3, wave: "0.7m / 9s", swell: "0.7m / 9s", power: 2.2, verdict: "GO" },
    { name: "La Coruña", type: "STOP", lat: 43.371, lng: -8.396, eta: "22:39", wind: 3, bf: 1, gust: 9, wave: "1.0m / 9s", swell: "0.9m / 8s", power: 4.5, verdict: "GO" },
  ];

  const passage = {
    id: "p1", from: "Viveiro", to: "La Coruña",
    boat: "Bossanova", boatModel: "Hallberg-Rassy Monsun 31",
    model: "ECMWF IFS 0.25°", modelShort: "ECMWF_IFS025",
    speed: 6, mode: "Non-stop",
    departure: "Thu 23 Apr 2026, 10:00",
    arrival: "Thu 23 Apr, 22:39",
    nm: 75.9, hours: 12.7, capes: 2, wp,
  };

  // ---- Detailed forecast (3h) for waypoints (verdict GO unless noted) ----
  // each: [time, wind, bf, gust, wave, swell]
  const fc = {
    "Viveiro": [
      ["00:00",11,3,16,"1.7m / 8s","1.1m / 9s"],["03:00",11,3,16,"1.6m / 8s","1.1m / 9s"],
      ["06:00",8,3,11,"1.6m / 8s","1.1m / 9s"],["09:00",6,2,9,"1.5m / 8s","1.1m / 8s"],
      ["12:00",6,2,9,"1.4m / 8s","1.0m / 8s"],["15:00",6,2,10,"1.3m / 9s","1.0m / 8s"],
      ["18:00",5,2,7,"1.2m / 9s","1.0m / 8s"],["21:00",4,1,5,"1.2m / 9s","1.0m / 8s"],
    ],
    "Estaca de Bares": [
      ["00:00",10,3,14,"1.8m / 9s","1.2m / 9s"],["03:00",10,3,14,"1.7m / 8s","1.1m / 9s"],
      ["06:00",7,3,10,"1.6m / 8s","1.1m / 9s"],["09:00",4,1,6,"1.5m / 8s","1.1m / 8s"],
      ["12:00",6,2,9,"1.4m / 8s","1.1m / 8s"],["15:00",7,2,10,"1.4m / 9s","1.2m / 8s"],
      ["18:00",6,2,8,"1.3m / 9s","1.2m / 8s"],["21:00",4,2,5,"1.3m / 9s","1.1m / 8s"],
    ],
    "Cabo Ortegal": [
      ["00:00",10,3,14,"2.0m / 9s","1.3m / 8s"],["03:00",10,3,14,"1.8m / 9s","1.1m / 9s"],
      ["06:00",7,3,10,"1.8m / 8s","1.1m / 8s"],["09:00",4,1,6,"1.7m / 9s","1.2m / 8s"],
      ["12:00",6,2,9,"1.6m / 9s","1.3m / 8s"],["15:00",7,2,10,"1.5m / 9s","1.4m / 8s"],
      ["18:00",6,2,8,"1.5m / 9s","1.4m / 8s"],["21:00",4,2,5,"1.5m / 9s","1.3m / 8s"],
    ],
    "La Coruña": [
      ["00:00",3,1,6,"1.4m / 10s","0.9m / 10s"],["03:00",3,1,7,"1.3m / 10s","1.0m / 9s"],
      ["06:00",4,2,8,"1.3m / 9s","1.1m / 9s"],["09:00",2,1,7,"1.3m / 9s","1.1m / 8s"],
      ["12:00",5,2,14,"1.2m / 9s","1.1m / 8s"],["15:00",4,2,14,"1.1m / 9s","1.0m / 8s"],
      ["18:00",2,1,11,"1.0m / 9s","0.9m / 9s"],["21:00",2,1,3,"1.0m / 9s","0.9m / 9s"],
    ],
  };
  // synthesize forecasts for remaining waypoints
  function synth(base, shift) {
    return base.map((r, i) => {
      const w = Math.max(0, Math.round(r[1] + shift));
      return [r[0], w, Math.min(6, Math.max(0, Math.round(w / 3.5))), Math.max(w + 2, r[3] + shift), r[4], r[5]];
    });
  }
  fc["Cariño"] = fc["Cabo Ortegal"];
  fc["Cedeira"] = synth(fc["Cabo Ortegal"], -2);
  fc["Ferrol"] = synth(fc["La Coruña"], -1);
  fc["Sada"] = synth(fc["La Coruña"], -2);

  // ---- GO/NO-GO departure timeline (next 48h, hourly aggregate) ----
  // simulate departure-hour quality score 0..10 (higher = better window)
  const timeline = [];
  const startH = -4; // hours relative to planned 10:00 departure
  for (let h = 0; h < 48; h++) {
    // model: morning calm windows, afternoon building breeze, a front on day 2 evening
    const tod = (10 + h) % 24;
    let wind = 7 + 5 * Math.sin((h / 24) * Math.PI * 2 + 1) + (h > 30 ? (h - 30) * 0.9 : 0);
    wind += Math.sin(h * 1.7) * 1.4;
    wind = Math.max(2, wind);
    const gust = wind + 4 + (h > 30 ? (h - 30) * 0.6 : 2);
    let score = 10 - Math.max(0, (wind - 12)) * 0.9 - Math.max(0, (gust - 22)) * 0.5;
    if (tod >= 22 || tod < 5) score -= 1.6; // night penalty
    score = Math.max(0.5, Math.min(10, score));
    const verdict = score >= 7 ? "GO" : score >= 4.5 ? "CAUTION" : "NOGO";
    timeline.push({ h, label: hourLabel(h), wind: +wind.toFixed(0), gust: +gust.toFixed(0), score: +score.toFixed(1), verdict, tod });
  }
  function hourLabel(h) {
    const d = new Date(2026, 3, 23, 10 + h, 0);
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    return days[d.getDay()] + " " + String(d.getHours()).padStart(2, "0") + ":00";
  }

  // ---- Orca interaction risk zones (lat,lng,radius m, level) ----
  const orcaZones = [
    { lat: 43.74, lng: -7.92, r: 9000, level: "medium", note: "Cabo Ortegal — 3 reports this week" },
    { lat: 43.62, lng: -8.30, r: 7000, level: "low", note: "Approaches to A Coruña — quiet" },
  ];

  // ---- Community routes (social) ----
  const community = [
    { skipper: "Mar Atlántica", boat: "Oceanis 46", route: "La Coruña → Baiona", days: 2, likes: 214, note: "Hugged the coast past Fisterra, glassy dawn." },
    { skipper: "Bavaria Blau", boat: "Bavaria 42", route: "Viana → Cascais", days: 3, likes: 167, note: "Strong N push, surfed swell off Nazaré." },
    { skipper: "S/Y Polaris", boat: "Najad 391", route: "Cádiz → Gibraltar", days: 1, likes: 98, note: "Slack-tide transit through Tarifa, orca-free." },
  ];

  window.SW = { ports, recent, passage, fc, timeline, orcaZones, community };
})();
