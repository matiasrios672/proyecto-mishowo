import { z } from "zod";
import type { Db } from "../db/tenant.js";
import { getSetting } from "../lib/settings.js";
import { FONT_PAIR_IDS, LAYOUT_IDS, THEME_IDS } from "../lib/design.js";
import { INDUSTRIES, type IndustryTemplate } from "./industries.js";

export const INDUSTRY_OVERRIDES_KEY = "industry_overrides";
/** Estos dos son la red de seguridad del onboarding: siempre hay un rubro para quien no encuentra el suyo. */
export const ALWAYS_VISIBLE = ["otro-productos", "otro-servicios"];

export const overrideSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  blurb: z.string().trim().min(3).max(120).optional(),
  tagline: z.string().trim().min(3).max(200).optional(),
  theme: z.enum(THEME_IDS).optional(),
  layout: z.enum(LAYOUT_IDS).optional(),
  fontPair: z.enum(FONT_PAIR_IDS).optional(),
  hidden: z.boolean().optional(),
});
export type Override = z.infer<typeof overrideSchema>;
export const overridesSchema = z.record(z.string(), overrideSchema);

export const getOverrides = (db: Pick<Db, "select">) => getSetting(db, INDUSTRY_OVERRIDES_KEY, overridesSchema, {});

/** La plantilla con lo que el equipo cambió desde el admin (nombre, texto, tema, diseño, tipografía). El contenido de ejemplo no se toca. */
export function withOverride(t: IndustryTemplate, o: Override | undefined): IndustryTemplate {
  if (!o) return t;
  return { ...t, ...(o.name ? { name: o.name } : {}), ...(o.blurb ? { blurb: o.blurb } : {}), ...(o.tagline ? { tagline: o.tagline } : {}), ...(o.theme ? { theme: o.theme } : {}), ...(o.layout ? { layout: o.layout } : {}), ...(o.fontPair ? { fontPair: o.fontPair } : {}) };
}

export const isHidden = (id: string, o: Override | undefined) => !!o?.hidden && !ALWAYS_VISIBLE.includes(id);

export async function effectiveIndustries(db: Pick<Db, "select">): Promise<{ list: IndustryTemplate[]; overrides: Record<string, Override> }> {
  const overrides = await getOverrides(db);
  return { list: INDUSTRIES.map((t) => withOverride(t, overrides[t.id])), overrides };
}
