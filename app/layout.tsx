import type { Metadata } from "next";
import { Bodoni_Moda, IBM_Plex_Mono, Shippori_Mincho } from "next/font/google";
import "./globals.css";

/* -----------------------------------------------------------
   Fonts — all three trace back to letterpress printing.
   - Bodoni Moda: Latin display (Bodoni, a classic press face).
   - Shippori Mincho: Japanese text (modelled on Meiji-era Tsukiji type).
   - IBM Plex Mono: specs, labels, numbers — like a print job ticket.
   Self-hosted via next/font (no layout shift).
   ----------------------------------------------------------- */
const display = Bodoni_Moda({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-display",
  display: "swap",
  // next/font has no metrics for Bodoni Moda; skip the generated fallback face.
  adjustFontFallback: false,
});

const mincho = Shippori_Mincho({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mincho",
  display: "swap",
  // Japanese is split into many unicode-range files; fetch only what's used.
  preload: false,
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KAMITO",
  description:
    "KAMITO — 活版印刷・ダイカット・箔押しのスペシャルカード。100枚から、サンプルセット¥1,500。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ja"
      className={`${display.variable} ${mincho.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
