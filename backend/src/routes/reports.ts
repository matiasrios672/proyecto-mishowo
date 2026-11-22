import type { FastifyInstance } from "fastify";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";

export const REPORT_REASONS = ["contenido_ilegal", "estafa", "ofensivo", "otro"] as const;

const body = z.object({
  slug: z.string().min(2).max(30).regex(/^[a-z0-9-]+$/),
  reason: z.enum(REPORT_REASONS),
  detail: z.string().trim().max(500).optional(),
});

export function reportRoutes(app: FastifyInstance, db: Db, perMinute = 5) {
  app.post("/public/reports", { config: { rateLimit: { max: perMinute, timeWindow: "1 minute" } } }, async (req, reply) => {
    const parsed = body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    const { slug, reason, detail } = parsed.data;
    const [biz] = await db.select({ id: s.businesses.id }).from(s.businesses)
      .where(and(eq(s.businesses.slug, slug), isNull(s.businesses.deletedAt)));
    if (!biz) return reply.code(404).send({ error: "not_found" });
    await db.insert(s.reports).values({ businessId: biz.id, reason, detail: detail || null });
    return reply.code(201).send({ ok: true });
  });
}
