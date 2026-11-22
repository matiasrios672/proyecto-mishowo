import type { CSSProperties } from "react";
import { Playfair_Display, Source_Sans_3, Poppins, Inter, Fraunces, Nunito_Sans, DM_Sans } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", variable: "--font-pair-clasica-h" });
const sourceSans = Source_Sans_3({ subsets: ["latin"], display: "swap", variable: "--font-pair-clasica-b" });
const poppins = Poppins({ subsets: ["latin"], display: "swap", weight: ["500", "600", "700"], variable: "--font-pair-moderna-h" });
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-pair-moderna-b" });
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", variable: "--font-pair-calida-h" });
const nunito = Nunito_Sans({ subsets: ["latin"], display: "swap", variable: "--font-pair-calida-b" });
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", variable: "--font-pair-limpia-h" });

export type FontPairId = "clasica" | "moderna" | "calida" | "limpia";

export const FONT_PAIRS: { id: FontPairId; name: string; classes: string }[] = [
  { id: "clasica", name: "Clásica", classes: `${playfair.variable} ${sourceSans.variable}` },
  { id: "moderna", name: "Moderna", classes: `${poppins.variable} ${inter.variable}` },
  { id: "calida", name: "Cálida", classes: `${fraunces.variable} ${nunito.variable}` },
  { id: "limpia", name: "Limpia", classes: `${dmSans.variable}` },
];

export const DEFAULT_FONT_PAIR: FontPairId = "moderna";

export function getFontPair(id: string | null | undefined) {
  return FONT_PAIRS.find((p) => p.id === id) ?? FONT_PAIRS[1]!;
}

export function fontPairStyle(id: string | null | undefined): CSSProperties {
  const pair = getFontPair(id).id;
  const head = `var(--font-pair-${pair}-h)`;
  const body = pair === "limpia" ? head : `var(--font-pair-${pair}-b)`;
  return { "--font-heading": head, "--font-sans": body, fontFamily: body } as CSSProperties;
}
