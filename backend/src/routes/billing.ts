import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import { planModules } from "../lib/modules.js";
import { sendTemplate } from "../mail/service.js";
import type { Mailer } from "../lib/mailer.js";
import type { StorageProvider } from "../storage/index.js";
import { sniff } from "../storage/sniff.js";
import { requireUser } from "../auth/session.js";
import { getPaymentInfo } from "../billing/settings.js";
import { ownedWhere, pageSelector } from "../lib/activeBusiness.js";

export const MONTHS = [1, 3, 6, 12] as const;
export const MAX_PENDING = 3;
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

const body = z.object({
  planId: z.string().min(1).max(40),
  months: z.number().int().refine((m) => (MONTHS as readonly number[]).includes(m), "months"),
  note: z.string().trim().max(300).optional(),
});

/** Planes, pagos por transferencia y comprobantes. Se registra dentro del contexto de /me (sesión + chequeo de origen). */
export function billingRoutes(app: FastifyInstance, db: Db, storage: StorageProvider, mailer: Mailer, perMinute = 10) {
  async function business(req: Parameters<typeof requireUser>[1], reply: Parameters<typeof requireUser>[2]) {
    const user = await requireUser(db, req, reply);
    if (!user) return null;
    const [biz] = await db.select().from(s.businesses).where(ownedWhere(user.id, pageSelector(req)));
    if (!biz) { reply.code(404).send({ error: "no_business" }); return null; }
    return { user, biz };
  }

  const payView = (p: typeof s.payments.$inferSelect) => ({
    id: p.id, planId: p.planId, months: p.months, amount: Number(p.amount), status: p.status, note: p.note,
    rejectReason: p.rejectReason, hasReceipt: !!p.receiptPath, createdAt: p.createdAt, resolvedAt: p.resolvedAt,
  });

  app.get("/me/plan", async (req, reply) => {
    const ctx = await business(req, reply);
    if (!ctx) return;
    const [plans, current, pays, info] = await Promise.all([
      db.select().from(s.plans).where(eq(s.plans.active, true)).orderBy(asc(s.plans.priceMonthly)),
      db.select().from(s.plans).where(eq(s.plans.id, ctx.biz.planId)),
      db.select().from(s.payments).where(eq(s.payments.businessId, ctx.biz.id)).orderBy(desc(s.payments.createdAt)).limit(20),
      getPaymentInfo(db),
    ]);
    const exp = ctx.biz.planExpiresAt;
    reply.header("Cache-Control", "no-store");
    return {
      current: current[0] ? { id: current[0].id, name: current[0].name, limits: current[0].limits, features: current[0].features, modules: planModules(current[0].limits) } : { id: ctx.biz.planId, name: ctx.biz.planId, limits: {}, features: [], modules: planModules({}) },
      expiresAt: exp, daysLeft: exp ? Math.ceil((exp.getTime() - Date.now()) / 86_400_000) : null,
      plans: plans.map((p) => ({ id: p.id, name: p.name, priceMonthly: Number(p.priceMonthly), limits: p.limits, features: p.features, modules: planModules(p.limits) })),
      paymentInfo: info, months: MONTHS,
      payments: pays.map(payView),
    };
  });

  app.post("/me/payments", { config: { rateLimit: { max: perMinute, timeWindow: "1 minute" } } }, async (req, reply) => {
    const ctx = await business(req, reply);
    if (!ctx) return;
    const p = body.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request" });
    const [plan] = await db.select().from(s.plans).where(and(eq(s.plans.id, p.data.planId), eq(s.plans.active, true)));
    if (!plan || Number(plan.priceMonthly) <= 0) return reply.code(422).send({ error: "invalid_plan" });
    const pending = (await db.select({ n: count() }).from(s.payments).where(and(eq(s.payments.businessId, ctx.biz.id), eq(s.payments.status, "pendiente"))))[0]?.n ?? 0;
    if (pending >= MAX_PENDING) return reply.code(429).send({ error: "too_many_pending" });

    // El monto lo calcula el servidor con el precio vigente: el navegador solo elige plan y meses.
    const amount = (Math.round(Number(plan.priceMonthly) * 100) * p.data.months / 100).toFixed(2);
    const [pay] = await db.insert(s.payments).values({
      businessId: ctx.biz.id, planId: plan.id, amount, months: p.data.months, method: "transferencia", note: p.data.note || null,
    }).returning();
    await sendTemplate(db, mailer, "payment_received", ctx.user.email, {
      plan: plan.name, months: `${p.data.months} ${p.data.months === 1 ? "mes" : "meses"}`, amount: `$ ${Number(amount).toLocaleString("es-AR")}`,
    }, (e) => app.log.error({ err: e }, "no se pudo enviar el acuse de pago"));
    return reply.code(201).send(payView(pay!));
  });

  app.post<{ Params: { id: string } }>("/me/payments/:id/receipt", { config: { rateLimit: { max: perMinute * 2, timeWindow: "1 minute" } } }, async (req, reply) => {
    const ctx = await business(req, reply);
    if (!ctx) return;
    if (!z.string().uuid().safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [pay] = await db.select().from(s.payments).where(and(eq(s.payments.id, req.params.id), eq(s.payments.businessId, ctx.biz.id)));
    if (!pay) return reply.code(404).send({ error: "not_found" });
    if (pay.status !== "pendiente") return reply.code(409).send({ error: "already_resolved" });

    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "file_required" });
    const data = await file.toBuffer();
    if (file.file.truncated || data.length > RECEIPT_MAX_BYTES) return reply.code(413).send({ error: "file_too_large", maxBytes: RECEIPT_MAX_BYTES });
    const type = sniff(data);
    if (!type || type.kind === "video") return reply.code(415).send({ error: "unsupported_file" });

    const key = `receipts/${pay.id}-${randomBytes(6).toString("hex")}.${type.ext}`;
    await storage.put(key, data);
    if (pay.receiptPath) await storage.delete(pay.receiptPath).catch(() => undefined);
    await db.update(s.payments).set({ receiptPath: key }).where(eq(s.payments.id, pay.id));
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/me/payments/:id/receipt", async (req, reply) => {
    const ctx = await business(req, reply);
    if (!ctx) return;
    if (!z.string().uuid().safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [pay] = await db.select().from(s.payments).where(and(eq(s.payments.id, req.params.id), eq(s.payments.businessId, ctx.biz.id)));
    if (!pay?.receiptPath) return reply.code(404).send({ error: "not_found" });
    const data = await storage.get(pay.receiptPath);
    const type = data && sniff(data);
    if (!data || !type) return reply.code(404).send({ error: "not_found" });
    return reply
      .header("Content-Type", type.mime).header("X-Content-Type-Options", "nosniff")
      .header("Content-Security-Policy", "default-src 'none'; sandbox").header("Cache-Control", "private, no-store")
      .send(data);
  });
}
