import type { FastifyInstance } from "fastify";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Config } from "../config.js";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import { audit } from "../audit.js";
import { requirePerm } from "../admin/guard.js";
import type { Mailer } from "../lib/mailer.js";
import { STAGES, STAGE_LABEL, allLeads, leadById, leadCounts, listLeads, sourceCounts, type LeadRow } from "../leads/queries.js";
import { firstName } from "../jobs/leads.js";
import { sendTemplate } from "../mail/service.js";

const PAGE = 25;
const NUDGE_COOLDOWN_DAYS = 3;
const uuid = z.string().uuid();

const query = z.object({
  stage: z.enum(STAGES).optional(),
  q: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

const view = (l: LeadRow) => ({ ...l, stageLabel: STAGE_LABEL[l.stage] });

/** Una celda de CSV: entre comillas y sin que una planilla la interprete como fórmula (=, +, -, @). */
const cell = (v: unknown) => {
  let t = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
};

/** Leads: todas las personas que se registraron, con la etapa en la que quedaron, para poder volver a escribirles. */
export function adminLeadRoutes(app: FastifyInstance, db: Db, config: Config, mailer: Mailer) {
  app.get("/admin/leads", async (req, reply) => {
    const ctx = await requirePerm(db, config, req, reply, "leads","view");
    if (!ctx) return;
    const q = query.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_request" });
    const [list, counts, sources] = await Promise.all([
      listLeads(db, { ...(q.data.stage ? { stage: q.data.stage } : {}), ...(q.data.q ? { q: q.data.q } : {}) }, PAGE, (q.data.page - 1) * PAGE),
      leadCounts(db), sourceCounts(db),
    ]);
    reply.header("Cache-Control", "no-store");
    return {
      page: q.data.page, pageSize: PAGE, total: list.total, counts, sources,
      stages: STAGES.map((k) => ({ key: k, label: STAGE_LABEL[k] })),
      items: list.rows.map(view),
    };
  });

  app.get("/admin/leads.csv", async (req, reply) => {
    const ctx = await requirePerm(db, config, req, reply, "leads","manage");
    if (!ctx) return;
    const q = query.pick({ stage: true, q: true }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_request" });
    const rows = await allLeads(db, { ...(q.data.stage ? { stage: q.data.stage } : {}), ...(q.data.q ? { q: q.data.q } : {}) });
    const head = ["email", "nombre", "etapa", "email_confirmado", "negocio", "rubro", "plan", "origen", "registro", "ultimo_ingreso", "ultimo_aviso", "baja_novedades"];
    const lines = rows.map((l) => [l.email, l.name, STAGE_LABEL[l.stage], l.verified ? "si" : "no", l.businessName, l.industry, l.planId, l.source ?? "directo", l.createdAt, l.lastLoginAt, l.lastNudgeAt, l.optedOut ? "si" : "no"].map(cell).join(","));
    await audit(db, { actorId: ctx.user.id, action: "leads.export", entity: "leads", entityId: "csv", after: { rows: rows.length, stage: q.data.stage ?? null }, ip: ctx.ip });
    return reply.header("Content-Type", "text/csv; charset=utf-8").header("Content-Disposition", 'attachment; filename="leads-mishowo.csv"').header("Cache-Control", "no-store")
      .send(`﻿${[head.join(","), ...lines].join("\r\n")}\r\n`);
  });

  // Mail de "retomá tu página" a una persona puntual. Un aviso cada 3 días como máximo y nunca a quien se dio de baja.
  app.post<{ Params: { id: string } }>("/admin/leads/:id/nudge", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const ctx = await requirePerm(db, config, req, reply, "leads","manage");
    if (!ctx) return;
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const lead = await leadById(db, req.params.id);
    if (!lead) return reply.code(404).send({ error: "not_found" });
    if (lead.stage === "publicado") return reply.code(409).send({ error: "already_published" });
    if (lead.blocked) return reply.code(409).send({ error: "blocked" });
    if (lead.optedOut) return reply.code(409).send({ error: "opted_out" });
    const since = new Date(Date.now() - NUDGE_COOLDOWN_DAYS * 86_400_000);
    // Se reclama con un UPDATE condicional: dos clics seguidos no mandan dos mails.
    const claimed = await db.update(s.users).set({ lastNudgeAt: new Date() })
      .where(and(eq(s.users.id, lead.id), sql`(${s.users.lastNudgeAt} is null or ${s.users.lastNudgeAt} < ${since})`)).returning({ id: s.users.id });
    if (claimed.length === 0) return reply.code(409).send({ error: "too_soon", days: NUDGE_COOLDOWN_DAYS });
    const sent = await sendTemplate(db, mailer, "lead_nudge", lead.email, { name: firstName(lead.name), link: `${config.APP_URL}/panel` }, (e) => app.log.error({ err: e }, "no se pudo mandar el aviso"));
    if (!sent) {
      await db.update(s.users).set({ lastNudgeAt: lead.lastNudgeAt }).where(eq(s.users.id, lead.id));
      return reply.code(502).send({ error: "mail_off_or_failed" });
    }
    await audit(db, { actorId: ctx.user.id, action: "lead.nudge", entity: "user", entityId: lead.id, after: { stage: lead.stage }, ip: ctx.ip });
    return { ok: true };
  });
}
