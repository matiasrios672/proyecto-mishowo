import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import type { Mailer } from "../lib/mailer.js";
import { loadTemplate, sendTemplate } from "../mail/service.js";
import { allLeads } from "../leads/queries.js";

export const NUDGE_AFTER_DAYS = 2;
const MAX_PER_RUN = 200;

export const firstName = (name: string | null) => (name?.trim().split(/\s+/)[0] || "emprendedor/a");

/** Manda el aviso "retomá tu página" a quien se registró hace más de 2 días y no publicó: una sola vez por persona. Solo si el mail está prendido en el admin. */
export async function nudgeLeads(db: Db, mailer: Mailer, appUrl: string, log?: (m: string) => void): Promise<number> {
  if (!(await loadTemplate(db, "lead_nudge"))?.enabled) return 0; // viene apagado: se prende a propósito desde /admin/emails
  const cands = [
    ...(await allLeads(db, { stage: "sin_pagina", olderThanDays: NUDGE_AFTER_DAYS }, MAX_PER_RUN)),
    ...(await allLeads(db, { stage: "borrador", olderThanDays: NUDGE_AFTER_DAYS }, MAX_PER_RUN)),
  ].filter((l) => l.verified && !l.lastNudgeAt && !l.optedOut && !l.blocked).slice(0, MAX_PER_RUN);
  let sent = 0;
  for (const l of cands) {
    // Se "reclama" antes de mandar: dos corridas a la vez no le escriben dos veces.
    const claimed = await db.update(s.users).set({ lastNudgeAt: new Date() }).where(and(eq(s.users.id, l.id), isNull(s.users.lastNudgeAt))).returning({ id: s.users.id });
    if (claimed.length === 0) continue;
    const ok = await sendTemplate(db, mailer, "lead_nudge", l.email, { name: firstName(l.name), link: `${appUrl}/panel` }, (e) => log?.(`lead_nudge ${l.email}: ${String(e)}`));
    if (ok) sent++;
    else await db.update(s.users).set({ lastNudgeAt: sql`null` }).where(eq(s.users.id, l.id)); // apagado o falló: no se marca como avisado
  }
  return sent;
}
