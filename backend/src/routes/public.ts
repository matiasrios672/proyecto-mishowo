import type { FastifyInstance } from "fastify";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import type { Config } from "../config.js";
import { mediaUrls } from "../media/urls.js";

const slugParam = z.object({ slug: z.string().min(2).max(30).regex(/^[a-z0-9-]+$/) });

export function publicRoutes(app: FastifyInstance, db: Db, config: Pick<Config, "API_PUBLIC_URL">) {
  // Datos públicos de un negocio por slug. Solo expone lo necesario para renderizar la página.
  app.get("/public/sites/:slug", async (req, reply) => {
    const parsed = slugParam.safeParse(req.params);
    if (!parsed.success) return reply.code(404).send({ error: "not_found" });

    const [biz] = await db.select().from(s.businesses)
      .where(and(eq(s.businesses.slug, parsed.data.slug), isNull(s.businesses.deletedAt)));
    if (!biz || biz.status === "draft") return reply.code(404).send({ error: "not_found" });
    if (biz.status === "suspended") return reply.code(200).send({ status: "suspended", name: biz.name });

    const [cats, prods, opts, files] = await Promise.all([
      db.select().from(s.categories).where(eq(s.categories.businessId, biz.id)).orderBy(asc(s.categories.position)),
      db.select().from(s.products).where(and(eq(s.products.businessId, biz.id), eq(s.products.isExample, false))).orderBy(asc(s.products.position)),
      db.select().from(s.productOptions).where(eq(s.productOptions.businessId, biz.id)).orderBy(asc(s.productOptions.position)),
      db.select().from(s.media).where(and(eq(s.media.businessId, biz.id), eq(s.media.kind, "image"))).orderBy(asc(s.media.position), asc(s.media.createdAt)),
    ]);
    const firstImage = new Map<string | null, ReturnType<typeof mediaUrls>>();
    for (const m of files) if (!firstImage.has(m.productId)) firstImage.set(m.productId, mediaUrls(config, m.path, m.kind));
    const video = (await db.select().from(s.media).where(and(eq(s.media.businessId, biz.id), eq(s.media.kind, "video"), isNull(s.media.productId))).limit(1))[0];

    reply.header("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    return {
      status: "published",
      business: {
        slug: biz.slug, name: biz.name, industry: biz.industry, description: biz.description,
        tagline: biz.tagline, whatsapp: biz.whatsapp, instagram: biz.instagram, address: biz.address,
        deliveryZone: biz.deliveryZone, hours: biz.hours, design: biz.design, settings: biz.settings,
        planId: biz.planId,
      },
      cover: firstImage.get(null) ?? null,
      video: video ? mediaUrls(config, video.path, video.kind).src : null,
      categories: cats.map((c) => ({ id: c.id, name: c.name })),
      products: prods.map((p) => ({
        id: p.id, categoryId: p.categoryId, name: p.name, description: p.description, image: firstImage.get(p.id) ?? null,
        price: p.price, comparePrice: p.comparePrice,
        available: p.available && (p.stock === null || p.stock > 0),
        options: opts.filter((o) => o.productId === p.id).map((o) => ({
          id: o.id, label: o.label, price: o.price, soldOut: o.soldOut || (o.stock !== null && o.stock <= 0),
        })),
      })),
    };
  });
}
