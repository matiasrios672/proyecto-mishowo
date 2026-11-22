import type { CSSProperties } from "react";

export type ThemeId =
  | "blanco" | "marfil" | "terracota" | "nogal" | "glaciar"
  | "medianoche" | "salvia" | "rosa" | "carbon";

export interface Theme {
  id: ThemeId;
  name: string;
  suggestedFor: string;
  dark: boolean;
  bg: string;
  fg: string;
  card: string;
  primary: string;
  primaryFg: string;
  muted: string;
  mutedFg: string;
  border: string;
  /** Color de error/agotado legible sobre el fondo y la tarjeta del tema. */
  danger: string;
}

const RAW: Omit<Theme, "danger">[] = [
  { id: "blanco", name: "Blanco", suggestedFor: "Cualquier rubro", dark: false,
    bg: "#FFFFFF", fg: "#171717", card: "#FFFFFF", primary: "#171717", primaryFg: "#FFFFFF",
    muted: "#F4F4F5", mutedFg: "#52525B", border: "#E4E4E7" },
  { id: "marfil", name: "Marfil", suggestedFor: "Deco, muebles, eventos", dark: false,
    bg: "#FBF7EF", fg: "#2B2620", card: "#FFFDF8", primary: "#7A4F24", primaryFg: "#FFFFFF",
    muted: "#F1EADB", mutedFg: "#5E5446", border: "#E3D9C4" },
  { id: "terracota", name: "Terracota", suggestedFor: "Rotisería, gastronomía", dark: false,
    bg: "#FBF1EC", fg: "#3A1F16", card: "#FFF9F6", primary: "#AE432A", primaryFg: "#FFFFFF",
    muted: "#F4E1D8", mutedFg: "#6A4538", border: "#EBCFC2" },
  { id: "nogal", name: "Nogal", suggestedFor: "Carpintería, oficios", dark: false,
    bg: "#F5EDE4", fg: "#2A1B12", card: "#FBF6F0", primary: "#5C3A21", primaryFg: "#FFFFFF",
    muted: "#E9DCCD", mutedFg: "#5A4637", border: "#DAC8B4" },
  { id: "glaciar", name: "Glaciar", suggestedFor: "Salud, profesionales", dark: false,
    bg: "#F0F6FA", fg: "#0F2433", card: "#FAFCFE", primary: "#1B6390", primaryFg: "#FFFFFF",
    muted: "#DFEAF2", mutedFg: "#40596B", border: "#C9DAE6" },
  { id: "medianoche", name: "Medianoche", suggestedFor: "Eventos, gimnasios", dark: true,
    bg: "#0F1626", fg: "#EEF1F8", card: "#171F33", primary: "#8DB2FF", primaryFg: "#0B1020",
    muted: "#1E2840", mutedFg: "#A9B4CC", border: "#2A3654" },
  { id: "salvia", name: "Salvia", suggestedFor: "Bienestar, plantas", dark: false,
    bg: "#F2F5EE", fg: "#1F2A1C", card: "#FAFCF7", primary: "#46673B", primaryFg: "#FFFFFF",
    muted: "#E3EADB", mutedFg: "#485543", border: "#D0DBC5" },
  { id: "rosa", name: "Rosa", suggestedFor: "Belleza, estética, ropa", dark: false,
    bg: "#FDF1F4", fg: "#3A1620", card: "#FFF8FA", primary: "#B8335D", primaryFg: "#FFFFFF",
    muted: "#F8DFE6", mutedFg: "#6A3E4A", border: "#F0C9D4" },
  { id: "carbon", name: "Carbón", suggestedFor: "Indumentaria, barbería", dark: true,
    bg: "#1A1A1A", fg: "#F2F2F2", card: "#242424", primary: "#F5C542", primaryFg: "#1A1A1A",
    muted: "#2E2E2E", mutedFg: "#B5B5B5", border: "#3A3A3A" },
];

export const THEMES: Theme[] = RAW.map((t) => ({ ...t, danger: t.dark ? "#FF8A80" : "#B42318" }));

export const DEFAULT_THEME: ThemeId = "blanco";

export function getTheme(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}

// ---- contraste (WCAG) ----
function channel(v: number) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
export const isValidHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

/** Elige texto blanco o casi negro según cuál contraste más con el color dado. */
export function readableOn(hex: string): string {
  return contrast(hex, "#FFFFFF") >= contrast(hex, "#111111") ? "#FFFFFF" : "#111111";
}

/**
 * Variables CSS de un tema para aplicar con `style` en el contenedor de la página.
 * Si hay color de marca válido, reemplaza el primario y recalcula el texto sobre él.
 */
export function themeStyle(id: string | null | undefined, brandColor?: string | null): CSSProperties {
  const t = getTheme(id);
  const hasBrand = !!brandColor && isValidHex(brandColor);
  const primary = hasBrand ? brandColor : t.primary;
  const primaryFg = hasBrand ? readableOn(brandColor) : t.primaryFg;
  return {
    "--background": t.bg,
    "--foreground": t.fg,
    "--card": t.card,
    "--card-foreground": t.fg,
    "--popover": t.card,
    "--popover-foreground": t.fg,
    "--primary": primary,
    "--primary-foreground": primaryFg,
    "--secondary": t.muted,
    "--secondary-foreground": t.fg,
    "--muted": t.muted,
    "--muted-foreground": t.mutedFg,
    "--accent": t.muted,
    "--accent-foreground": t.fg,
    "--destructive": t.danger,
    "--border": t.border,
    "--input": t.border,
    "--ring": primary,
    colorScheme: t.dark ? "dark" : "light",
  } as CSSProperties;
}
