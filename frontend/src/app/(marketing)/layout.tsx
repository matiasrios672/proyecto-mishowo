import type { CSSProperties, ReactNode } from "react";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { MarketingHeader, MarketingFooter } from "@/components/marketing/MarketingShell";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-mk-display", display: "swap" });
const body = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-mk-text", display: "swap" });

// Identidad de MiShowo: celeste y sol de la bandera argentina sobre tinta azul. Solo vive en estas páginas.
const brand = {
  "--background": "#FBFDFF",
  "--foreground": "#0E1B2C",
  "--primary": "#2F6FB0",
  "--primary-foreground": "#FFFFFF",
  "--muted": "#EAF4FC",
  "--muted-foreground": "#47566A",
  "--border": "#D6E4F2",
  "--ring": "#2F6FB0",
} as CSSProperties;

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${display.variable} ${body.variable} mk-text flex min-h-dvh flex-col bg-background text-foreground`} style={brand}>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2">Saltar al contenido</a>
      <MarketingHeader />
      <div id="contenido" className="flex-1">{children}</div>
      <MarketingFooter />
    </div>
  );
}
