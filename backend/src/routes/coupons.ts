import type { FastifyInstance } from "fastify";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import { requireUser } from "../auth/session.js";
import { CouponError, normalizeCode, previewCoupon } from "../coupons/apply.js";

const DEFAULT_COUPON_LIMIT = 3; // si el plan no define limits.coupons (null = ilimitados)
const money = z.number().min(0).max(100_000_000);
const code = z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/);
const couponBody = z.object({
  code,
  kind: z.enum(["percent", "fixed"]),
  value: z.number().positive().max(100_000_000),
  minPurchase: money.default(0),
  expiresAt: z.string().datetime().nullable().default(null),
  maxUses: z.number().int().min(1).max(1_000_000).nullable().default(null),
  maxUsesPerCustomer: z.number().int().min(1).max(1000).nullable().default(null),
  active: z.boolean().default(true),
}).refine((c) => c.kind !== "percent" || c.value <= 100, { path: ["value"], message: "percent_over_100" });

const view = (c: typeof s.coupons.$inferSelect) => ({
  id: c.id, code: c.code, kind: c.kind, value: Number(c.value), minPurchase: Number(c.minPurchase), expiresAt: c.expiresAt,
  maxUses: c.maxUses, maxUsesPerCustomer: c.maxUsesPerCustomer, usedCount: c.usedCount, active: c.active, createdAt: c.createdAt,
});
const isUnique = (e: unknown) => [e, (e as { cause?: unknown })?.cause].some((x) => (x as { code?: string } | undefined)?.code === "23505");

/** CRUD de cupones del negocio (dentro del contexto de /me). */
export function couponPanelRoutes(app: FastifyInstance, db: Db) {
  async function business(req: Parameters<typeof requireUser>[1], reply: Parameters<typeof requireUser>[2]) {
    const user = await requireUser(db, req, reply);
    if (!user) return null;
    const [biz] = await db.select({ id: s.businesses.id, planId: s.businesses.planId }).from(s.businesses).where(and(eq(s.businesses.ownerId, user.id), isNull(s.businesses.deletedAt)));
    if (!biz) { reply.code(404).send({ error: "no_business" }); return null; }
    return biz;
  }
  async function limit(planId: string): Promise<number | null> {
    const [p] = await db.select({ limits: s.plans.limits }).from(s.plans).where(eq(s.plans.id, planId));
    const v = (p?.limits as { coupons?: number | null } | undefined)?.coupons;
    return v === undefined ? DEFAULT_COUPON_LIMIT : v;
  }
  const idOk = (id: string) => z.string().uuid().safeParse(id).success;

  app.get("/me/coupons", async (req, reply) => {
    const biz = await business(req, reply);
    if (!biz) return;
    const rows = await db.select().from(s.coupons).where(eq(s.coupons.businessId, biz.id)).orderBy(desc(s.coupons.createdAt));
    reply.header("Cache-Control", "no-store");
    return { coupons: rows.map(view), limit: await limit(biz.planId) };
  });

  app.post("/me/coupons", async (req, reply) => {
    const biz = await business(req, reply);
    if (!biz) return;
    const b = couponBody.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: "invalid_request" });
    const max = await limit(biz.planId);
    if (max !== null) {
      const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.coupons).where(eq(s.coupons.businessId, biz.id));
      if (n >= max) return reply.code(422).send({ error: "coupon_limit", limit: max });
    }
    try {
      const [row] = await db.insert(s.coupons).values({
        businessId: biz.id, code: normalizeCode(b.data.code), kind: b.data.kind, value: String(b.data.value), minPurchase: String(b.data.minPurchase),
        expiresAt: b.data.expiresAt ? new Date(b.data.expiresAt) : null, maxUses: b.data.maxUses, maxUsesPerCustomer: b.data.maxUsesPerCustomer, active: b.data.active,
      }).returning();
      return reply.code(201).send(view(row!));
    } catch (e) {
      if (isUnique(e)) return reply.code(409).send({ error: "code_taken" });
      throw e;
    }
  });

  app.patch<{ Params: { id: string } }>("/me/coupons/:id", async (req, reply) => {
    const biz = await business(req, reply);
    if (!biz) return;
    if (!idOk(req.params.id)) return reply.code(404).send({ error: "not_found" });
    const b = z.object({
      active: z.boolean(), expiresAt: z.string().datetime().nullable(), maxUses: z.number().int().min(1).max(1_000_000).nullable(),
      maxUsesPerCustomer: z.number().int().min(1).max(1000).nullable(), minPurchase: money,
    }).partial().safeParse(req.body);
    if (!b.success || Object.keys(b.data).length === 0) return reply.code(400).send({ error: "invalid_request" });
    const set: Partial<typeof s.coupons.$inferInsert> = {};
    if (b.data.active !== undefined) set.active = b.data.active;
    if (b.data.expiresAt !== undefined) set.expiresAt = b.data.expiresAt ? new Date(b.data.expiresAt) : null;
    if (b.data.maxUses !== undefined) set.maxUses = b.data.maxUses;
    if (b.data.maxUsesPerCustomer !== undefined) set.maxUsesPerCustomer = b.data.maxUsesPerCustomer;
    if (b.data.minPurchase !== undefined) set.minPurchase = String(b.data.minPurchase);
    const [row] = await db.update(s.coupons).set(set).where(and(eq(s.coupons.id, req.params.id), eq(s.coupons.businessId, biz.id))).returning();
    if (!row) return reply.code(404).send({ error: "not_found" });
    return view(row);
  });

  app.delete<{ Params: { id: string } }>("/me/coupons/:id", async (req, reply) => {
    const biz = await business(req, reply);
    if (!biz) return;
    if (!idOk(req.params.id)) return reply.code(404).send({ error: "not_found" });
    const r = await db.delete(s.coupons).where(and(eq(s.coupons.id, req.params.id), eq(s.coupons.businessId, biz.id))).returning({ id: s.coupons.id });
    if (r.length === 0) return reply.code(404).send({ error: "not_found" });
    return { ok: true };
  });
}

const validateBody = z.object({
  slug: z.string().min(2).max(30).regex(/^[a-z0-9-]+$/),
  code: z.string().trim().min(1).max(30),
  subtotal: z.number().min(0).max(1_000_000_000),
  customerPhone: z.string().trim().max(30).optional(),
});

/**
 * Validación en vivo desde el carrito. No sirve para adivinar códigos: límite bajo por IP y una única respuesta
 * genérica (misma forma, mismo status) para código inexistente, vencido, agotado o de otro negocio.
 */
export function publicCouponRoutes(app: FastifyInstance, db: Db, perMinute: number) {
  app.post("/public/coupons/validate", { config: { rateLimit: { max: perMinute, timeWindow: "1 minute" } } }, async (req, reply) => {
    const b = validateBody.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: "invalid_request" });
    reply.header("Cache-Control", "no-store");
    const [biz] = await db.select({ id: s.businesses.id, settings: s.businesses.settings }).from(s.businesses).where(and(eq(s.businesses.slug, b.data.slug), eq(s.businesses.status, "published"), isNull(s.businesses.deletedAt)));
    if (!biz || (biz.settings as { ordersEnabled?: boolean } | null)?.ordersEnabled === false) return { valid: false };
    try {
      const r = await previewCoupon(db, biz.id, b.data.code, Math.round(b.data.subtotal * 100), b.data.customerPhone);
      return { valid: true, code: r.code, kind: r.kind, value: r.value, discount: r.discountCents / 100 };
    } catch (e) {
      if (e instanceof CouponError) return e.code === "coupon_min_purchase" ? { valid: false, reason: "min_purchase", minPurchase: e.extra.minPurchase } : { valid: false };
      throw e;
    }
  });
}
