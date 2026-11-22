import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "./../db/tenant.js";
import * as s from "../db/schema.js";

// Ajustes globales editables desde el admin. Viven en app_settings (clave → JSON); la base es la fuente de verdad.
export const RESERVED_KEY = "reserved_slugs";
export const CMS_KEY = "cms";
export const MAINTENANCE_KEY = "maintenance";
export const CRON_KEY = "cron_last_run";

export const reservedSlugsSchema = z.object({
  slugs: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/, "slug")).max(300),
});

const faqItem = z.object({ q: z.string().trim().min(3).max(140), a: z.string().trim().min(3).max(900) });
export const cmsSchema = z.object({
  /** Vacío = la landing usa su FAQ por defecto. */
  faq: z.array(faqItem).max(20).default([]),
  banner: z.object({
    enabled: z.boolean().default(false),
    text: z.string().trim().max(160).default(""),
    // Solo links relativos o https: nada de javascript: ni data:
    link: z.string().trim().max(200).regex(/^(\/(?!\/)[^\s]*|https:\/\/[^\s]+)?$/, "link").default(""),
  }).default({ enabled: false, text: "", link: "" }),
});
export type Cms = z.infer<typeof cmsSchema>;

export const maintenanceSchema = z.object({
  enabled: z.boolean().default(false),
  message: z.string().trim().max(200).default(""),
});
export type Maintenance = z.infer<typeof maintenanceSchema>;
export const DEFAULT_MAINTENANCE_MESSAGE = "Estamos haciendo mejoras. Volvé a intentar en unos minutos.";

type Reader = Pick<Db, "select">;
const raw = async (db: Reader, key: string) => (await db.select().from(s.appSettings).where(eq(s.appSettings.key, key)))[0]?.value ?? {};

/** Slugs reservados por el admin (se suman a los fijos de lib/slug). */
export async function getReservedSlugs(db: Reader): Promise<string[]> {
  const p = reservedSlugsSchema.safeParse(await raw(db, RESERVED_KEY));
  return p.success ? p.data.slugs : [];
}
export async function getCms(db: Reader): Promise<Cms> {
  const p = cmsSchema.safeParse(await raw(db, CMS_KEY));
  return p.success ? p.data : cmsSchema.parse({});
}
export async function getMaintenance(db: Reader): Promise<Maintenance> {
  const p = maintenanceSchema.safeParse(await raw(db, MAINTENANCE_KEY));
  return p.success ? p.data : { enabled: false, message: "" };
}

export async function putSetting(db: Pick<Db, "insert">, key: string, value: unknown) {
  await db.insert(s.appSettings).values({ key, value: value as never })
    .onConflictDoUpdate({ target: s.appSettings.key, set: { value: value as never, updatedAt: sql`now()` } });
}
