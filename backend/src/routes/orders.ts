import type { FastifyInstance } from "fastify";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/tenant.js";
import type { Mailer } from "../lib/mailer.js";
import { notifyOwner } from "../orders/notify.js";
import * as s from "../db/schema.js";
import { CouponError, redeemCoupon } from "../coupons/apply.js";

const line = z.object({
  productId: z.string().uuid(),
  optionId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(99),
});

const body = z.object({
  slug: z.string().min(2).max(30).regex(/^[a-z0-9-]+$/),
  items: z.array(line).min(1).max(50),
  customerName: z.string().trim().max(80).optional(),
  customerPhone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(500).optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  source: z.string().trim().max(40).optional(),
  couponCode: z.string().trim().max(30).optional(),
});

class OrderError extends Error {
  constructor(public status: number, public code: string, public extra: Record<string, unknown> = {}) {
    super(code);
  }
}

const toCents = (v: string | null) => (v === null ? 0 : Math.round(Number(v) * 100));
const fromCents = (c: number) => (c / 100).toFixed(2);

/**
 * Registra un pedido. Los precios, la disponibilidad y el stock se calculan SIEMPRE acá,
 * desde la base: del navegador solo se aceptan ids y cantidades.
 */
export function orderRoutes(app: FastifyInstance, db: Db, perMinute = 20, mailer?: Mailer, appUrl = "") {
  app.post("/public/orders", { config: { rateLimit: { max: perMinute, timeWindow: "1 minute" } } }, async (req, reply) => {
    const parsed = body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    const input = parsed.data;

    try {
      const result = await db.transaction(async (tx) => {
        const [biz] = await tx.select().from(s.businesses)
          .where(and(eq(s.businesses.slug, input.slug), isNull(s.businesses.deletedAt)));
        if (!biz || biz.status === "draft") throw new OrderError(404, "not_found");
        if (biz.status !== "published") throw new OrderError(409, "unavailable_business");

        const settings = (biz.settings ?? {}) as { askEventDate?: boolean; ordersEnabled?: boolean };
        if (settings.ordersEnabled === false) throw new OrderError(409, "orders_disabled");
        if (settings.askEventDate && !input.eventDate) throw new OrderError(422, "event_date_required");

        // Serializa pedidos del mismo negocio: numeración correlativa y stock sin carreras.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${biz.id}))`);

        const productIds = [...new Set(input.items.map((i) => i.productId))];
        const products = await tx.select().from(s.products)
          .where(and(eq(s.products.businessId, biz.id), inArray(s.products.id, productIds)));
        const options = await tx.select().from(s.productOptions)
          .where(and(eq(s.productOptions.businessId, biz.id), inArray(s.productOptions.productId, productIds)));
        const pById = new Map(products.map((p) => [p.id, p]));

        const lines: { productId: string; optionId: string | null; name: string; optionLabel: string | null; unitCents: number; quantity: number }[] = [];
        const wantProduct = new Map<string, number>();
        const wantOption = new Map<string, number>();

        for (const it of input.items) {
          const p = pById.get(it.productId);
          if (!p || !p.available) throw new OrderError(422, "unavailable", { productId: it.productId });
          const opts = options.filter((o) => o.productId === p.id);
          let opt: (typeof opts)[number] | undefined;
          if (opts.length > 0) {
            opt = opts.find((o) => o.id === it.optionId);
            if (!opt || opt.soldOut) throw new OrderError(422, "option_required", { productId: p.id });
          } else if (it.optionId) {
            throw new OrderError(422, "invalid_option", { productId: p.id });
          }
          const unit = opt && opt.price !== null ? opt.price : p.price;
          lines.push({ productId: p.id, optionId: opt?.id ?? null, name: p.name, optionLabel: opt?.label ?? null, unitCents: toCents(unit), quantity: it.quantity });
          if (opt && opt.stock !== null) wantOption.set(opt.id, (wantOption.get(opt.id) ?? 0) + it.quantity);
          else if (p.stock !== null) wantProduct.set(p.id, (wantProduct.get(p.id) ?? 0) + it.quantity);
        }

        // Stock: se descuenta al registrar el pedido (si se cancela, se repone en la Épica 9).
        for (const [id, qty] of wantProduct) {
          const r = await tx.update(s.products).set({ stock: sql`${s.products.stock} - ${qty}` })
            .where(and(eq(s.products.id, id), eq(s.products.businessId, biz.id), sql`${s.products.stock} >= ${qty}`)).returning({ stock: s.products.stock });
          if (r.length === 0) throw new OrderError(409, "out_of_stock", { productId: id });
        }
        for (const [id, qty] of wantOption) {
          const r = await tx.update(s.productOptions).set({ stock: sql`${s.productOptions.stock} - ${qty}` })
            .where(and(eq(s.productOptions.id, id), eq(s.productOptions.businessId, biz.id), sql`${s.productOptions.stock} >= ${qty}`)).returning({ stock: s.productOptions.stock });
          if (r.length === 0) throw new OrderError(409, "out_of_stock", { optionId: id });
        }

        const subtotalCents = lines.reduce((sum, l) => sum + l.unitCents * l.quantity, 0);
        // El descuento se calcula acá, con el cupón de la base: del navegador solo llega el código.
        let coupon: Awaited<ReturnType<typeof redeemCoupon>> | null = null;
        if (input.couponCode) coupon = await redeemCoupon(tx, biz.id, input.couponCode, subtotalCents, input.customerPhone);
        const totalCents = Math.max(0, subtotalCents - (coupon?.discountCents ?? 0));
        const nextRows = (await tx.execute(sql`select coalesce(max(number), 0) + 1 as next from orders where business_id = ${biz.id}`)).rows as { next: number }[];
        const number = Number(nextRows[0]?.next ?? 1);

        const [order] = await tx.insert(s.orders).values({
          businessId: biz.id, number, total: fromCents(totalCents),
          customerName: input.customerName || null, customerPhone: input.customerPhone || null,
          notes: input.notes || null, eventDate: input.eventDate ?? null, source: input.source ?? null,
          couponId: coupon?.couponId ?? null, couponCode: coupon?.code ?? null, discount: fromCents(coupon?.discountCents ?? 0),
        }).returning();
        if (coupon) await tx.insert(s.couponRedemptions).values({ businessId: biz.id, couponId: coupon.couponId, orderId: order!.id, customerKey: coupon.customerKey });
        await tx.insert(s.orderItems).values(lines.map((l) => ({
          businessId: biz.id, orderId: order!.id, productId: l.productId, optionId: l.optionId, name: l.name,
          optionLabel: l.optionLabel, unitPrice: fromCents(l.unitCents), quantity: l.quantity,
        })));

        return {
          ownerId: biz.ownerId, businessName: biz.name,
          number, total: Number(fromCents(totalCents)), subtotal: subtotalCents / 100,
          discount: (coupon?.discountCents ?? 0) / 100, couponCode: coupon?.code ?? null,
          items: lines.map((l) => ({ name: l.name, optionLabel: l.optionLabel, unitPrice: l.unitCents / 100, quantity: l.quantity })),
          eventDate: input.eventDate ?? null, customerName: input.customerName || null, notes: input.notes || null,
        };
      });
      const { ownerId, businessName, ...publicResult } = result;
      if (mailer) void notifyOwner(db, mailer, ownerId, businessName, publicResult, appUrl, (e) => app.log.error({ err: e }, "no se pudo avisar del pedido"));
      return reply.code(201).send(publicResult);
    } catch (e) {
      if (e instanceof OrderError) return reply.code(e.status).send({ error: e.code, ...e.extra });
      if (e instanceof CouponError) return reply.code(422).send({ error: e.code, ...e.extra });
      throw e;
    }
  });
}
