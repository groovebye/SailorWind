import { describe, expect, it } from "vitest";
import { BASE_LAYERS, DEPTH_CONTOURS, HOME_BERTH, SEAMARKS, depthShaded, formatDdm, windyEmbedUrl } from "./map-layers";

describe("layer catalogue", () => {
  it("attributes every source", () => {
    for (const l of [...BASE_LAYERS, SEAMARKS, depthShaded("mean_multicolour"), DEPTH_CONTOURS]) {
      expect(l.attribution.length).toBeGreaterThan(10);
      expect(l.licence.length).toBeGreaterThan(5);
    }
    expect(SEAMARKS.attribution).toContain("OpenSeaMap");
    expect(depthShaded("mean_atlas_land").attribution).toContain("EMODnet Bathymetry Consortium");
  });

  it("draws both bases from the OSM tiles, dark via CSS", () => {
    expect(BASE_LAYERS.map((b) => b.url)).toEqual([BASE_LAYERS[0].url, BASE_LAYERS[0].url]);
    expect(BASE_LAYERS[0].url).toBe("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
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
