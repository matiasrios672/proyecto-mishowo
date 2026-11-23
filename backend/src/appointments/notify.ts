import { and, eq, gt, inArray, isNotNull, isNull, lte } from "drizzle-orm";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import type { Mailer } from "../lib/mailer.js";
import { sendTemplate } from "../mail/service.js";

type Appt = typeof s.appointments.$inferSelect;
const AR = 3 * 3600_000; // Argentina: UTC-3 todo el año

/** Variables de los mails de turnos. Día y hora van en horario argentino. */
export function apptVars(a: Appt, businessName: string): Record<string, string> {
  const local = new Date(a.startsAt.getTime() - AR).toISOString();
  return {
    name: a.customerName, business: businessName,
    date: local.slice(0, 10).split("-").reverse().join("/"), time: local.slice(11, 16),
    service: a.service ?? "", staff: a.staffName ?? "",
    price: a.price === null ? "" : `$ ${Number(a.price).toLocaleString("es-AR")}`,
  };
}

/**
 * Recordatorio por email: a quien dejó su email y tiene un turno vigente en las próximas 24 horas, una sola vez.
 * Se "reclama" con un UPDATE antes de mandar: dos corridas a la vez no mandan dos mails.
 */
export async function remindAppointments(db: Db, mailer: Mailer, now = new Date(), log?: (m: string) => void): Promise<number> {
  const limit = new Date(now.getTime() + 24 * 3600_000);
  const due = await db.select({ a: s.appointments, biz: s.businesses.name }).from(s.appointments)
    .innerJoin(s.businesses, eq(s.businesses.id, s.appointments.businessId))
    .where(and(isNotNull(s.appointments.customerEmail), isNull(s.appointments.reminderSentAt), inArray(s.appointments.status, ["pendiente", "confirmado"]), gt(s.appointments.startsAt, now), lte(s.appointments.startsAt, limit)));
  let sent = 0;
  for (const { a, biz } of due) {
    const claimed = await db.update(s.appointments).set({ reminderSentAt: now }).where(and(eq(s.appointments.id, a.id), isNull(s.appointments.reminderSentAt))).returning({ id: s.appointments.id });
    if (claimed.length === 0) continue;
    const ok = await sendTemplate(db, mailer, "appointment_reminder", a.customerEmail!, apptVars(a, biz), (e) => log?.(`recordatorio de turno: ${String(e)}`));
    if (ok) sent++;
    else await db.update(s.appointments).set({ reminderSentAt: null }).where(eq(s.appointments.id, a.id)); // apagado o falló: se reintenta
  }
  return sent;
}
