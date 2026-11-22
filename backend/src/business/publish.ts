import { eq } from "drizzle-orm";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import { normalizeWhatsapp } from "../lib/whatsapp.js";
import type { Content } from "./content.js";

export type Missing = "name" | "whatsapp" | "products";

export const realProducts = (c: Content) => c.categories.flatMap((x) => x.products).filter((p) => !p.isExample && p.name.trim().length > 0);

/** Lo mínimo para publicar: nombre propio, un WhatsApp válido y al menos un producto o servicio propio. */
export function missingForPublish(c: Content): Missing[] {
  const missing: Missing[] = [];
  if (c.nameIsExample || c.name.trim().length < 2) missing.push("name");
  if (!normalizeWhatsapp(c.whatsapp)) missing.push("whatsapp");
  if (realProducts(c).length === 0) missing.push("products");
  return missing;
}

/** Límites del plan, editables desde el admin (tabla `plans`). null = sin límite o plan desconocido. */
export async function productLimit(db: Pick<Db, "select">, planId: string): Promise<number | null> {
  const [plan] = await db.select({ limits: s.plans.limits }).from(s.plans).where(eq(s.plans.id, planId));
  const limit = (plan?.limits as { products?: number | null } | undefined)?.products;
  return typeof limit === "number" ? limit : null;
}
