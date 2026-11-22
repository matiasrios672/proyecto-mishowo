import { readdir, stat, statfs } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { desc, eq, sql } from "drizzle-orm";
import type { Config } from "../config.js";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import { audit } from "../audit.js";
import { requireAdmin } from "../admin/guard.js";
import { ADMIN_ROLES } from "../auth/session.js";
import { RESERVED_SLUGS } from "../lib/slug.js";
import {
  CMS_KEY, CRON_KEY, DEFAULT_MAINTENANCE_MESSAGE, MAINTENANCE_KEY, RESERVED_KEY,
  cmsSchema, getCms, getMaintenance, getReservedSlugs, maintenanceSchema, putSetting, reservedSlugsSchema,
} from "../lib/settings.js";

const MANAGE = ["owner", "admin"] as const;
const VERSION = process.env.npm_package_version ?? "0.1.0";
const STARTED = Date.now();

/** Tamaño de una carpeta (con tope de archivos: nunca debe colgar el panel). */
async function dirSize(dir: string, cap = 100_000): Promise<{ bytes: number; files: number; truncated: boolean }> {
  let bytes = 0, files = 0, truncated = false;
  const walk = async (d: string): Promise<void> => {
    let entries;
    try { entries = await readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (files >= cap) { truncated = true; return; }
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile()) { try { bytes += (await stat(p)).size; files++; } catch { /* se borró mientras mirábamos */ } }
    }
  };
  await walk(dir);
  return { bytes, files, truncated };
}

/** Lo que la landing necesita saber en cada visita: aviso global, mantenimiento y preguntas frecuentes. Sin datos sensibles. */
export function publicSiteConfigRoutes(app: FastifyInstance, db: Db) {
  app.get("/public/site-config", async (_req, reply) => {
    const [cms, maint] = await Promise.all([getCms(db), getMaintenance(db)]);
    reply.header("Cache-Control", "public, max-age=15, stale-while-revalidate=60");
    return {
      banner: cms.banner.enabled && cms.banner.text ? { text: cms.banner.text, link: cms.banner.link || null } : null,
      maintenance: maint.enabled ? { message: maint.message || DEFAULT_MAINTENANCE_MESSAGE } : null,
      faq: cms.faq.length > 0 ? cms.faq : null,
    };
  });
}

export function adminSystemRoutes(app: FastifyInstance, db: Db, config: Config) {
  // ───────── Estado del sistema ─────────
  app.get("/admin/system", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply);
    if (!ctx) return;
    const t0 = performance.now();
    let dbOk = true;
    try { await db.execute(sql`select 1`); } catch { dbOk = false; }
    const latencyMs = Math.round((performance.now() - t0) * 10) / 10;

    const [uploads, disk, lastExpire, cronRow, maint, reserved] = await Promise.all([
      dirSize(config.UPLOADS_DIR),
      statfs(config.UPLOADS_DIR).then((f) => ({ freeBytes: Number(f.bavail) * Number(f.bsize), totalBytes: Number(f.blocks) * Number(f.bsize) })).catch(() => null),
      dbOk ? db.select({ at: s.auditLog.createdAt }).from(s.auditLog).where(eq(s.auditLog.action, "plan.expired")).orderBy(desc(s.auditLog.id)).limit(1) : Promise.resolve([]),
      dbOk ? db.select().from(s.appSettings).where(eq(s.appSettings.key, CRON_KEY)) : Promise.resolve([]),
      dbOk ? getMaintenance(db) : Promise.resolve({ enabled: false, message: "" }),
      dbOk ? getReservedSlugs(db) : Promise.resolve([]),
    ]);
    reply.header("Cache-Control", "no-store");
    return {
      version: VERSION, node: process.version, env: config.NODE_ENV, uptimeSeconds: Math.round((Date.now() - STARTED) / 1000),
      db: { ok: dbOk, latencyMs },
      uploads: { ...uploads, disk },
      cron: { lastRun: (cronRow[0]?.value as { at?: string } | undefined)?.at ?? null, lastPlanExpiry: lastExpire[0]?.at ?? null },
      maintenance: maint,
      reservedCount: reserved.length,
    };
  });

  // ───────── Modo mantenimiento ─────────
  app.put("/admin/system/maintenance", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply, MANAGE);
    if (!ctx) return;
    const p = maintenanceSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request" });
    await db.transaction(async (tx) => {
      const before = await getMaintenance(tx);
      await putSetting(tx, MAINTENANCE_KEY, p.data);
      await audit(tx, { actorId: ctx.user.id, action: "settings.maintenance", entity: "settings", entityId: MAINTENANCE_KEY, before, after: p.data, ip: ctx.ip });
    });
    return p.data;
  });

  // ───────── Slugs reservados ─────────
  app.get("/admin/settings/reserved-slugs", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply);
    if (!ctx) return;
    return { slugs: await getReservedSlugs(db), builtin: [...RESERVED_SLUGS].sort() };
  });
  app.put("/admin/settings/reserved-slugs", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply, MANAGE);
    if (!ctx) return;
    const p = reservedSlugsSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request" });
    const slugs = [...new Set(p.data.slugs)].sort();
    const inUse = slugs.length
      ? (await db.execute(sql`select slug from businesses where deleted_at is null and slug in (${sql.join(slugs.map((x) => sql`${x}`), sql`, `)})`)).rows.map((r) => (r as { slug: string }).slug)
      : [];
    await db.transaction(async (tx) => {
      const before = await getReservedSlugs(tx);
      await putSetting(tx, RESERVED_KEY, { slugs });
      await audit(tx, { actorId: ctx.user.id, action: "settings.reserved_slugs", entity: "settings", entityId: RESERVED_KEY, before: { slugs: before }, after: { slugs }, ip: ctx.ip });
    });
    return { slugs, inUse }; // los que ya están en uso siguen funcionando; la reserva vale para nuevos links
  });

  // ───────── Mini CMS (FAQ y aviso global de la landing) ─────────
  app.get("/admin/settings/cms", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply, ADMIN_ROLES);
    if (!ctx) return;
    return await getCms(db);
  });
  app.put("/admin/settings/cms", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply, MANAGE);
    if (!ctx) return;
    const p = cmsSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request" });
    if (p.data.banner.enabled && !p.data.banner.text) return reply.code(422).send({ error: "banner_text_required" });
    await db.transaction(async (tx) => {
      const before = await getCms(tx);
      await putSetting(tx, CMS_KEY, p.data);
      await audit(tx, { actorId: ctx.user.id, action: "settings.cms", entity: "settings", entityId: CMS_KEY, before, after: p.data, ip: ctx.ip });
    });
    return p.data;
  });
}
