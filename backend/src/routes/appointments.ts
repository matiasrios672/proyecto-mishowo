import type { FastifyInstance } from "fastify";
import { and, asc, eq, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/tenant.js";
import type { Mailer } from "../lib/mailer.js";
import * as s from "../db/schema.js";
import { requireUser } from "../auth/session.js";
import { addDays, daySlots, isDate, isTime, todayAR, toInstant } from "../appointments/slots.js";

const DEFAULTS = { slotMinutes: 30, minNoticeHours: 2, capacity: 1, horizonDays: 30, services: [] as string[] };
const settingsBody = z.object({
  enabled: z.boolean(),
  slotMinutes: z.number().int().min(10).max(240),
  minNoticeHours: z.number().int().min(0).max(168),
  capacity: z.number().int().min(1).max(20),
  horizonDays: z.number().int().min(1).max(90),
  services: z.array(z.string().trim().min(1).max(60)).max(10),
});
const slug = z.string().min(2).max(30).regex(/^[a-z0-9-]+$/);

async function loadSettings(db: Db, businessId: string) {
  const [row] = await db.select().from(s.appointmentSettings).where(eq(s.appointmentSettings.businessId, businessId));
  return row ? { enabled: row.enabled, slotMinutes: row.slotMinutes, minNoticeHours: row.minNoticeHours, capacity: row.capacity, horizonDays: row.horizonDays, services: row.services as string[] } : { enabled: false, ...DEFAULTS };
}

/** Plan: limits.appointments (boolean). Si el plan no lo define, los turnos están permitidos. */
async function allowedByPlan(db: Db, planId: string) {
  const [p] = await db.select({ limits: s.plans.limits }).from(s.plans).where(eq(s.plans.id, planId));
  return (p?.limits as { appointments?: boolean } | undefined)?.appointments !== false;
}


/** Panel de turnos del negocio (dentro del contexto de /me). */
export function appointmentPanelRoutes(app: FastifyInstance, db: Db) {
  async function business(req: Parameters<typeof requireUser>[1], reply: Parameters<typeof requireUser>[2]) {
    const user = await requireUser(db, req, reply);
    if (!user) return null;
    const [biz] = await db.select({ id: s.businesses.id, planId: s.businesses.planId }).from(s.businesses).where(and(eq(s.businesses.ownerId, user.id), isNull(s.businesses.deletedAt)));
    if (!biz) { reply.code(404).send({ error: "no_business" }); return null; }
    return biz;
  }
  const view = (a: typeof s.appointments.$inferSelect) => ({
    id: a.id, startsAt: a.startsAt, customerName: a.customerName, customerPhone: a.customerPhone, service: a.service, notes: a.notes, status: a.status,
    date: new Date(a.startsAt.getTime() - 3 * 3600_000).toISOString().slice(0, 10), time: new Date(a.startsAt.getTime() - 3 * 3600_000).toISOString().slice(11, 16),
  });

  app.get("/me/appointments/settings", async (req, reply) => {
    const biz = await business(req, reply);
    if (!biz) return;
    reply.header("Cache-Control", "no-store");
    return { ...(await loadSettings(db, biz.id)), allowedByPlan: await allowedByPlan(db, biz.planId) };
  });

  app.put("/me/appointments/settings", async (req, reply) => {
    const biz = await business(req, reply);
    if (!biz) return;
    const b = settingsBody.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: "invalid_request" });
    if (b.data.enabled && !(await allowedByPlan(db, biz.planId))) return reply.code(403).send({ error: "plan_not_allowed" });
    await db.insert(s.appointmentSettings).values({ businessId: biz.id, ...b.data })
      .onConflictDoUpdate({ target: s.appointmentSettings.businessId, set: { ...b.data, updatedAt: new Date() } });
    return loadSettings(db, biz.id);
  });

  app.get("/me/appointments", async (req, reply) => {
    const biz = await business(req, reply);
    if (!biz) return;
    const q = z.object({ date: z.string().optional(), status: z.enum(["pendiente", "confirmado", "cancelado"]).optional() }).safeParse(req.query);
    if (!q.success || (q.data.date && !isDate(q.data.date))) return reply.code(400).send({ error: "invalid_request" });
    // Con fecha: ese día. Sin fecha: de hoy en adelante.
    const from = toInstant(q.data.date ?? todayAR(), "00:00");
    const to = q.data.date ? toInstant(addDays(q.data.date, 1), "00:00") : null;
    const rows = await db.select().from(s.appointments)
      .where(and(eq(s.appointments.businessId, biz.id), gte(s.appointments.startsAt, from), to ? lt(s.appointments.startsAt, to) : undefined, q.data.status ? eq(s.appointments.status, q.data.status) : undefined))
      .orderBy(asc(s.appointments.startsAt)).limit(300);
    reply.header("Cache-Control", "no-store");
    return { appointments: rows.map(view) };
  });

  app.patch<{ Params: { id: string } }>("/me/appointments/:id/status", async (req, reply) => {
    const biz = await business(req, reply);
    if (!biz) return;
    const b = z.object({ status: z.enum(["confirmado", "cancelado"]) }).safeParse(req.body);
    if (!b.success || !z.string().uuid().safeParse(req.params.id).success) return reply.code(400).send({ error: "invalid_request" });
    // Transición válida en el propio UPDATE: pendiente -> confirmado | cancelado, confirmado -> cancelado. Cancelado es final.
    const from = b.data.status === "confirmado" ? ["pendiente"] : ["pendiente", "confirmado"];
    const [row] = await db.update(s.appointments).set({ status: b.data.status })
      .where(and(eq(s.appointments.id, req.params.id), eq(s.appointments.businessId, biz.id), inArray(s.appointments.status, from))).returning();
    if (!row) {
      const [exists] = await db.select({ status: s.appointments.status }).from(s.appointments).where(and(eq(s.appointments.id, req.params.id), eq(s.appointments.businessId, biz.id)));
      return reply.code(exists ? 409 : 404).send({ error: exists ? "invalid_transition" : "not_found" });
    }
    return view(row);
  });
}

const slotsQuery = z.object({ date: z.string() });
const bookBody = z.object({
  slug,
  date: z.string(),
  time: z.string(),
  customerName: z.string().trim().min(2).max(80),
  customerPhone: z.string().trim().min(6).max(30).regex(/^[\d\s+()\-]+$/),
  service: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(300).optional(),
});

/** Reserva pública de turnos. */
export function publicAppointmentRoutes(app: FastifyInstance, db: Db, perMinute: number, mailer?: Mailer, appUrl = "") {
  async function publishedBiz(slugValue: string) {
    const [b] = await db.select().from(s.businesses).where(and(eq(s.businesses.slug, slugValue), eq(s.businesses.status, "published"), isNull(s.businesses.deletedAt)));
    return b;
  }

  /** Configuración visible para el cliente. */
  app.get<{ Params: { slug: string } }>("/public/sites/:slug/booking", async (req, reply) => {
    const p = slug.safeParse(req.params.slug);
    const biz = p.success ? await publishedBiz(p.data) : undefined;
    reply.header("Cache-Control", "public, max-age=30");
    if (!biz) return reply.code(404).send({ error: "not_found" });
    const cfg = await loadSettings(db, biz.id);
    const enabled = cfg.enabled && (await allowedByPlan(db, biz.planId));
    return enabled ? { enabled: true, slotMinutes: cfg.slotMinutes, horizonDays: cfg.horizonDays, services: cfg.services, minDate: todayAR() } : { enabled: false };
  });

  /** Horarios de un día con cupos libres. */
  app.get<{ Params: { slug: string } }>("/public/sites/:slug/booking/slots", { config: { rateLimit: { max: perMinute * 6, timeWindow: "1 minute" } } }, async (req, reply) => {
    const p = slug.safeParse(req.params.slug);
    const q = slotsQuery.safeParse(req.query);
    if (!p.success || !q.success || !isDate(q.data.date)) return reply.code(400).send({ error: "invalid_request" });
    const biz = await publishedBiz(p.data);
    if (!biz) return reply.code(404).send({ error: "not_found" });
    const cfg = await loadSettings(db, biz.id);
    reply.header("Cache-Control", "no-store");
    if (!cfg.enabled || !(await allowedByPlan(db, biz.planId))) return { slots: [] };
    const now = Date.now();
    const limitDate = addDays(todayAR(), cfg.horizonDays);
    if (q.data.date > limitDate) return { slots: [] };
    const from = toInstant(q.data.date, "00:00"), to = toInstant(addDays(q.data.date, 1), "00:00");
    const taken = await db.select({ startsAt: s.appointments.startsAt, n: sql<number>`count(*)::int` }).from(s.appointments)
      .where(and(eq(s.appointments.businessId, biz.id), gte(s.appointments.startsAt, from), lt(s.appointments.startsAt, to), ne(s.appointments.status, "cancelado")))
      .groupBy(s.appointments.startsAt);
    const takenBy = new Map(taken.map((t) => [t.startsAt.getTime(), t.n]));
    const slots = daySlots(q.data.date, biz.hours, cfg.slotMinutes)
      .filter((t) => toInstant(q.data.date, t).getTime() >= now + cfg.minNoticeHours * 3600_000)
      .map((t) => ({ time: t, left: Math.max(0, cfg.capacity - (takenBy.get(toInstant(q.data.date, t).getTime()) ?? 0)) }));
    return { slots };
  });

  app.post("/public/appointments", { config: { rateLimit: { max: perMinute, timeWindow: "1 minute" } } }, async (req, reply) => {
    const b = bookBody.safeParse(req.body);
    if (!b.success || !isDate(b.data.date) || !isTime(b.data.time)) return reply.code(400).send({ error: "invalid_request" });
    const biz = await publishedBiz(b.data.slug);
    if (!biz) return reply.code(404).send({ error: "not_found" });
    const cfg = await loadSettings(db, biz.id);
    if (!cfg.enabled || !(await allowedByPlan(db, biz.planId))) return reply.code(409).send({ error: "booking_disabled" });
    if (cfg.services.length > 0 && b.data.service && !cfg.services.includes(b.data.service)) return reply.code(422).send({ error: "invalid_service" });

    const startsAt = toInstant(b.data.date, b.data.time);
    // Solo se puede reservar una franja que el negocio realmente ofrece, con la anticipación pedida y dentro del horizonte.
    const valid = daySlots(b.data.date, biz.hours, cfg.slotMinutes).includes(b.data.time)
      && startsAt.getTime() >= Date.now() + cfg.minNoticeHours * 3600_000 && b.data.date <= addDays(todayAR(), cfg.horizonDays);
    if (!valid) return reply.code(422).send({ error: "slot_unavailable" });
    const endsAt = new Date(startsAt.getTime() + cfg.slotMinutes * 60_000);

    const created = await db.transaction(async (tx) => {
      // Serializa las reservas del negocio: dos personas no pueden quedarse con el mismo cupo.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"appt:" + biz.id}))`);
      const [{ n } = { n: 0 }] = await tx.select({ n: sql<number>`count(*)::int` }).from(s.appointments)
        .where(and(eq(s.appointments.businessId, biz.id), eq(s.appointments.startsAt, startsAt), ne(s.appointments.status, "cancelado")));
      if (n >= cfg.capacity) return null;
      // Una misma persona no puede acaparar: un solo turno vigente por teléfono en la misma franja.
      const phoneKey = b.data.customerPhone.replace(/\D/g, "");
      const same = await tx.select({ phone: s.appointments.customerPhone }).from(s.appointments)
        .where(and(eq(s.appointments.businessId, biz.id), eq(s.appointments.startsAt, startsAt), ne(s.appointments.status, "cancelado")));
      if (same.some((r) => r.phone.replace(/\D/g, "") === phoneKey)) return "duplicate" as const;
      const [row] = await tx.insert(s.appointments).values({
        businessId: biz.id, startsAt, endsAt, customerName: b.data.customerName, customerPhone: b.data.customerPhone,
        service: b.data.service || null, notes: b.data.notes || null,
      }).returning();
      return row!;
    });
    if (created === null) return reply.code(409).send({ error: "slot_taken" });
    if (created === "duplicate") return reply.code(409).send({ error: "already_booked" });

    if (mailer) {
      void (async () => {
        const [owner] = await db.select({ email: s.users.email }).from(s.users).where(eq(s.users.id, biz.ownerId));
        if (!owner) return;
        await mailer.send({
          to: owner.email, subject: `Nuevo turno: ${b.data.date} ${b.data.time}`,
          text: [`Reservaron un turno en ${biz.name}`, `Día y hora: ${b.data.date} a las ${b.data.time}`, `Cliente: ${b.data.customerName}`, ...(b.data.service ? [`Servicio: ${b.data.service}`] : []), ...(b.data.notes ? [`Aclaraciones: ${b.data.notes}`] : []), "", `Confirmarlo o cancelarlo: ${appUrl}/panel/turnos`].join("\n"),
        });
      })().catch((e) => app.log.error({ err: e }, "no se pudo avisar del turno")); // sin datos personales en el log
    }
    return reply.code(201).send({ id: created.id, date: b.data.date, time: b.data.time, status: created.status });
  });
}
