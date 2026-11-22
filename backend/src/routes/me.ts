import type { FastifyInstance } from "fastify";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { Config } from "../config.js";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import { contentSchema } from "../business/content.js";
import { loadContent, saveContent } from "../business/sync.js";
import { missingForPublish, productLimit, realProducts } from "../business/publish.js";
import { requireUser, strictOriginOk } from "../auth/session.js";
import { checkSlug } from "../lib/slug.js";
import type { SiteChanged } from "../lib/revalidate.js";

const putBody = z.object({
  // Versión que el editor cree tener. null = todavía no existe el negocio en el servidor.
  baseVersion: z.number().int().min(0).nullable(),
  content: contentSchema,
});

const slugBody = z.object({ slug: z.string().trim().toLowerCase().min(1).max(60) });

// Drizzle envuelve el error de Postgres: el código (23505 = clave duplicada) puede venir en `cause`.
const isUniqueViolation = (e: unknown) => [e, (e as { cause?: unknown })?.cause].some((x) => (x as { code?: string } | undefined)?.code === "23505");

export function meRoutes(app: FastifyInstance, db: Db, config: Config, notify: SiteChanged) {
  // CSRF: solo pedidos que vengan del sitio principal.
  app.addHook("onRequest", async (req, reply) => {
    if (!strictOriginOk(config, req)) return reply.code(403).send({ error: "bad_origin" });
  });

  const ownBusiness = async (userId: string) =>
    (await db.select().from(s.businesses).where(and(eq(s.businesses.ownerId, userId), isNull(s.businesses.deletedAt))))[0] ?? null;

  app.get("/me/business", async (req, reply) => {
    const user = await requireUser(db, req, reply);
    if (!user) return;
    reply.header("Cache-Control", "no-store");
    return (await loadContent(db, user.id)) ?? { business: null, content: null };
  });

  // Guardado del editor (autoguardado): permite hasta ~4 pedidos por segundo, no más.
  app.put("/me/business", { config: { rateLimit: { max: 240, timeWindow: "1 minute" } }, bodyLimit: 2 * 1024 * 1024 }, async (req, reply) => {
    const user = await requireUser(db, req, reply);
    if (!user) return;
    const parsed = putBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_content", issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) });
    const result = await saveContent(db, user.id, parsed.data.baseVersion, parsed.data.content);
    if (result.status === "conflict") return reply.code(409).send({ error: "version_conflict", version: result.version });
    if (result.status === "limit") return reply.code(422).send({ error: "plan_limit", limit: result.limit, count: result.count });
    if (result.published) notify(result.published); // página ya publicada: se refresca al instante
    return reply.code(result.created ? 201 : 200).send({ version: result.version });
  });

  // ¿Está libre este link? (el propio cuenta como libre)
  app.get("/me/slug", { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } }, async (req, reply) => {
    const user = await requireUser(db, req, reply);
    if (!user) return;
    const q = z.object({ slug: z.string().max(60) }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_request" });
    const chk = checkSlug(q.data.slug);
    if (!chk.ok) return { available: false, reason: chk.reason };
    const own = await ownBusiness(user.id);
    const [taken] = await db.select({ id: s.businesses.id }).from(s.businesses)
      .where(and(eq(s.businesses.slug, chk.slug), own ? ne(s.businesses.id, own.id) : undefined));
    return taken ? { available: false, reason: "ocupado" } : { available: true, slug: chk.slug };
  });

  app.post("/me/business/publish", { config: { rateLimit: { max: config.PUBLISH_PER_MINUTE, timeWindow: "1 minute" } } }, async (req, reply) => {
    const user = await requireUser(db, req, reply);
    if (!user) return;
    const p = slugBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request" });

    const biz = await ownBusiness(user.id);
    if (!biz) return reply.code(404).send({ error: "no_business" });
    if (biz.status === "suspended") return reply.code(403).send({ error: "suspended" });
    if (!user.emailVerifiedAt) return reply.code(403).send({ error: "email_not_verified" });

    const loaded = await loadContent(db, user.id);
    const missing = loaded ? missingForPublish(loaded.content) : (["name", "whatsapp", "products"] as const);
    if (missing.length > 0) return reply.code(422).send({ error: "not_ready", missing });

    const chk = checkSlug(p.data.slug);
    if (!chk.ok) return reply.code(422).send({ error: "invalid_slug", reason: chk.reason });

    const limit = await productLimit(db, biz.planId);
    const count = realProducts(loaded!.content).length;
    if (limit !== null && count > limit) return reply.code(422).send({ error: "plan_limit", limit, count });

    try {
      await db.update(s.businesses)
        .set({ slug: chk.slug, status: "published", publishedAt: sql`coalesce(${s.businesses.publishedAt}, now())` })
        .where(eq(s.businesses.id, biz.id));
    } catch (e) {
      if (isUniqueViolation(e)) return reply.code(409).send({ error: "slug_taken" });
      throw e;
    }
    notify(chk.slug);
    if (biz.slug !== chk.slug) notify(biz.slug);
    return { slug: chk.slug, status: "published" };
  });

  app.post("/me/business/unpublish", async (req, reply) => {
    const user = await requireUser(db, req, reply);
    if (!user) return;
    const biz = await ownBusiness(user.id);
    if (!biz) return reply.code(404).send({ error: "no_business" });
    if (biz.status === "suspended") return reply.code(403).send({ error: "suspended" });
    await db.update(s.businesses).set({ status: "draft" }).where(eq(s.businesses.id, biz.id));
    notify(biz.slug);
    return { status: "draft" };
  });
}
