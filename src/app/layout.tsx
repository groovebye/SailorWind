import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/lib/theme";
import SwRegister from "./sw-register";
import "./globals.css";

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SailorWind — Passage Planner",
  description: "Weather-aware passage planner for Bossanova - Hallberg Rassy Monsun 31",
  appleWebApp: { capable: true, title: "SailorWind", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${mono.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen font-mono">
        <ThemeProvider>{children}</ThemeProvider>
        <SwRegister />
      </body>
    </html>
  );
}
