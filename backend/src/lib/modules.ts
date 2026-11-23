import { eq } from "drizzle-orm";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";

/**
 * Módulos que el sysadmin puede prender o apagar por plan desde /admin/planes.
 * Se guardan en `plans.limits.modules`; si un plan no define uno, vale el valor por defecto de abajo (abierto),
 * así los planes existentes siguen funcionando igual hasta que se toquen.
 */
export const MODULES = [
  { key: "orders", label: "Pedidos y carrito", description: "Carrito, pedidos por WhatsApp y panel de pedidos." },
  { key: "coupons", label: "Cupones de descuento", description: "Crear cupones para el carrito." },
  { key: "appointments", label: "Turnos con calendario", description: "Reservas con día y horario para servicios." },
  { key: "stats_full", label: "Estadísticas completas", description: "Rangos de 30 y 90 días, orígenes y productos más vistos. Sin esto, solo los últimos 7 días." },
  { key: "remove_branding", label: "Sin marca MiShowo", description: "Oculta el «Hecho con MiShowo» de la página pública." },
  { key: "reviews", label: "Reseñas de clientes", description: "Los clientes dejan su opinión y el negocio aprueba cuáles se muestran." },
  { key: "pixels", label: "Píxeles de Meta y Google Analytics", description: "Pixel de Meta y Google Analytics en la página, para medir y retargetear anuncios." },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];
export const MODULE_KEYS = MODULES.map((m) => m.key) as [ModuleKey, ...ModuleKey[]];

const DEFAULTS: Record<ModuleKey, boolean> = { orders: true, coupons: true, appointments: true, stats_full: true, remove_branding: false, pixels: false, reviews: true };

/** Módulos efectivos de un plan: lo que define `limits.modules`, con compatibilidad hacia atrás con `limits.appointments`. */
export function planModules(limits: unknown): Record<ModuleKey, boolean> {
  const l = (limits ?? {}) as { modules?: Partial<Record<ModuleKey, boolean>>; appointments?: boolean };
  const out = { ...DEFAULTS };
  if (l.appointments === false) out.appointments = false;
  for (const k of MODULE_KEYS) if (typeof l.modules?.[k] === "boolean") out[k] = l.modules[k]!;
  return out;
}

export async function modulesForPlan(db: Db, planId: string): Promise<Record<ModuleKey, boolean>> {
  const [p] = await db.select({ limits: s.plans.limits }).from(s.plans).where(eq(s.plans.id, planId));
  return planModules(p?.limits);
}
