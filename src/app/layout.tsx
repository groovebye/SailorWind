import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/lib/theme";
import "./globals.css";

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SailorWind — Passage Planner",
  description: "Weather-aware passage planner for Bossanova - Hallberg Rassy Monsun 31",
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
      </body>
    </html>
  );
}
