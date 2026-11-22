import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Config } from "../config.js";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import { audit } from "../audit.js";
import { requireAdmin } from "../admin/guard.js";
import { ADMIN_ROLES } from "../auth/session.js";
import type { SiteChanged } from "../lib/revalidate.js";

const PAGE = 25;
const MANAGE = ["owner", "admin"] as const; // Soporte mira y deja notas; no despublica ni suspende
const uuid = z.string().uuid();
const STATUSES = ["nuevo", "revisado", "accion_tomada"] as const;
const ACTIONS = ["note", "dismiss", "unpublish", "suspend"] as const;

/** Cola de moderación de denuncias. Todo queda en la auditoría inmutable; la nota se guarda ahí (después de la acción). */
export function adminModerationRoutes(app: FastifyInstance, db: Db, config: Config, notify: SiteChanged) {
  app.get("/admin/reports", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply);
    if (!ctx) return;
    const q = z.object({ status: z.enum([...STATUSES, "todas"]).default("nuevo"), page: z.coerce.number().int().min(1).max(10_000).default(1) }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_request" });
    const where = q.data.status === "todas" ? undefined : eq(s.reports.status, q.data.status);
    const [rows, total, counts] = await Promise.all([
      db.select({ r: s.reports, b: { id: s.businesses.id, name: s.businesses.name, slug: s.businesses.slug, status: s.businesses.status, deletedAt: s.businesses.deletedAt } })
        .from(s.reports).innerJoin(s.businesses, eq(s.businesses.id, s.reports.businessId)).where(where)
        .orderBy(q.data.status === "nuevo" ? s.reports.createdAt : desc(s.reports.createdAt)).limit(PAGE).offset((q.data.page - 1) * PAGE),
      db.select({ n: sql<number>`count(*)::int` }).from(s.reports).where(where),
      db.select({ status: s.reports.status, n: sql<number>`count(*)::int` }).from(s.reports).groupBy(s.reports.status),
    ]);
    const ids = rows.map(({ r }) => r.id);
    const notes = ids.length
      ? await db.select({ entityId: s.auditLog.entityId, action: s.auditLog.action, after: s.auditLog.after, createdAt: s.auditLog.createdAt, actor: s.users.email })
        .from(s.auditLog).leftJoin(s.users, eq(s.users.id, s.auditLog.actorId))
        .where(and(eq(s.auditLog.entity, "report"), inArray(s.auditLog.entityId, ids))).orderBy(desc(s.auditLog.id))
      : [];
    reply.header("Cache-Control", "no-store");
    return {
      page: q.data.page, pageSize: PAGE, total: total[0]?.n ?? 0,
      counts: Object.fromEntries(STATUSES.map((st) => [st, counts.find((c) => c.status === st)?.n ?? 0])),
      reports: rows.map(({ r, b }) => ({
        id: r.id, reason: r.reason, detail: r.detail, status: r.status, createdAt: r.createdAt,
        business: { id: b.id, name: b.name, slug: b.slug, status: b.status, deleted: !!b.deletedAt },
        history: notes.filter((n) => n.entityId === r.id).map((n) => ({ action: n.action, note: (n.after as { note?: string } | null)?.note ?? null, at: n.createdAt, by: n.actor })),
      })),
    };
  });

  const body = z.object({ action: z.enum(ACTIONS), note: z.string().trim().max(500).optional() });
  app.post<{ Params: { id: string } }>("/admin/reports/:id/resolve", async (req, reply) => {
    const parsed = body.safeParse(req.body);
    if (!parsed.success || !uuid.safeParse(req.params.id).success) return reply.code(400).send({ error: "invalid_request" });
    const { action, note } = parsed.data;
    const ctx = await requireAdmin(db, config, req, reply, action === "note" ? ADMIN_ROLES : MANAGE);
    if (!ctx) return;
    if (action === "note" && !note) return reply.code(400).send({ error: "note_required" });

    const out = await db.transaction(async (tx): Promise<{ error: string; status: number } | { slug: string | null }> => {
      const [rep] = await tx.select().from(s.reports).where(eq(s.reports.id, req.params.id));
      if (!rep) return { error: "not_found", status: 404 };
      const [biz] = await tx.select().from(s.businesses).where(eq(s.businesses.id, rep.businessId));
      if (action === "note") {
        await audit(tx, { actorId: ctx.user.id, action: "report.note", entity: "report", entityId: rep.id, after: { note }, ip: ctx.ip });
        return { slug: null };
      }
      // Se valida ANTES de reclamar: un return dentro de la transacción no deshace nada.
      if (action !== "dismiss") {
        if (!biz || biz.deletedAt) return { error: "business_gone", status: 409 };
        if (action === "unpublish" && biz.status !== "published") return { error: "not_published", status: 409 };
        if (action === "suspend" && biz.status === "suspended") return { error: "already_suspended", status: 409 };
      }
      // Reclamo atómico: dos admins resolviendo a la vez → uno gana, el otro recibe 409.
      const next = action === "dismiss" ? "revisado" : "accion_tomada";
      const [claimed] = await tx.update(s.reports).set({ status: next }).where(and(eq(s.reports.id, rep.id), eq(s.reports.status, "nuevo"))).returning({ id: s.reports.id });
      if (!claimed) return { error: "already_resolved", status: 409 };

      let slug: string | null = null;
      let siteChange: { before: string; after: string } | null = null;
      if (action !== "dismiss" && biz) {
        const target = action === "suspend" ? "suspended" : "draft";
        await tx.update(s.businesses).set({ status: target }).where(eq(s.businesses.id, biz.id));
        await audit(tx, { actorId: ctx.user.id, action: action === "suspend" ? "business.suspend" : "business.unpublish", entity: "business", entityId: biz.id, before: { status: biz.status }, after: { status: target, reason: `denuncia ${rep.id}` }, ip: ctx.ip });
        // El resto de denuncias abiertas del mismo negocio quedan resueltas por la misma acción.
        await tx.update(s.reports).set({ status: "accion_tomada" }).where(and(eq(s.reports.businessId, biz.id), eq(s.reports.status, "nuevo")));
        slug = biz.slug;
        siteChange = { before: biz.status, after: target };
      }
      await audit(tx, { actorId: ctx.user.id, action: `report.${action}`, entity: "report", entityId: rep.id, before: { status: "nuevo" }, after: { status: next, ...(note ? { note } : {}), ...(siteChange ? { business: siteChange } : {}) }, ip: ctx.ip });
      return { slug };
    });
    if ("error" in out) return reply.code(out.status).send({ error: out.error });
    if (out.slug) notify(out.slug); // si estaba publicada, deja de verse al instante
    return { ok: true };
  });

  /** Cantidad de denuncias abiertas, para las alertas. */
  app.get("/admin/reports/open-count", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply);
    if (!ctx) return;
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(s.reports).innerJoin(s.businesses, and(eq(s.businesses.id, s.reports.businessId), isNull(s.businesses.deletedAt))).where(eq(s.reports.status, "nuevo"));
    return { open: row?.n ?? 0 };
  });
}
