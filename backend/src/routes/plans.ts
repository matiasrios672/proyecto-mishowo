import type { FastifyInstance } from "fastify";
import { asc, eq } from "drizzle-orm";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";

export function planRoutes(app: FastifyInstance, db: Db) {
  // Planes activos con precios y límites tal como están en la DB (los edita el admin).
  app.get("/public/plans", async (_req, reply) => {
    const rows = await db.select().from(s.plans).where(eq(s.plans.active, true)).orderBy(asc(s.plans.priceMonthly));
    reply.header("Cache-Control", "public, max-age=60");
    return rows.map((p) => ({
      id: p.id, name: p.name, priceMonthly: Number(p.priceMonthly), limits: p.limits, features: (p.features as string[]).filter((f) => !/sin marca/i.test(f)), // todas las páginas llevan «Hecho por MiShowo»
    }));
  });
}
