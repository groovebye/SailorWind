import type { Metadata, Viewport } from "next";
import { Spectral, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "@/lib/theme";
import { prisma } from "@/lib/db";
import AppShell from "./_shell/AppShell";
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
  title: "SailorWind — Passage Planner",
  description: "Weather-aware passage planner for Bossanova - Hallberg Rassy Monsun 31",
  appleWebApp: { capable: true, title: "SailorWind", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#03080f",
};

async function getActivePassageId(): Promise<string | null> {
  try {
    const p = await prisma.passage.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { shortId: true },
    });
    return p?.shortId ?? null;
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const activeId = await getActivePassageId();
  return (
    <html
      lang="en"
      className={`${spectral.variable} ${hanken.variable} ${plexMono.variable} dark`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <AppShell activeId={activeId}>{children}</AppShell>
        </ThemeProvider>
        <SwRegister />
      </body>
    </html>
  );
}
