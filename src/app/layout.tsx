import type { Metadata, Viewport } from "next";
import { Spectral, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "@/lib/theme";
import Script from "next/script";
import { prisma } from "@/lib/db";
import { defaultVessel, getCurrentUser } from "@/lib/auth/dal";
import AppShell, { type ShellUser } from "./_shell/AppShell";
import SwRegister from "./sw-register";
import "./globals.css";

const spectral = Spectral({
  variable: "--font-spectral",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "https://sailorwind.com"),
  title: "SailorWind — Passage Planner",
  description: "Weather-aware passage planner for coastal cruisers: cape-by-cape forecasts, GO/NO-GO departure windows, depth-aware routes and harbour intel.",
  appleWebApp: { capable: true, title: "SailorWind", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#03080f",
  // Full-screen PWA on the iPad (black-translucent status bar): draw under the
  // status bar and pad with env(safe-area-inset-*) in CSS.
  viewportFit: "cover",
};

/** The signed-in user's shell data: name, default boat and most-recent passage. */
async function getShellData(): Promise<{ user: ShellUser | null; activeId: string | null }> {
  try {
    const me = await getCurrentUser();
    if (!me) return { user: null, activeId: null };
    const [boat, passage] = await Promise.all([
      defaultVessel(me.id),
      prisma.passage.findFirst({ where: { ownerId: me.id }, orderBy: { updatedAt: "desc" }, select: { shortId: true } }),
    ]);
    return {
      user: { name: me.name, boat: boat ? { name: boat.name, model: boat.model } : null },
      activeId: passage?.shortId ?? null,
    };
  } catch {
    return { user: null, activeId: null };
  }
}

// Self-hosted Umami (cookieless). Read at request time so the Docker image needs no build args.
const UMAMI_SRC = process.env.UMAMI_SRC || "https://analytics.powerbuilder-systems.com/script.js";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, activeId } = await getShellData();
  const umamiId = process.env.UMAMI_WEBSITE_ID;
  return (
    <html
      lang="en"
      className={`${spectral.variable} ${hanken.variable} ${plexMono.variable} dark`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <AppShell activeId={activeId} user={user}>{children}</AppShell>
        </ThemeProvider>
        <SwRegister />
        {umamiId && (
          <Script src={UMAMI_SRC} data-website-id={umamiId} data-domains="sailorwind.com" strategy="afterInteractive" />
        )}
      </body>
    </html>
  );
}
