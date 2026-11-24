import type { FastifyInstance } from "fastify";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/tenant.js";
import type { Mailer } from "../lib/mailer.js";
import * as s from "../db/schema.js";
import { modulesForPlan } from "../lib/modules.js";
import { requireUser } from "../auth/session.js";
import { sha256 } from "../lib/security.js";
import { ownedWhere, pageSelector } from "../lib/activeBusiness.js";

const slug = z.string().min(2).max(30).regex(/^[a-z0-9-]+$/);
const bodySchema = z.object({
  name: z.string().trim().min(2).max(60),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
  website: z.string().max(200).optional(), // trampa para robots: una persona no lo ve ni lo completa
});
const PER_BUSINESS_PER_DAY = 1; // una reseña por conexión y por negocio cada 24 horas

/** Lo que se ve de una reseña aprobada. El hash de IP y el estado interno nunca salen. */
const publicView = (r: typeof s.reviews.$inferSelect) => ({ id: r.id, name: r.authorName, rating: r.rating, comment: r.comment, reply: r.reply, createdAt: r.createdAt });

/** Reseñas públicas: se piden y se dejan sin cuenta, pero quedan pendientes hasta que el dueño las aprueba. */
export function publicReviewRoutes(app: FastifyInstance, db: Db, perMinute: number, mailer?: Mailer, appUrl = "") {
  async function bizOf(slugValue: string) {
    const [b] = await db.select().from(s.businesses).where(and(eq(s.businesses.slug, slugValue), eq(s.businesses.status, "published"), isNull(s.businesses.deletedAt)));
    if (!b) return null;
    return (await modulesForPlan(db, b.planId)).reviews ? b : null;
  }

  app.get<{ Params: { slug: string } }>("/public/sites/:slug/reviews", async (req, reply) => {
    const p = slug.safeParse(req.params.slug);
    const biz = p.success ? await bizOf(p.data) : null;
    reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    if (!biz) return reply.code(404).send({ error: "not_found" });
    const [rows, agg] = await Promise.all([
      db.select().from(s.reviews).where(and(eq(s.reviews.businessId, biz.id), eq(s.reviews.status, "aprobada"))).orderBy(desc(s.reviews.createdAt)).limit(30),
      db.select({ n: sql<number>`count(*)::int`, avg: sql<string | null>`avg(rating)::numeric(3,2)::text` }).from(s.reviews).where(and(eq(s.reviews.businessId, biz.id), eq(s.reviews.status, "aprobada"))),
    ]);
    return { count: agg[0]?.n ?? 0, average: agg[0]?.avg ? Number(agg[0].avg) : null, items: rows.map(publicView) };
  });

  app.post<{ Params: { slug: string } }>("/public/sites/:slug/reviews", { config: { rateLimit: { max: Math.max(2, Math.floor(perMinute / 2)), timeWindow: "1 minute" } } }, async (req, reply) => {
    const p = slug.safeParse(req.params.slug);
    const b = bodySchema.safeParse(req.body);
    if (!p.success || !b.success) return reply.code(400).send({ error: "invalid_request" });
    if (b.data.website) return reply.code(201).send({ ok: true }); // robot: se "acepta" sin guardar nada
    const biz = await bizOf(p.data);
    if (!biz) return reply.code(404).send({ error: "not_found" });
    const ipHash = sha256(`${req.ip}:${biz.id}`);
    const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.reviews)
      .where(and(eq(s.reviews.businessId, biz.id), eq(s.reviews.ipHash, ipHash), sql`${s.reviews.createdAt} > now() - interval '24 hours'`));
    if (n >= PER_BUSINESS_PER_DAY) return reply.code(429).send({ error: "already_reviewed" });
    const [row] = await db.insert(s.reviews).values({ businessId: biz.id, authorName: b.data.name, rating: b.data.rating, comment: b.data.comment || null, ipHash }).returning();
    if (mailer) {
      void (async () => {
        const [owner] = await db.select({ email: s.users.email }).from(s.users).where(eq(s.users.id, biz.ownerId));
        if (!owner) return;
        await mailer.send({ to: owner.email, subject: `Nueva reseña en ${biz.name} (${"★".repeat(row!.rating)})`, text: `${row!.authorName} dejó una reseña de ${row!.rating} de 5.\n\n${row!.comment ?? ""}\n\nAprobarla o responderla: ${appUrl}/panel/resenas` });
      })().catch((e) => app.log.error({ err: e }, "no se pudo avisar de la reseña"));
    }
    return reply.code(201).send({ ok: true, pending: true });
  });
}

/** Panel del negocio: aprobar, rechazar y responder. Todo filtrado por el negocio de quien pide. */
export function reviewPanelRoutes(app: FastifyInstance, db: Db) {
  async function business(req: Parameters<typeof requireUser>[1], reply: Parameters<typeof requireUser>[2]) {
    const user = await requireUser(db, req, reply);
    if (!user) return null;
    const [biz] = await db.select({ id: s.businesses.id, planId: s.businesses.planId }).from(s.businesses).where(ownedWhere(user.id, pageSelector(req)));
    if (!biz) { reply.code(404).send({ error: "no_business" }); return null; }
    return biz;
  }
  const ownerView = (r: typeof s.reviews.$inferSelect) => ({ ...publicView(r), status: r.status });

  app.get("/me/reviews", async (req, reply) => {
    const biz = await business(req, reply);
    if (!biz) return;
    const q = z.object({ status: z.enum(["pendiente", "aprobada", "rechazada", "todas"]).default("pendiente") }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_request" });
    const where = q.data.status === "todas" ? eq(s.reviews.businessId, biz.id) : and(eq(s.reviews.businessId, biz.id), eq(s.reviews.status, q.data.status));
    const [rows, counts, mods] = await Promise.all([
      db.select().from(s.reviews).where(where).orderBy(desc(s.reviews.createdAt)).limit(100),
      db.select({ status: s.reviews.status, n: sql<number>`count(*)::int` }).from(s.reviews).where(eq(s.reviews.businessId, biz.id)).groupBy(s.reviews.status),
      modulesForPlan(db, biz.planId),
    ]);
    reply.header("Cache-Control", "no-store");
    const c = (k: string) => counts.find((x) => x.status === k)?.n ?? 0;
    return { enabled: mods.reviews, counts: { pendiente: c("pendiente"), aprobada: c("aprobada"), rechazada: c("rechazada") }, items: rows.map(ownerView) };
  });

  app.patch<{ Params: { id: string } }>("/me/reviews/:id", async (req, reply) => {
    const biz = await business(req, reply);
    if (!biz) return;
    const b = z.object({ status: z.enum(["aprobada", "rechazada", "pendiente"]).optional(), reply: z.string().trim().max(500).nullable().optional() })
      .refine((x) => x.status !== undefined || x.reply !== undefined).safeParse(req.body);
    if (!b.success || !z.string().uuid().safeParse(req.params.id).success) return reply.code(400).send({ error: "invalid_request" });
    const set: Partial<typeof s.reviews.$inferInsert> = {};
    if (b.data.status) set.status = b.data.status;
    if (b.data.reply !== undefined) set.reply = b.data.reply || null;
    const [row] = await db.update(s.reviews).set(set).where(and(eq(s.reviews.id, req.params.id), eq(s.reviews.businessId, biz.id))).returning();
    if (!row) return reply.code(404).send({ error: "not_found" });
    return ownerView(row);
  });
}
