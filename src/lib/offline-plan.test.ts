import { describe, expect, it } from "vitest";
import { departureWindowsUrl, exportUrl, legRouteUrl, planOfflineUrls, type PlanLeg } from "./offline-plan";

const legs: PlanLeg[] = [
  { index: 0, from: { name: "Leixões", lat: 41.1853, lon: -8.7036 }, to: { name: "Figueira da Foz", lat: 40.1469, lon: -8.8682 } },
  { index: 1, from: { name: "Figueira da Foz", lat: 40.1469, lon: -8.8682 }, to: { name: "Cascais", lat: 38.6916, lon: -9.4173 } },
];

describe("offline plan URLs", () => {
  it("builds the leg-route URL exactly as the leg page requests it", () => {
    expect(legRouteUrl("x1kfndjs", legs[0])).toBe(
      "/api/leg-route?passageId=x1kfndjs&legIndex=0&fromName=Leix%C3%B5es&fromLat=41.1853&fromLon=-8.7036" +
      "&toName=Figueira%20da%20Foz&toLat=40.1469&toLon=-8.8682",
    );
  });

  it("matches the departure-windows section's default view", () => {
    expect(departureWindowsUrl("abc", 1)).toBe("/api/departure-windows?passageId=abc&legIndex=1&stepHours=6&count=13");
  });

  it("exports the whole passage or one leg", () => {
    expect(exportUrl("abc")).toBe("/api/export?passageId=abc");
    expect(exportUrl("abc", 0)).toBe("/api/export?passageId=abc&legIndex=0");
  });

  it("covers the pages and data of every leg, without duplicates", () => {
    const urls = planOfflineUrls("abc", legs);
    expect(urls).toContain("/p/abc");
    expect(urls).toContain("/map?p=abc");
    expect(urls).toContain("/p/abc/leg/1");
    expect(urls.filter((u) => u.startsWith("/api/leg-route"))).toHaveLength(2);
    expect(urls.filter((u) => u.startsWith("/api/departure-windows"))).toHaveLength(2);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
