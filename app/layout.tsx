import type { Metadata } from "next";
import { IBM_Plex_Mono, Jost, Shippori_Mincho } from "next/font/google";
import "./globals.css";

/* -----------------------------------------------------------
   Fonts
   - Jost: Latin display, light geometric sans (after Futura,
     itself a metal type cut for letterpress).
   - Shippori Mincho: Japanese text (modelled on Meiji-era Tsukiji type).
   - IBM Plex Mono: specs, labels, numbers — like a print job ticket.
   Self-hosted via next/font (no layout shift).
   ----------------------------------------------------------- */
const display = Jost({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-display",
  display: "swap",
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
