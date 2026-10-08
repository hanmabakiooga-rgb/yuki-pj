import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, Noto_Serif_JP } from "next/font/google";
import "./globals.css";

/* -----------------------------------------------------------
   Fonts
   - Serif (Cormorant Garamond) for Latin headlines and labels.
   - Sans (Inter) for small UI text.
   - Mincho (Noto Serif JP) for Japanese copy in the lower sections.
   All are self-hosted via next/font (no layout shift).
   ----------------------------------------------------------- */
const mincho = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--kamito-mincho-font",
  display: "swap",
  // Japanese is split into many unicode-range files; let the browser fetch only what it needs.
  preload: false,
});

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--kamito-serif-font",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--kamito-sans-font",
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
      className={`${serif.variable} ${sans.variable} ${mincho.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
