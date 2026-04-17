import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

/* -----------------------------------------------------------
   Fonts
   - Serif (Cormorant Garamond) for headlines — quiet elegance.
   - Sans (Inter) for UI text.
   Both are loaded via next/font for self-hosting + no CLS.
   ----------------------------------------------------------- */
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
    "KAMITO — paper, carefully shaped. A quiet study in paper and finish.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
