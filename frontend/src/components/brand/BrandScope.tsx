import type { CSSProperties, ReactNode } from "react";
import { Bricolage_Grotesque, Figtree } from "next/font/google";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-mk-display", display: "swap" });
const body = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-mk-text", display: "swap" });

/** Identidad de MiShowo: celeste y azul sobre tinta. Se usa en login, panel del cliente y admin (las páginas de cada negocio llevan la suya). */
export const brandVars = {
  "--background": "#FBFDFF",
  "--foreground": "#0E1B2C",
  "--primary": "#2F6FB0",
  "--primary-foreground": "#FFFFFF",
  "--muted": "#EAF4FC",
  "--muted-foreground": "#47566A",
  "--border": "#D6E4F2",
  "--input": "#B8CCE0",
  "--ring": "#2F6FB0",
} as CSSProperties;

export function BrandScope({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`${display.variable} ${body.variable} mk-text min-h-dvh bg-background text-foreground ${className}`} style={brandVars}>
      {children}
    </div>
  );
}
