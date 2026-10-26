import { describe, it, expect } from "vitest";
import {
  asciiName,
  buildGpx,
  fitImportedRoute,
  IMPORT_POINTS_MAX,
  parseGpx,
  pickImportRoute,
  plotterRoutes,
  prepareLegImport,
  PLOTTER_NAME_MAX,
} from "@/lib/gpx";

const LEIXOES = { name: "Leixoes", lat: 41.1707, lon: -8.7055 };
const CASCAIS = { name: "Cascais", lat: 38.6958, lon: -9.418 };

// Shaped like an OpenCPN 5.x route export (extensions before and inside points).
const OPENCPN_ROUTE = `<?xml version="1.0"?>
<gpx version="1.1" creator="OpenCPN" xmlns="http://www.topografix.com/GPX/1/1" xmlns:opencpn="http://www.opencpn.org">
  <rte>
    <name>Leixões → Cascais (WR 28/06)</name>
    <extensions>
      <opencpn:start>Leixoes-off</opencpn:start>
      <opencpn:end>Cascais-off</opencpn:end>
    </extensions>
    <rtept lat="41.170000" lon="-8.770000">
      <time>2026-10-28T06:00:00Z</time>
      <name>001</name>
      <sym>diamond</sym>
      <extensions><opencpn:guid>a1</opencpn:guid><opencpn:viz>1</opencpn:viz></extensions>
    </rtept>
    <rtept lat="39.450000" lon="-9.650000"><name>002</name><sym/></rtept>
    <rtept lat="38.700000" lon="-9.430000"><name>003</name></rtept>
  </rte>
</gpx>`;

describe("asciiName", () => {
  it("strips accents, arrows and odd characters, and caps the length", () => {
    expect(asciiName("Nazaré")).toBe("Nazare");
    expect(asciiName("Leixões → Cascais")).toBe("Leixoes - Cascai");
    expect(asciiName("Figueira da Foz (barra)").length).toBeLessThanOrEqual(PLOTTER_NAME_MAX);
    expect(asciiName("A Coruña / Ría")).toBe("A Coruna Ria");
    expect(asciiName("→→")).toBe("-");
    expect(asciiName("☀️")).toBe("WPT");
  });
});

describe("plotterRoutes", () => {
  const leg = { from: "Leixoes", to: "Cascais", points: [LEIXOES, { lat: 40.5, lon: -9.1 }, { lat: 39.4, lon: -9.6 }, CASCAIS] };

  it("names ends after the ports and the rest by leg code", () => {
    const [route] = plotterRoutes([leg]);
    expect(route.name).toBe("Leixoes-Cascais");
    expect(route.points.map((p) => p.name)).toEqual(["Leixoes", "LEICAS01", "LEICAS02", "Cascais"]);
  });

  it("keeps an imported point's own label, made plotter-safe", () => {
    const [route] = plotterRoutes([{ ...leg, points: [LEIXOES, { lat: 39.4, lon: -9.6, label: "Farilhões – W of the islands" }, CASCAIS] }]);
    expect(route.points[1].name).toBe("Farilhoes W of t");
  });

  it("splits long routes into parts that share the joining point", () => {
    const points = Array.from({ length: 120 }, (_, i) => ({ lat: 41 - i * 0.02, lon: -9.5 }));
    const routes = plotterRoutes([{ from: "Leixoes", to: "Cascais", points }], 50);
    expect(routes).toHaveLength(3);
    expect(routes.map((r) => r.name)).toEqual(["Leixoes-Casc 1-3", "Leixoes-Casc 2-3", "Leixoes-Casc 3-3"]);
    for (const r of routes) expect(r.points.length).toBeLessThanOrEqual(50);
    expect(routes[0].points.at(-1)).toEqual(routes[1].points[0]);
    expect(routes.reduce((n, r) => n + r.points.length, 0) - (routes.length - 1)).toBe(120);
  });

  it("keeps names unique across legs, but one name per shared port", () => {
    const routes = plotterRoutes([
      { from: "Leixoes", to: "Figueira da Foz", points: [LEIXOES, { lat: 40.6, lon: -9.0 }, { lat: 40.15, lon: -8.87 }] },
      { from: "Figueira da Foz", to: "Nazare", points: [{ lat: 40.15, lon: -8.87 }, { lat: 39.9, lon: -9.1 }, { lat: 39.59, lon: -9.07 }] },
    ]);
    const names = routes.flatMap((r) => r.points.map((p) => p.name!));
    expect(routes[0].points.at(-1)!.name).toBe("Figueira da Foz");
    expect(routes[1].points[0].name).toBe("Figueira da Foz");
    expect(new Set(names).size).toBe(names.length - 1);
    for (const n of names) expect(n).toMatch(/^[A-Za-z0-9 _-]{1,16}$/);
  });

  it("disambiguates a name reused for a different position", () => {
    const [route] = plotterRoutes([{ from: "Peniche", to: "Peniche", points: [{ lat: 39.35, lon: -9.38 }, { lat: 39.4, lon: -9.5 }, { lat: 39.36, lon: -9.37 }] }]);
    expect(route.points[0].name).toBe("Peniche");
    expect(route.points[2].name).toBe("Peniche2");
  });
});

describe("buildGpx", () => {
  it("writes routes only — no standalone waypoints duplicating route points", () => {
    const xml = buildGpx({ name: "Leixoes-Cascais", routes: plotterRoutes([{ from: "Leixoes", to: "Cascais", points: [LEIXOES, CASCAIS] }]), time: new Date("2026-10-26T12:00:00Z") });
    expect(xml).not.toContain("<wpt");
    expect(xml.match(/<rte>/g)).toHaveLength(1);
    expect(xml).toContain('<rtept lat="41.170700" lon="-8.705500"><name>Leixoes</name></rtept>');
    expect(xml).toContain("<time>2026-10-26T12:00:00.000Z</time>");
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it("escapes XML in names", () => {
    const xml = buildGpx({ name: `Tom & Jerry's "<route>"`, routes: [] });
    expect(xml).toContain("<name>Tom &amp; Jerry&apos;s &quot;&lt;route&gt;&quot;</name>");
  });

  it("round-trips through parseGpx", () => {
    const routes = plotterRoutes([{ from: "Leixoes", to: "Cascais", points: [LEIXOES, { lat: 40.5, lon: -9.1 }, CASCAIS] }]);
    const parsed = parseGpx(buildGpx({ name: "Test", routes, waypoints: [{ lat: 39.35, lon: -9.38, name: "Peniche" }] }));
    expect(parsed.name).toBe("Test");
    expect(parsed.routes[0].name).toBe("Leixoes-Cascais");
    expect(parsed.routes[0].points).toEqual(routes[0].points);
    expect(parsed.waypoints).toEqual([{ lat: 39.35, lon: -9.38, name: "Peniche" }]);
  });
});

describe("parseGpx", () => {
  it("reads an OpenCPN route, ignoring extensions", () => {
    const f = parseGpx(OPENCPN_ROUTE);
    expect(f.routes).toHaveLength(1);
    expect(f.routes[0].name).toBe("Leixões → Cascais (WR 28/06)");
    expect(f.routes[0].points.map((p) => p.name)).toEqual(["001", "002", "003"]);
    expect(f.routes[0].points[1]).toEqual({ lat: 39.45, lon: -9.65, name: "002" });
    expect(f.waypoints).toEqual([]);
  });

  it("handles namespace prefixes, attribute order, quotes, self-closing points, CDATA and entities", () => {
    const f = parseGpx(`<gpx:gpx xmlns:gpx="http://www.topografix.com/GPX/1/1">
      <gpx:wpt lon='-9.38' lat='39.35'><gpx:name><![CDATA[Peniche & Berlengas]]></gpx:name></gpx:wpt>
      <gpx:wpt lat="39.59" lon="-9.07"><gpx:name>Nazar&#233; &amp; Co</gpx:name></gpx:wpt>
      <gpx:rte><gpx:rtept lat="40" lon="-9.2"/><gpx:rtept lat="39.9" lon="-9.3"/></gpx:rte>
    </gpx:gpx>`);
    expect(f.waypoints).toEqual([
      { lat: 39.35, lon: -9.38, name: "Peniche & Berlengas" },
      { lat: 39.59, lon: -9.07, name: "Nazaré & Co" },
    ]);
    expect(f.routes[0].points).toEqual([{ lat: 40, lon: -9.2 }, { lat: 39.9, lon: -9.3 }]);
  });

  it("reads tracks across segments and keeps the track name", () => {
    const f = parseGpx(`<gpx><trk><name>Axiom track 27 Oct</name>
      <trkseg><trkpt lat="41.17" lon="-8.70"><ele>0</ele><time>2026-10-27T06:00:00Z</time></trkpt><trkpt lat="41.10" lon="-8.80"/></trkseg>
      <trkseg><trkpt lat="41.00" lon="-8.90"/></trkseg></trk></gpx>`);
    expect(f.tracks[0].name).toBe("Axiom track 27 Oct");
    expect(f.tracks[0].points).toHaveLength(3);
  });

  it("skips points with bad coordinates and counts them", () => {
    const f = parseGpx(`<gpx><wpt lat="95" lon="0"/><wpt lat="abc" lon="1"/><wpt lat="1" lon="2"/></gpx>`);
    expect(f.waypoints).toEqual([{ lat: 1, lon: 2 }]);
    expect(f.skippedPoints).toBe(2);
  });

  it("rejects non-GPX input", () => {
    expect(() => parseGpx("<kml></kml>")).toThrow("Not a GPX file");
  });
});

describe("pickImportRoute", () => {
  it("prefers a route, then the longest track, then waypoints", () => {
    expect(pickImportRoute(parseGpx(OPENCPN_ROUTE))?.source).toBe("route");
    const tracks = parseGpx(`<gpx><trk><trkseg><trkpt lat="1" lon="1"/><trkpt lat="2" lon="2"/></trkseg></trk>
      <trk><name>long</name><trkseg><trkpt lat="1" lon="1"/><trkpt lat="2" lon="2"/><trkpt lat="3" lon="3"/></trkseg></trk></gpx>`);
    expect(pickImportRoute(tracks)).toMatchObject({ source: "track", name: "long" });
    const wpts = parseGpx(`<gpx><metadata><name>marks</name></metadata><wpt lat="1" lon="1"/><wpt lat="2" lon="2"/></gpx>`);
    expect(pickImportRoute(wpts)).toMatchObject({ source: "waypoints", name: "marks" });
    expect(pickImportRoute(parseGpx(`<gpx><wpt lat="1" lon="1"/></gpx>`))).toBeNull();
  });
});

describe("fitImportedRoute", () => {
  const offshore = [{ lat: 41.17, lon: -8.77 }, { lat: 39.45, lon: -9.65 }, { lat: 38.698, lon: -9.421 }];

  it("joins a route that stops short of the harbours", () => {
    const res = fitImportedRoute(offshore, LEIXOES, CASCAIS);
    if ("error" in res) throw new Error(res.error);
    expect(res.points[0]).toEqual({ lat: LEIXOES.lat, lon: LEIXOES.lon, label: "Leixoes" });
    expect(res.points.at(-1)).toEqual({ lat: 38.698, lon: -9.421 }); // ~0.2 NM off: kept as-is
    expect(res.points).toHaveLength(4);
    expect(res.reversed).toBe(false);
    expect(res.warnings.join(" ")).toContain("Joined to Leixoes");
  });

  it("reverses a route drawn the other way", () => {
    const res = fitImportedRoute([...offshore].reverse(), LEIXOES, CASCAIS);
    if ("error" in res) throw new Error(res.error);
    expect(res.reversed).toBe(true);
    expect(res.points[1]).toEqual({ lat: 41.17, lon: -8.77 });
  });

  it("refuses a route for a different leg", () => {
    const res = fitImportedRoute([{ lat: 43.37, lon: -8.4 }, { lat: 42.24, lon: -8.73 }], LEIXOES, CASCAIS);
    expect("error" in res && res.error).toMatch(/NM from Leixoes/);
  });

  it(`thins a dense track to ≤ ${IMPORT_POINTS_MAX} points, keeping both ends`, () => {
    const track = Array.from({ length: 3000 }, (_, i) => ({
      lat: 41.17 - (i / 2999) * 2.47,
      lon: -8.71 - (i / 2999) * 0.71 + (i % 2 ? 0.0004 : 0),
    }));
    const res = fitImportedRoute(track, LEIXOES, CASCAIS);
    if ("error" in res) throw new Error(res.error);
    expect(res.points.length).toBeLessThanOrEqual(IMPORT_POINTS_MAX + 2);
    expect(res.points.length).toBeGreaterThanOrEqual(2);
    expect(res.warnings.join(" ")).toMatch(/Thinned 3000 →/);
  });
});

describe("prepareLegImport", () => {
  it("turns an OpenCPN route file into the leg's points and a summary", () => {
    const res = prepareLegImport(OPENCPN_ROUTE, "wr.gpx", LEIXOES, CASCAIS);
    if (!res.ok) throw new Error(res.error);
    expect(res.label).toBe("Leixões → Cascais (WR 28/06)");
    expect(res.points[0].label).toBe("Leixoes"); // joined to the port
    expect(res.summary).toMatch(/^"Leixões → Cascais \(WR 28\/06\)" — route, 5 pts, \d+\.\d NM$/);
    expect(res.distanceNm).toBeGreaterThan(150);
  });

  it("reports unreadable files and wrong legs with the file name", () => {
    const bad = prepareLegImport("<kml/>", "x.kml", LEIXOES, CASCAIS);
    expect(bad).toEqual({ ok: false, error: "x.kml: Not a GPX file" });
    const far = prepareLegImport(OPENCPN_ROUTE, "wr.gpx", { name: "Gijon", lat: 43.55, lon: -5.67 }, CASCAIS);
    expect(far.ok).toBe(false);
  });
});
