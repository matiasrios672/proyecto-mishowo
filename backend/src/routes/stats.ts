import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import { requireUser } from "../auth/session.js";
import { modulesForPlan } from "../lib/modules.js";
import { ownedWhere, pageSelector } from "../lib/activeBusiness.js";

const BOT = /bot|crawl|spider|slurp|headless|preview|facebookexternalhit|whatsapp|telegram|curl|wget|python|node-fetch/i;
// El visitante es un hash de (sal + día + IP + navegador). No se guarda la IP, no hay cookies y mañana el mismo
// visitante es otro hash: sirve para contar visitas únicas por día sin poder seguir a nadie.
const SALT = randomBytes(16).toString("hex");

const slugParam = z.object({ slug: z.string().min(2).max(30).regex(/^[a-z0-9-]+$/) });
const eventBody = z.object({
  type: z.enum(["visit", "product_view", "whatsapp_click"]),
  productId: z.string().uuid().optional(),
  utmSource: z.string().trim().max(40).regex(/^[\w.\-+ ]+$/).optional(),
  referrer: z.string().max(300).optional(),
});
const rangeQuery = z.object({ days: z.coerce.number().int().refine((n) => n === 7 || n === 30 || n === 90, "range").default(30) });

/** Origen legible: utm_source si lo hay (QR, instagram…), si no el dominio de quien nos mandó, si no "directo". */
export function sourceOf(utm: string | undefined, referrer: string | undefined, ownHost?: string): string {
  if (utm) return utm.toLowerCase();
  if (!referrer) return "directo";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
    if (!host || host === ownHost) return "directo";
    if (/(^|\.)instagram\.com$|^l\.instagram\.com$/.test(host)) return "instagram";
    if (/(^|\.)facebook\.com$|^l\.facebook\.com$/.test(host)) return "facebook";
    if (/(^|\.)google\./.test(host)) return "google";
    if (/(^|\.)whatsapp\.com$|^wa\.me$/.test(host)) return "whatsapp";
    return host.slice(0, 40);
  } catch { return "directo"; }
}

export function publicStatsRoutes(app: FastifyInstance, db: Db, perMinute: number) {
  app.post("/public/sites/:slug/events", { config: { rateLimit: { max: perMinute, timeWindow: "1 minute" } } }, async (req, reply) => {
    const slug = slugParam.safeParse(req.params);
    const body = eventBody.safeParse(req.body);
    if (!slug.success || !body.success) return reply.code(400).send({ error: "invalid_request" });
    const ua = String(req.headers["user-agent"] ?? "");
    if (!ua || BOT.test(ua)) return reply.code(204).send(); // los robots no cuentan como visitas

    const [biz] = await db.select({ id: s.businesses.id }).from(s.businesses)
      .where(and(eq(s.businesses.slug, slug.data.slug), eq(s.businesses.status, "published"), isNull(s.businesses.deletedAt)));
    if (!biz) return reply.code(404).send({ error: "not_found" });

    const day = new Date().toISOString().slice(0, 10);
    const visitor = createHash("sha256").update(`${SALT}|${day}|${req.ip}|${ua}`).digest("hex").slice(0, 24);
    const { type, productId } = body.data;

    if (type === "product_view") {
      if (!productId) return reply.code(400).send({ error: "invalid_request" });
      const [p] = await db.select({ id: s.products.id }).from(s.products).where(and(eq(s.products.id, productId), eq(s.products.businessId, biz.id))); // un producto de otro negocio no cuenta
      if (!p) return reply.code(204).send();
    }
    // Visita y vista de producto: una por visitante y día (no se infla recargando). Los clics a WhatsApp sí se cuentan todos.
    if (type !== "whatsapp_click") {
      const [dup] = await db.select({ id: s.siteEvents.id }).from(s.siteEvents).where(and(
        eq(s.siteEvents.businessId, biz.id), eq(s.siteEvents.day, day), eq(s.siteEvents.type, type), eq(s.siteEvents.visitor, visitor),
        productId ? eq(s.siteEvents.productId, productId) : isNull(s.siteEvents.productId))).limit(1);
      if (dup) return reply.code(204).send();
    }
    await db.insert(s.siteEvents).values({
      businessId: biz.id, day, type, visitor, productId: type === "product_view" ? productId : null,
      source: sourceOf(body.data.utmSource, body.data.referrer),
    });
    return reply.code(204).send();
  });
}

export function statsRoutes(app: FastifyInstance, db: Db) {
  app.get("/me/stats", async (req, reply) => {
    const user = await requireUser(db, req, reply);
    if (!user) return;
    const q = rangeQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_request" });
    const [biz] = await db.select({ id: s.businesses.id, planId: s.businesses.planId }).from(s.businesses).where(ownedWhere(user.id, pageSelector(req)));
    if (!biz) return reply.code(404).send({ error: "no_business" });
    // Sin el módulo de estadísticas completas, el rango se recorta a 7 días (el panel avisa y ofrece mejorar el plan).
    const full = (await modulesForPlan(db, biz.planId)).stats_full;
    const days = full ? q.data.days : 7;

    const since = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
    const base = and(eq(s.siteEvents.businessId, biz.id), gte(s.siteEvents.day, since));
    const [byType, daily, sources, top, orderRow] = await Promise.all([
      db.select({ type: s.siteEvents.type, n: sql<number>`count(*)::int` }).from(s.siteEvents).where(base).groupBy(s.siteEvents.type),
      db.select({ day: s.siteEvents.day, n: sql<number>`count(*)::int` }).from(s.siteEvents).where(and(base, eq(s.siteEvents.type, "visit"))).groupBy(s.siteEvents.day),
      db.select({ source: s.siteEvents.source, n: sql<number>`count(*)::int` }).from(s.siteEvents).where(and(base, eq(s.siteEvents.type, "visit"))).groupBy(s.siteEvents.source).orderBy(desc(sql`count(*)`)).limit(8),
      db.select({ id: s.products.id, name: s.products.name, n: sql<number>`count(*)::int` }).from(s.siteEvents).innerJoin(s.products, eq(s.products.id, s.siteEvents.productId))
        .where(and(base, eq(s.siteEvents.type, "product_view"))).groupBy(s.products.id, s.products.name).orderBy(desc(sql`count(*)`)).limit(5),
      db.select({ n: sql<number>`count(*)::int` }).from(s.orders).where(and(eq(s.orders.businessId, biz.id), gte(s.orders.createdAt, new Date(`${since}T00:00:00Z`)))),
    ]);
    const count = (t: string) => byType.find((r) => r.type === t)?.n ?? 0;
    const visits = count("visit");
    const dayMap = new Map(daily.map((d) => [String(d.day), d.n]));
    const series = Array.from({ length: days }, (_, i) => {
      const day = new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
      return { day, visits: dayMap.get(day) ?? 0 };
    });
    const orders = orderRow[0]?.n ?? 0;
    reply.header("Cache-Control", "no-store");
    return {
      days: days, limited: !full,
      totals: { visits, whatsappClicks: count("whatsapp_click"), productViews: count("product_view"), orders, conversion: visits ? Math.round((orders / visits) * 1000) / 10 : 0 },
      series, sources: sources.map((r) => ({ source: r.source ?? "directo", visits: r.n })), topProducts: top.map((r) => ({ id: r.id, name: r.name, views: r.n })),
    };
  });
}
