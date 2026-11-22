import { z } from "zod";

// Valores válidos de diseño (el frontend tiene los detalles visuales de cada uno).
export const THEME_IDS = ["blanco", "marfil", "terracota", "nogal", "glaciar", "medianoche", "salvia", "rosa", "carbon"] as const;
export const LAYOUT_IDS = ["vidriera", "mostrador", "grilla", "servicios"] as const;
export const FONT_PAIR_IDS = ["clasica", "moderna", "calida", "limpia"] as const;

export const designSchema = z.object({
  layout: z.enum(LAYOUT_IDS),
  theme: z.enum(THEME_IDS),
  fontPair: z.enum(FONT_PAIR_IDS),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  buttonShape: z.enum(["redondeado", "pildora", "recto"]).optional(),
});
export type Design = z.infer<typeof designSchema>;
