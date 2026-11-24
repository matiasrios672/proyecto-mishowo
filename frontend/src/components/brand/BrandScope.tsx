import type { CSSProperties, ReactNode } from "react";
import { ConfirmHost } from "@/components/feedback/confirm";
import { Toaster } from "@/components/feedback/Toaster";
import { Bricolage_Grotesque, Figtree } from "next/font/google";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-mk-display", display: "swap" });
const body = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-mk-text", display: "swap" });

/** Identidad de MiShowo: naranja vivo sobre tinta (texto de botón en tinta: sobre #FC5502 el blanco no llega a AA). Se usa en login, panel del cliente y admin (las páginas de cada negocio llevan la suya). */
export const brandVars = {
  "--background": "#FFFBF8",
  "--foreground": "#0E1B2C",
  "--primary": "#D14300",
  "--primary-foreground": "#FFFFFF",
  "--muted": "#FFEFE6",
  "--muted-foreground": "#47566A",
  "--border": "#F5D9C8",
  "--input": "#E8C4AA",
  "--ring": "#C73E00",
} as CSSProperties;

export function BrandScope({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`${display.variable} ${body.variable} mk-text min-h-dvh bg-background text-foreground ${className}`} style={brandVars}>
      {children}
      <Toaster />
      <ConfirmHost />
    </div>
  );
}
