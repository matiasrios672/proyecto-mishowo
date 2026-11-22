import { and, eq, gt, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import { audit } from "../audit.js";
import type { Mailer } from "../lib/mailer.js";
import type { SiteChanged } from "../lib/revalidate.js";

const dateAr = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "long", year: "numeric" });

async function ownerEmail(db: Db, ownerId: string) {
  return (await db.select({ email: s.users.email }).from(s.users).where(eq(s.users.id, ownerId)))[0]?.email ?? null;
}

/**
 * Los planes vencidos pasan al plan gratuito. Cada negocio se procesa en su propia transacción y con un UPDATE
 * condicional: si el trabajo corre dos veces a la vez (o se reintenta), un negocio nunca se degrada ni se avisa dos veces.
 * Los productos que superen el límite del plan gratuito NO se borran: quedan guardados, solo no se pueden sumar más.
 */
export async function expirePlans(db: Db, mailer: Mailer, notify: SiteChanged, now = new Date()): Promise<number> {
  const due = await db.select({ id: s.businesses.id }).from(s.businesses)
    .where(and(isNull(s.businesses.deletedAt), ne(s.businesses.planId, "gratis"), lt(s.businesses.planExpiresAt, now)));
  let done = 0;
  for (const { id } of due) {
    const res = await db.transaction(async (tx) => {
      const [b] = await tx.update(s.businesses).set({ planId: "gratis", planExpiresAt: null, planReminderFor: null })
        .where(and(eq(s.businesses.id, id), ne(s.businesses.planId, "gratis"), lt(s.businesses.planExpiresAt, now))).returning();
      return b ?? null;
    });
    if (!res) continue;
    done++;
    await audit(db, { actorId: null, action: "plan.expired", entity: "business", entityId: id, after: { plan: "gratis" } });
    const email = await ownerEmail(db, res.ownerId);
    if (email) {
      await mailer.send({ to: email, subject: "Tu plan de MiShowo venció", text: "Tu plan venció y tu página pasó al plan gratuito. Sigue publicada y no perdiste ningún dato.\n\nPodés volver a un plan pago cuando quieras desde la sección de planes." }).catch(() => undefined);
    }
    notify(res.slug);
  }
  return done;
}

/** Avisa una sola vez, unos días antes, que el plan está por vencer (se recuerda para qué vencimiento ya se avisó). */
export async function remindExpiring(db: Db, mailer: Mailer, now = new Date(), days = 7): Promise<number> {
  const limit = new Date(now.getTime() + days * 86_400_000);
  const due = await db.select({ id: s.businesses.id }).from(s.businesses).where(and(
    isNull(s.businesses.deletedAt), ne(s.businesses.planId, "gratis"), gt(s.businesses.planExpiresAt, now), lte(s.businesses.planExpiresAt, limit),
    or(isNull(s.businesses.planReminderFor), sql`${s.businesses.planReminderFor} <> ${s.businesses.planExpiresAt}`),
  ));
  let sent = 0;
  for (const { id } of due) {
    // Se "reclama" el aviso antes de mandarlo: dos corridas simultáneas no duplican el email.
    const [b] = await db.update(s.businesses).set({ planReminderFor: sql`${s.businesses.planExpiresAt}` })
      .where(and(eq(s.businesses.id, id), or(isNull(s.businesses.planReminderFor), sql`${s.businesses.planReminderFor} <> ${s.businesses.planExpiresAt}`))).returning();
    if (!b?.planExpiresAt) continue;
    const email = await ownerEmail(db, b.ownerId);
    if (!email) continue;
    sent++;
    await mailer.send({ to: email, subject: "Tu plan de MiShowo está por vencer", text: `Tu plan vence el ${dateAr(b.planExpiresAt)}. Si querés mantenerlo, avisanos tu pago desde la sección de planes antes de esa fecha.\n\nSi no lo renovás, tu página pasa al plan gratuito y sigue publicada.` }).catch(() => undefined);
  }
  return sent;
}
