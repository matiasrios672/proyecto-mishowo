import { and, asc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

export type Db = NodePgDatabase<typeof schema>;

/**
 * Único camino para leer/escribir datos de un negocio. Toda query lleva `business_id`,
 * y las escrituras lo fuerzan: nunca se confía en un businessId que venga del cliente.
 */
export function tenantScope(db: Db, businessId: string) {
  const { categories, products, productOptions, orders, orderItems } = schema;

  async function assertCategory(categoryId: string | null | undefined) {
    if (!categoryId) return;
    const [row] = await db.select({ id: categories.id }).from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.businessId, businessId)));
    if (!row) throw new Error("La categoría no pertenece a este negocio");
  }

  return {
    businessId,

    categories: {
      list: () => db.select().from(categories).where(eq(categories.businessId, businessId)).orderBy(asc(categories.position)),
      create: async (data: { name: string; position?: number }) =>
        (await db.insert(categories).values({ ...data, businessId }).returning())[0]!,
      remove: (id: string) => db.delete(categories).where(and(eq(categories.id, id), eq(categories.businessId, businessId))),
    },

    products: {
      list: () => db.select().from(products).where(eq(products.businessId, businessId)).orderBy(asc(products.position)),
      get: async (id: string) =>
        (await db.select().from(products).where(and(eq(products.id, id), eq(products.businessId, businessId))))[0] ?? null,
      count: async () =>
        Number((await db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.businessId, businessId)))[0]!.n),
      create: async (data: Omit<typeof products.$inferInsert, "businessId" | "id">) => {
        await assertCategory(data.categoryId);
        return (await db.insert(products).values({ ...data, businessId }).returning())[0]!;
      },
      update: async (id: string, data: Partial<Omit<typeof products.$inferInsert, "businessId" | "id">>) => {
        await assertCategory(data.categoryId);
        return (await db.update(products).set(data)
          .where(and(eq(products.id, id), eq(products.businessId, businessId))).returning())[0] ?? null;
      },
      remove: (id: string) => db.delete(products).where(and(eq(products.id, id), eq(products.businessId, businessId))),
    },

    options: {
      listFor: (productId: string) =>
        db.select().from(productOptions)
          .where(and(eq(productOptions.productId, productId), eq(productOptions.businessId, businessId)))
          .orderBy(asc(productOptions.position)),
      create: async (productId: string, data: Omit<typeof productOptions.$inferInsert, "businessId" | "id" | "productId">) => {
        const [p] = await db.select({ id: products.id }).from(products)
          .where(and(eq(products.id, productId), eq(products.businessId, businessId)));
        if (!p) throw new Error("El producto no pertenece a este negocio");
        return (await db.insert(productOptions).values({ ...data, productId, businessId }).returning())[0]!;
      },
    },

    orders: {
      list: (status?: string) =>
        db.select().from(orders)
          .where(status ? and(eq(orders.businessId, businessId), eq(orders.status, status)) : eq(orders.businessId, businessId))
          .orderBy(sql`${orders.createdAt} desc`),
      get: async (id: string) =>
        (await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.businessId, businessId))))[0] ?? null,
      setStatus: async (id: string, status: string) =>
        (await db.update(orders).set({ status }).where(and(eq(orders.id, id), eq(orders.businessId, businessId))).returning())[0] ?? null,
      items: (orderId: string) =>
        db.select().from(orderItems).where(and(eq(orderItems.orderId, orderId), eq(orderItems.businessId, businessId))),
    },
  };
}
