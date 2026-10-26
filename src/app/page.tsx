import type { Metadata } from "next";
import { defaultVessel, getCurrentUser } from "@/lib/auth/dal";
import Dashboard from "./_dashboard/Dashboard";
import Landing from "./_landing/Landing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SailorWind — Plan the wind. Sail the window.",
  description:
    "Free passage planner for coastal cruisers from Biscay to Gibraltar: cape-by-cape forecasts, GO/NO-GO departure windows, depth-aware routes, marinas and bail-out ports.",
  openGraph: {
    title: "SailorWind — Plan the wind. Sail the window.",
    description: "Cape-by-cape forecasts, GO/NO-GO departure windows and harbour intel for coastal cruisers.",
    url: "/",
    siteName: "SailorWind",
    type: "website",
  },
};

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) return <Landing />;
  const boat = await defaultVessel(user.id);
  return <Dashboard userId={user.id} boat={boat ? { name: boat.name, model: boat.model } : null} />;
}
