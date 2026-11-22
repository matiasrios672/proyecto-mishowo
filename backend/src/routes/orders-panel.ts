import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import { requireUser } from "../auth/session.js";
import { toCsv } from "../orders/csv.js";
import { STATUSES, canTransition, nextStatuses } from "../orders/status.js";
import { releaseCoupon } from "../coupons/apply.js";

/** Panel de pedidos del negocio. Se registra dentro del contexto de /me (con sesión y chequeo de origen). */
export function orderPanelRoutes(app: FastifyInstance, db: Db) {
  async function business(req: Parameters<typeof requireUser>[1], reply: Parameters<typeof requireUser>[2]) {
    const user = await requireUser(db, req, reply);
    if (!user) return null;
    const [biz] = await db.select({ id: s.businesses.id, slug: s.businesses.slug }).from(s.businesses)
      .where(and(eq(s.businesses.ownerId, user.id), isNull(s.businesses.deletedAt)));
    if (!biz) { reply.code(404).send({ error: "no_business" }); return null; }
    return biz;
  }

  const view = (o: typeof s.orders.$inferSelect, items: (typeof s.orderItems.$inferSelect)[]) => ({
    id: o.id, number: o.number, status: o.status, nextStatuses: nextStatuses(o.status),
    customerName: o.customerName, customerPhone: o.customerPhone, notes: o.notes, eventDate: o.eventDate,
    total: Number(o.total), discount: Number(o.discount), couponCode: o.couponCode, source: o.source, createdAt: o.createdAt,
    items: items.map((i) => ({ name: i.name, optionLabel: i.optionLabel, unitPrice: Number(i.unitPrice), quantity: i.quantity })),
  });

  async function itemsFor(businessId: string, orderIds: string[]) {
    if (orderIds.length === 0) return new Map<string, (typeof s.orderItems.$inferSelect)[]>();
    const rows = await db.select().from(s.orderItems).where(and(eq(s.orderItems.businessId, businessId), inArray(s.orderItems.orderId, orderIds)));
    const map = new Map<string, (typeof rows)[number][]>();
    for (const r of rows) map.set(r.orderId, [...(map.get(r.orderId) ?? []), r]);
    return map;
  }

  app.get("/me/orders", async (req, reply) => {
    const biz = await business(req, reply);
    if (!biz) return;
    const q = z.object({
      status: z.enum(STATUSES).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      before: z.string().datetime().optional(),
    }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_request" });
    const rows = await db.select().from(s.orders)
      .where(and(eq(s.orders.businessId, biz.id), q.data.status ? eq(s.orders.status, q.data.status) : undefined, q.data.before ? lt(s.orders.createdAt, new Date(q.data.before)) : undefined))
      .orderBy(desc(s.orders.createdAt), desc(s.orders.number)).limit(q.data.limit + 1);
    const page = rows.slice(0, q.data.limit);
    const items = await itemsFor(biz.id, page.map((o) => o.id));
    reply.header("Cache-Control", "no-store");
    return {
      orders: page.map((o) => view(o, items.get(o.id) ?? [])),
      nextBefore: rows.length > q.data.limit ? page[page.length - 1]!.createdAt : null,
    };
  });

  app.get("/me/orders/summary", async (req, reply) => {
    const biz = await business(req, reply);
    if (!biz) return;
    const rows = await db.select({ status: s.orders.status, n: sql<number>`count(*)::int` }).from(s.orders)
      .where(eq(s.orders.businessId, biz.id)).groupBy(s.orders.status);
    const counts = Object.fromEntries(STATUSES.map((st) => [st, 0])) as Record<(typeof STATUSES)[number], number>;
    for (const r of rows) if (r.status in counts) counts[r.status as keyof typeof counts] = r.n;
    reply.header("Cache-Control", "no-store");
    return { counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
  });

  app.get("/me/orders.csv", async (req, reply) => {
    const biz = await business(req, reply);
    if (!biz) return;
    const rows = await db.select().from(s.orders).where(eq(s.orders.businessId, biz.id)).orderBy(desc(s.orders.createdAt)).limit(5000);
    const items = await itemsFor(biz.id, rows.map((o) => o.id));
    const csv = toCsv(
      ["Pedido", "Fecha", "Estado", "Cliente", "Teléfono", "Total", "Cupón", "Descuento", "Fecha del evento", "Notas", "Productos"],
      rows.map((o) => [
        o.number, new Date(o.createdAt).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }), o.status,
        o.customerName, o.customerPhone, Number(o.total).toFixed(2).replace(".", ","), o.couponCode, Number(o.discount).toFixed(2).replace(".", ","), o.eventDate, o.notes,
        (items.get(o.id) ?? []).map((i) => `${i.quantity} x ${i.name}${i.optionLabel ? ` (${i.optionLabel})` : ""}`).join(" | "),
      ]),
    );
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="pedidos-${biz.slug}.csv"`);
    reply.header("Cache-Control", "no-store");
    return csv;
  });

  app.get<{ Params: { id: string } }>("/me/orders/:id", async (req, reply) => {
    const biz = await business(req, reply);
    if (!biz) return;
    if (!z.string().uuid().safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [o] = await db.select().from(s.orders).where(and(eq(s.orders.id, req.params.id), eq(s.orders.businessId, biz.id)));
    if (!o) return reply.code(404).send({ error: "not_found" });
    return view(o, (await itemsFor(biz.id, [o.id])).get(o.id) ?? []);
  });

  app.patch<{ Params: { id: string } }>("/me/orders/:id/status", async (req, reply) => {
    const biz = await business(req, reply);
    if (!biz) return;
    const body = z.object({ status: z.enum(STATUSES) }).safeParse(req.body);
    if (!body.success || !z.string().uuid().safeParse(req.params.id).success) return reply.code(400).send({ error: "invalid_request" });

    const result = await db.transaction(async (tx) => {
      // El mismo lock que usa la creación de pedidos: cancelar y pedir a la vez no se pisan.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${biz.id}))`);
      const [o] = await tx.select().from(s.orders).where(and(eq(s.orders.id, req.params.id), eq(s.orders.businessId, biz.id)));
      if (!o) return { error: "not_found" as const };
      if (!canTransition(o.status, body.data.status)) return { error: "invalid_transition" as const, from: o.status };

      if (body.data.status === "cancelado") {
        // Se repone el stock que el pedido había descontado (en la opción si controla stock, si no en el producto).
        const items = await tx.select().from(s.orderItems).where(and(eq(s.orderItems.orderId, o.id), eq(s.orderItems.businessId, biz.id)));
        for (const it of items) {
          if (it.optionId) {
            const r = await tx.update(s.productOptions).set({ stock: sql`${s.productOptions.stock} + ${it.quantity}` })
              .where(and(eq(s.productOptions.id, it.optionId), eq(s.productOptions.businessId, biz.id), sql`${s.productOptions.stock} is not null`)).returning({ id: s.productOptions.id });
            if (r.length > 0) continue;
          }
          if (it.productId) {
            await tx.update(s.products).set({ stock: sql`${s.products.stock} + ${it.quantity}` })
              .where(and(eq(s.products.id, it.productId), eq(s.products.businessId, biz.id), sql`${s.products.stock} is not null`));
          }
        }
      }
      if (body.data.status === "cancelado") await releaseCoupon(tx, biz.id, o.id); // el uso del cupón vuelve a estar disponible
      const [updated] = await tx.update(s.orders).set({ status: body.data.status }).where(eq(s.orders.id, o.id)).returning();
      const items = await tx.select().from(s.orderItems).where(eq(s.orderItems.orderId, o.id));
      return { order: view(updated!, items) };
    });

    if ("error" in result) return reply.code(result.error === "not_found" ? 404 : 409).send(result);
    return result.order;
  });
}
