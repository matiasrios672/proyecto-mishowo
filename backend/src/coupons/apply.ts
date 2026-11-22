import { and, eq, sql } from "drizzle-orm";
import * as s from "../db/schema.js";

// Todo en centavos: nada de decimales flotantes en dinero.
const toCents = (v: string | number) => Math.round(Number(v) * 100);

export const normalizeCode = (code: string) => code.trim().toUpperCase();
export const customerKeyOf = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "");

export class CouponError extends Error {
  constructor(public code: "coupon_invalid" | "coupon_min_purchase", public extra: Record<string, unknown> = {}) { super(code); }
}

type Row = typeof s.coupons.$inferSelect;
// El caller pasa db o tx: solo hace falta poder consultar y actualizar.
type Q = Pick<import("../db/tenant.js").Db, "select" | "update" | "insert" | "delete">;

/** Descuento en centavos. Nunca supera el subtotal (el total jamás queda negativo). */
export function discountCents(c: Pick<Row, "kind" | "value">, subtotalCents: number): number {
  const raw = c.kind === "percent" ? Math.floor((subtotalCents * Number(c.value)) / 100) : toCents(c.value);
  return Math.max(0, Math.min(raw, subtotalCents));
}

/** Reglas que no dependen de contadores: existe, activo, vigente y llega al mínimo. Los errores de código son genéricos a propósito (no se pueden enumerar cupones). */
export function checkRules(c: Row | undefined, subtotalCents: number, now = new Date()): asserts c is Row {
  if (!c || !c.active || (c.expiresAt && c.expiresAt.getTime() <= now.getTime())) throw new CouponError("coupon_invalid");
  const min = toCents(c.minPurchase);
  if (subtotalCents < min) throw new CouponError("coupon_min_purchase", { minPurchase: min / 100 });
}

export async function findCoupon(q: Q, businessId: string, code: string) {
  const [c] = await q.select().from(s.coupons).where(and(eq(s.coupons.businessId, businessId), eq(s.coupons.code, normalizeCode(code))));
  return c;
}

async function checkPerCustomer(q: Q, c: Row, phone?: string | null) {
  if (c.maxUsesPerCustomer === null) return;
  const key = customerKeyOf(phone);
  if (!key) throw new CouponError("coupon_invalid"); // sin teléfono no se puede aplicar un tope por cliente
  const [{ n } = { n: 0 }] = await q.select({ n: sql<number>`count(*)::int` }).from(s.couponRedemptions)
    .where(and(eq(s.couponRedemptions.couponId, c.id), eq(s.couponRedemptions.customerKey, key)));
  if (n >= c.maxUsesPerCustomer) throw new CouponError("coupon_invalid");
}

/** Vista previa para el carrito: no consume el cupón. */
export async function previewCoupon(q: Q, businessId: string, code: string, subtotalCents: number, phone?: string | null) {
  const c = await findCoupon(q, businessId, code);
  checkRules(c, subtotalCents);
  if (c.maxUses !== null && c.usedCount >= c.maxUses) throw new CouponError("coupon_invalid");
  await checkPerCustomer(q, c, phone);
  return { code: c.code, kind: c.kind, value: Number(c.value), discountCents: discountCents(c, subtotalCents) };
}

/**
 * Canjea el cupón dentro de la transacción del pedido. El tope de usos se hace cumplir en el propio UPDATE
 * (`used_count < max_uses`): aunque dos pedidos corran a la vez, solo uno gana el último uso.
 */
export async function redeemCoupon(q: Q, businessId: string, code: string, subtotalCents: number, phone: string | null | undefined) {
  const c = await findCoupon(q, businessId, code);
  checkRules(c, subtotalCents);
  await checkPerCustomer(q, c, phone);
  const claimed = await q.update(s.coupons).set({ usedCount: sql`${s.coupons.usedCount} + 1` })
    .where(and(eq(s.coupons.id, c.id), eq(s.coupons.active, true), sql`(${s.coupons.maxUses} is null or ${s.coupons.usedCount} < ${s.coupons.maxUses})`))
    .returning({ id: s.coupons.id });
  if (claimed.length === 0) throw new CouponError("coupon_invalid");
  return { couponId: c.id, code: c.code, discountCents: discountCents(c, subtotalCents), customerKey: customerKeyOf(phone) };
}

/** Si el pedido se cancela, el uso vuelve a estar disponible. */
export async function releaseCoupon(q: Q, businessId: string, orderId: string) {
  const gone = await q.delete(s.couponRedemptions)
    .where(and(eq(s.couponRedemptions.orderId, orderId), eq(s.couponRedemptions.businessId, businessId))).returning({ couponId: s.couponRedemptions.couponId });
  for (const r of gone) {
    await q.update(s.coupons).set({ usedCount: sql`greatest(${s.coupons.usedCount} - 1, 0)` }).where(and(eq(s.coupons.id, r.couponId), eq(s.coupons.businessId, businessId)));
  }
}
