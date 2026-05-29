import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SailorWind — Passage Planner",
    short_name: "SailorWind",
    description: "Weather-aware sailing passage planner for the Bossanova voyage",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0b1220",
    theme_color: "#0b1220",
    categories: ["navigation", "travel", "weather"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
