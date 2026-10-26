import { describe, expect, it } from "vitest";
import {
  BASE_LAYERS, DEPTH_CONTOURS, HOME_BERTH, IHM_ENC, SEAMARKS, depthShaded, formatDdm, ihmCoverageShare, inIhmEncArea, resolveBase,
  windyEmbedUrl,
} from "./map-layers";

describe("layer catalogue", () => {
  it("attributes every source", () => {
    for (const l of [...BASE_LAYERS, SEAMARKS, depthShaded("mean_multicolour"), DEPTH_CONTOURS]) {
      expect(l.attribution.length).toBeGreaterThan(10);
      expect(l.licence.length).toBeGreaterThan(5);
    }
    expect(SEAMARKS.attribution).toContain("OpenSeaMap");
    expect(depthShaded("mean_atlas_land").attribution).toContain("EMODnet Bathymetry Consortium");
  });

  it("draws Dark and OSM from the OSM tiles, dark via CSS", () => {
    const osm = BASE_LAYERS.filter((b) => b.id === "dark" || b.id === "osm");
    expect(osm.map((b) => b.url)).toEqual(Array(2).fill("https://tile.openstreetmap.org/{z}/{x}/{y}.png"));
    expect(BASE_LAYERS.find((b) => b.id === "dark")?.className).toBe("lf-dark-tiles");
  });

  it("labels depth as not for navigation", () => {
    expect(depthShaded("mean_multicolour").note).toMatch(/115 m grid, not for navigation/);
    expect(DEPTH_CONTOURS.note).toMatch(/not for navigation/);
  });

  it("uses the requested EMODnet style and the OpenSeaMap seamark tiles", () => {
    expect(depthShaded("mean_atlas_land").url).toContain("/latest/mean_atlas_land/web_mercator/{z}/{x}/{y}.png");
    expect(SEAMARKS.url).toBe("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png");
    expect(DEPTH_CONTOURS.wms?.layers).toBe("emodnet:contours");
  });
});

describe("home berth", () => {
  it("is Marina Porto Atlântico in Leça", () => {
    expect(HOME_BERTH.lat).toBe(41.18619);
    expect(HOME_BERTH.lon).toBe(-8.70474);
    expect(formatDdm(HOME_BERTH.lat, HOME_BERTH.lon)).toBe("41°11.171′N 008°42.284′W");
  });

  it("formats the southern and eastern hemispheres and minute rollover", () => {
    expect(formatDdm(-33.85, 151.2)).toBe("33°51.000′S 151°12.000′E");
    expect(formatDdm(10.99999999, -0.5)).toBe("11°00.000′N 000°30.000′W");
  });
});

describe("windyEmbedUrl", () => {
  it("opens Windy at the map view with knots and a clamped zoom", () => {
    const u = new URL(windyEmbedUrl({ lat: 41.186191, lon: -8.704741, zoom: 14 }, "waves"));
    expect(u.host).toBe("embed.windy.com");
    expect(u.searchParams.get("lat")).toBe("41.186");
    expect(u.searchParams.get("zoom")).toBe("11");
    expect(u.searchParams.get("overlay")).toBe("waves");
    expect(u.searchParams.get("metricWind")).toBe("kt");
  });
});

describe("IHM ENC charts", () => {
  it("is the IHM cached WMTS, credited and marked not for navigation", () => {
    expect(IHM_ENC.url).toBe("https://ideihm.covam.es/ihmcache/wmts/1.0.0/RasterENC/default/googlemapscompatible/{z}/{y}/{x}.png");
    expect(IHM_ENC.attribution).toContain("© <a href=\"https://ideihm.covam.es/\">Instituto Hidrográfico de la Marina</a>");
    expect(IHM_ENC.attribution).toContain("not for navigation");
    expect(IHM_ENC.note).toMatch(/Spain \+ Portugal overview/);
    expect(IHM_ENC.note).toMatch(/Portugal is general scale only and not updated/);
    expect(IHM_ENC.className).toBeUndefined(); // the licence forbids altering the charts: no dark filter
    expect(BASE_LAYERS).toContain(IHM_ENC);
  });

  it("knows where it has charts", () => {
    expect(inIhmEncArea(41.186, -8.705)).toBe(true); // Leixões / Porto
    expect(inIhmEncArea(38.69, -9.42)).toBe(true); // Cascais / Lisboa
    expect(inIhmEncArea(36.14, -5.35)).toBe(true); // Gibraltar
    expect(inIhmEncArea(39.57, 2.65)).toBe(true); // Palma
    expect(inIhmEncArea(28.13, -15.43)).toBe(true); // Las Palmas
    expect(inIhmEncArea(45.5, -4.0)).toBe(false); // Bay of Biscay
    expect(inIhmEncArea(48.38, -4.49)).toBe(false); // Brest
    expect(inIhmEncArea(43.3, 5.37)).toBe(false); // Marseille
  });

  // Views as the map reports them (south, west, north, east).
  const box = (lat: number, lon: number, dLat: number, dLon: number) =>
    ({ south: lat - dLat, north: lat + dLat, west: lon - dLon, east: lon + dLon });
  const porto = box(41.18, -8.75, 0.15, 0.25);
  const gibraltar = box(36.13, -5.36, 0.08, 0.12);
  const passageFit = { south: 37.6, west: -14.9, north: 42.2, east: -7.6 }; // Leixões–Cascais fitted beside the panel
  const biscay = box(45.5, -4, 1, 1.5);
  const europe = { south: 30, west: -25, north: 62, east: 30 };

  it("measures how much of a view the charts cover", () => {
    expect(ihmCoverageShare(porto)).toBe(1);
    expect(ihmCoverageShare(biscay)).toBe(0);
    expect(ihmCoverageShare(passageFit)).toBeGreaterThan(0.3);
    expect(ihmCoverageShare(europe)).toBeLessThan(0.2);
  });

  it("is the default over Iberia and Dark elsewhere; explicit choices win", () => {
    expect(resolveBase("auto", porto).id).toBe("ihm");
    expect(resolveBase("auto", gibraltar).id).toBe("ihm");
    expect(resolveBase("auto", passageFit).id).toBe("ihm"); // centre is out at sea, view is mostly Portugal
    expect(resolveBase("auto", null).id).toBe("ihm"); // the map opens on the berth in Leixões
    expect(resolveBase("auto", biscay).id).toBe("dark");
    expect(resolveBase("auto", europe).id).toBe("dark");
    expect(resolveBase("osm", porto).id).toBe("osm");
    expect(resolveBase("ihm", biscay).id).toBe("ihm");
    expect(resolveBase("bogus", null).id).toBe("ihm");
  });
});
