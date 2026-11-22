import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Suma meses de calendario en UTC: 31/1 + 1 mes = 28/2 (no 3/3). */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/**
 * Activa o renueva un plan. Si es el mismo plan y todavía está vigente, los meses se suman al vencimiento actual
 * (no se pierde lo ya pagado); si es otro plan o ya venció, cuenta desde hoy.
 * Un lock por negocio evita que dos confirmaciones simultáneas pisen una renovación con la otra.
 */
export async function activatePlan(tx: Tx, businessId: string, planId: string, months: number, now = new Date()) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"plan:" + businessId}))`);
  const [biz] = await tx.select().from(s.businesses).where(eq(s.businesses.id, businessId));
  if (!biz) throw new Error("negocio inexistente");
  const renewing = biz.planId === planId && biz.planExpiresAt !== null && biz.planExpiresAt > now;
  const startsAt = renewing ? biz.planExpiresAt! : now;
  const endsAt = addMonths(startsAt, months);
  await tx.insert(s.subscriptions).values({ businessId, planId, startsAt, endsAt });
  await tx.update(s.businesses).set({ planId, planExpiresAt: endsAt, planReminderFor: null }).where(and(eq(s.businesses.id, businessId)));
  return { business: biz, startsAt, endsAt };
}
