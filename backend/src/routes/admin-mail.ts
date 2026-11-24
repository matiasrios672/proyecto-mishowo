import type { FastifyInstance } from "fastify";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Config } from "../config.js";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import { audit } from "../audit.js";
import { requireAdmin, requirePerm } from "../admin/guard.js";
import { permissionsSchema, storedPermissions, type AreaKey, type Level } from "../lib/permissions.js";
import { isAdminRole } from "../auth/session.js";
import type { Mailer } from "../lib/mailer.js";
import { newToken, sha256 } from "../lib/security.js";
import { ROLE_LABEL } from "../lib/roles.js";
import { EMAIL_AUTOMATION_KEY, emailAutomationSchema, getEmailAutomation, putSetting } from "../lib/settings.js";
import { SEGMENTS, SEGMENT_KEYS, loadTemplate, readUnsubscribeToken, renderTemplate, runCampaign, segmentRecipients, sendTemplate } from "../mail/service.js";
import { TEMPLATES, TEMPLATE_BY_KEY, render } from "../mail/templates.js";

const PAGE = 25;
const uuid = z.string().uuid();
export const secretOf = (c: Pick<Config, "ADMIN_SECRET_KEY" | "REVALIDATE_SECRET">) => c.ADMIN_SECRET_KEY ?? c.REVALIDATE_SECRET ?? "mishowo-dev-unsubscribe-secret";

const templateBody = z.object({ subject: z.string().trim().min(3).max(150), body: z.string().trim().min(10).max(5000), enabled: z.boolean() });
const campaignBody = z.object({
  subject: z.string().trim().min(3).max(150),
  body: z.string().trim().min(10).max(8000),
  kind: z.enum(["servicio", "novedades"]),
  segment: z.enum(SEGMENT_KEYS),
  scheduledAt: z.string().datetime().nullable().optional(),
});

const unknownVars = (text: string, allowed: string[]) => [...text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]!).filter((v) => !allowed.includes(v));

export function adminMailRoutes(app: FastifyInstance, db: Db, config: Config, mailer: Mailer) {
  // Permiso por área: plantillas y comunicados son «emails»; la bandeja de contacto es «consultas»; invitar al equipo es solo del Owner.
  const ctxOf = (req: Parameters<typeof requireAdmin>[2], reply: Parameters<typeof requireAdmin>[3], need: readonly [AreaKey, Level] | "owner") =>
    need === "owner" ? requireAdmin(db, config, req, reply, ["owner"]) : requirePerm(db, config, req, reply, need[0], need[1]);
  const exampleVars = (key: string) => Object.fromEntries((TEMPLATE_BY_KEY.get(key)?.vars ?? []).map((v) => [v.name, v.example]));

  // ───────────────────────── Plantillas ─────────────────────────
  app.get("/admin/emails/templates", async (req, reply) => {
    const ctx = await ctxOf(req, reply, ["emails", "view"]);
    if (!ctx) return;
    const rows = await db.select().from(s.emailTemplates);
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return {
      templates: TEMPLATES.map((d) => {
        const r = byKey.get(d.key);
        return {
          key: d.key, name: d.name, group: d.group, description: d.description, trigger: d.trigger, locked: !!d.locked, vars: d.vars, hasButton: !!d.cta,
          subject: r?.subject ?? d.subject, body: r?.body ?? d.body, enabled: d.locked ? true : (r?.enabled ?? !d.defaultOff), customized: !!r,
          defaultSubject: d.subject, defaultBody: d.body, updatedAt: r?.updatedAt ?? null,
        };
      }),
    };
  });

  app.put<{ Params: { key: string } }>("/admin/emails/templates/:key", async (req, reply) => {
    const ctx = await ctxOf(req, reply, ["emails", "manage"]);
    if (!ctx) return;
    const def = TEMPLATE_BY_KEY.get(req.params.key);
    if (!def) return reply.code(404).send({ error: "not_found" });
    const p = templateBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request" });
    const allowed = def.vars.map((v) => v.name);
    const bad = [...new Set([...unknownVars(p.data.subject, allowed), ...unknownVars(p.data.body, allowed)])];
    if (bad.length > 0) return reply.code(422).send({ error: "unknown_variables", variables: bad, allowed });
    // Sin su enlace, un mail de acceso queda inútil: se frena antes de que alguien pierda el acceso a su cuenta.
    if (def.locked && allowed.includes("link") && !p.data.body.includes("{{link}}")) return reply.code(422).send({ error: "link_required" });
    if (def.locked && !p.data.enabled) return reply.code(422).send({ error: "template_locked" });
    const before = await loadTemplate(db, def.key);
    await db.insert(s.emailTemplates).values({ key: def.key, subject: p.data.subject, body: p.data.body, enabled: p.data.enabled, updatedBy: ctx.user.id })
      .onConflictDoUpdate({ target: s.emailTemplates.key, set: { subject: p.data.subject, body: p.data.body, enabled: p.data.enabled, updatedBy: ctx.user.id, updatedAt: new Date() } });
    await audit(db, { actorId: ctx.user.id, action: "email_template.update", entity: "email_template", entityId: def.key, before: before ? { subject: before.subject, body: before.body, enabled: before.enabled } : null, after: p.data, ip: ctx.ip });
    return { ok: true };
  });

  app.delete<{ Params: { key: string } }>("/admin/emails/templates/:key", async (req, reply) => {
    const ctx = await ctxOf(req, reply, ["emails", "manage"]);
    if (!ctx) return;
    if (!TEMPLATE_BY_KEY.has(req.params.key)) return reply.code(404).send({ error: "not_found" });
    const before = await loadTemplate(db, req.params.key);
    await db.delete(s.emailTemplates).where(eq(s.emailTemplates.key, req.params.key));
    await audit(db, { actorId: ctx.user.id, action: "email_template.reset", entity: "email_template", entityId: req.params.key, before: before ? { subject: before.subject, body: before.body } : null, ip: ctx.ip });
    return { ok: true };
  });

  // Vista previa con datos de ejemplo (sirve también para lo que todavía no se guardó).
  app.post<{ Params: { key: string } }>("/admin/emails/templates/:key/preview", async (req, reply) => {
    const ctx = await ctxOf(req, reply, ["emails", "view"]);
    if (!ctx) return;
    const def = TEMPLATE_BY_KEY.get(req.params.key);
    if (!def) return reply.code(404).send({ error: "not_found" });
    const p = z.object({ subject: z.string().max(150).optional(), body: z.string().max(5000).optional() }).safeParse(req.body ?? {});
    if (!p.success) return reply.code(400).send({ error: "invalid_request" });
    const cur = await loadTemplate(db, def.key);
    return render({ subject: p.data.subject ?? cur!.subject, body: p.data.body ?? cur!.body, ...(def.cta ? { cta: def.cta } : {}) }, exampleVars(def.key));
  });

  // Se manda al propio email de quien prueba, nunca a un tercero.
  app.post<{ Params: { key: string } }>("/admin/emails/templates/:key/test", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const ctx = await ctxOf(req, reply, ["emails", "view"]);
    if (!ctx) return;
    const def = TEMPLATE_BY_KEY.get(req.params.key);
    if (!def) return reply.code(404).send({ error: "not_found" });
    const r = await renderTemplate(db, def.key, exampleVars(def.key));
    if (!r) return reply.code(404).send({ error: "not_found" });
    try { await mailer.send({ to: ctx.user.email, subject: `[PRUEBA] ${r.subject}`, text: r.text, html: r.html }); }
    catch { return reply.code(502).send({ error: "mail_failed" }); }
    return { ok: true, to: ctx.user.email };
  });

  // ───────────────────────── Automatizaciones ─────────────────────────
  app.get("/admin/emails/automation", async (req, reply) => {
    const ctx = await ctxOf(req, reply, ["emails", "view"]);
    if (!ctx) return;
    return getEmailAutomation(db);
  });
  app.put("/admin/emails/automation", async (req, reply) => {
    const ctx = await ctxOf(req, reply, ["emails", "manage"]);
    if (!ctx) return;
    const p = emailAutomationSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request" });
    const before = await getEmailAutomation(db);
    await putSetting(db, EMAIL_AUTOMATION_KEY, p.data);
    await audit(db, { actorId: ctx.user.id, action: "email_automation.update", entity: "settings", entityId: EMAIL_AUTOMATION_KEY, before, after: p.data, ip: ctx.ip });
    return { ok: true };
  });

  // ───────────────────────── Comunicados ─────────────────────────
  app.get("/admin/emails/segments", async (req, reply) => {
    const ctx = await ctxOf(req, reply, ["emails", "view"]);
    if (!ctx) return;
    const out = [];
    for (const seg of SEGMENTS) out.push({ ...seg, count: (await segmentRecipients(db, seg.key, "servicio")).length });
    return { segments: out };
  });

  const view = (c: typeof s.emailCampaigns.$inferSelect) => ({
    id: c.id, subject: c.subject, body: c.body, kind: c.kind, segment: c.segment, status: c.status, scheduledAt: c.scheduledAt, sentAt: c.sentAt, recipients: c.recipients, failed: c.failed, createdAt: c.createdAt,
  });

  app.get("/admin/emails/campaigns", async (req, reply) => {
    const ctx = await ctxOf(req, reply, ["emails", "view"]);
    if (!ctx) return;
    const rows = await db.select().from(s.emailCampaigns).orderBy(desc(s.emailCampaigns.createdAt)).limit(100);
    return { campaigns: rows.map(view) };
  });

  app.post("/admin/emails/campaigns", async (req, reply) => {
    const ctx = await ctxOf(req, reply, ["emails", "manage"]);
    if (!ctx) return;
    const p = campaignBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request" });
    const when = p.data.scheduledAt ? new Date(p.data.scheduledAt) : null;
    if (when && when.getTime() < Date.now() + 60_000) return reply.code(422).send({ error: "schedule_in_past" });
    const [c] = await db.insert(s.emailCampaigns).values({ subject: p.data.subject, body: p.data.body, kind: p.data.kind, segment: p.data.segment, status: when ? "programado" : "borrador", scheduledAt: when, createdBy: ctx.user.id }).returning();
    await audit(db, { actorId: ctx.user.id, action: "campaign.create", entity: "campaign", entityId: c!.id, after: { subject: c!.subject, segment: c!.segment, kind: c!.kind, status: c!.status }, ip: ctx.ip });
    return reply.code(201).send(view(c!));
  });

  app.put<{ Params: { id: string } }>("/admin/emails/campaigns/:id", async (req, reply) => {
    const ctx = await ctxOf(req, reply, ["emails", "manage"]);
    if (!ctx) return;
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const p = campaignBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request" });
    const when = p.data.scheduledAt ? new Date(p.data.scheduledAt) : null;
    if (when && when.getTime() < Date.now() + 60_000) return reply.code(422).send({ error: "schedule_in_past" });
    const [c] = await db.update(s.emailCampaigns).set({ subject: p.data.subject, body: p.data.body, kind: p.data.kind, segment: p.data.segment, scheduledAt: when, status: when ? "programado" : "borrador" })
      .where(and(eq(s.emailCampaigns.id, req.params.id), sql`${s.emailCampaigns.status} in ('borrador','programado')`)).returning();
    if (!c) return reply.code(409).send({ error: "not_editable" });
    await audit(db, { actorId: ctx.user.id, action: "campaign.update", entity: "campaign", entityId: c.id, after: { subject: c.subject, segment: c.segment, status: c.status }, ip: ctx.ip });
    return view(c);
  });

  app.post<{ Params: { id: string } }>("/admin/emails/campaigns/:id/send", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req, reply) => {
    const ctx = await ctxOf(req, reply, ["emails", "manage"]);
    if (!ctx) return;
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const out = await runCampaign({ db, mailer, appUrl: config.APP_URL, secret: secretOf(config), log: (m) => app.log.warn(m) }, req.params.id);
    if (!out) return reply.code(409).send({ error: "not_sendable" });
    await audit(db, { actorId: ctx.user.id, action: "campaign.send", entity: "campaign", entityId: req.params.id, after: out, ip: ctx.ip });
    return out;
  });

  app.post<{ Params: { id: string } }>("/admin/emails/campaigns/:id/cancel", async (req, reply) => {
    const ctx = await ctxOf(req, reply, ["emails", "manage"]);
    if (!ctx) return;
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const r = await db.update(s.emailCampaigns).set({ status: "cancelado" }).where(and(eq(s.emailCampaigns.id, req.params.id), sql`${s.emailCampaigns.status} in ('borrador','programado')`)).returning({ id: s.emailCampaigns.id });
    if (r.length === 0) return reply.code(409).send({ error: "not_cancellable" });
    await audit(db, { actorId: ctx.user.id, action: "campaign.cancel", entity: "campaign", entityId: req.params.id, ip: ctx.ip });
    return { ok: true };
  });

  // ───────────────────────── Consultas y arrepentimientos (bandeja de soporte) ─────────────────────────
  app.get("/admin/contact", async (req, reply) => {
    const ctx = await ctxOf(req, reply, ["consultas", "view"]);
    if (!ctx) return;
    const q = z.object({
      status: z.enum(["nuevo", "resuelto", "todas"]).default("nuevo"),
      page: z.coerce.number().int().min(1).max(10_000).default(1),
      q: z.string().trim().max(100).default(""),
    }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_request" });
    // Búsqueda por email, nombre o código de seguimiento (los primeros 8 caracteres del id).
    const like = `%${q.data.q.replace(/[\\%_]/g, "\\$&")}%`;
    const search = q.data.q ? or(ilike(s.contactRequests.email, like), ilike(s.contactRequests.name, like), sql`${s.contactRequests.id}::text like ${like.toLowerCase()}`) : undefined;
    const where = and(q.data.status === "todas" ? undefined : eq(s.contactRequests.status, q.data.status), search);
    const [rows, total, counts] = await Promise.all([
      db.select().from(s.contactRequests).where(where).orderBy(q.data.status === "nuevo" ? s.contactRequests.createdAt : desc(s.contactRequests.createdAt)).limit(PAGE).offset((q.data.page - 1) * PAGE),
      db.select({ n: sql<number>`count(*)::int` }).from(s.contactRequests).where(where),
      db.select({ status: s.contactRequests.status, n: sql<number>`count(*)::int` }).from(s.contactRequests).groupBy(s.contactRequests.status),
    ]);
    return {
      page: q.data.page, pageSize: PAGE, total: total[0]?.n ?? 0,
      counts: { nuevo: counts.find((c) => c.status === "nuevo")?.n ?? 0, resuelto: counts.find((c) => c.status === "resuelto")?.n ?? 0 },
      items: rows.map((r) => ({ id: r.id, code: r.id.slice(0, 8), kind: r.kind, name: r.name, email: r.email, reference: r.reference, message: r.message, status: r.status, internalNote: r.internalNote, repliedAt: r.repliedAt, handledAt: r.handledAt, createdAt: r.createdAt })),
    };
  });

  app.patch<{ Params: { id: string } }>("/admin/contact/:id", async (req, reply) => {
    const ctx = await ctxOf(req, reply, ["consultas", "manage"]);
    if (!ctx) return;
    const p = z.object({ status: z.enum(["nuevo", "resuelto"]), note: z.string().trim().max(1000).optional() }).safeParse(req.body);
    if (!p.success || !uuid.safeParse(req.params.id).success) return reply.code(400).send({ error: "invalid_request" });
    const [row] = await db.update(s.contactRequests).set({ status: p.data.status, handledBy: ctx.user.id, handledAt: new Date(), ...(p.data.note !== undefined ? { internalNote: p.data.note } : {}) }).where(eq(s.contactRequests.id, req.params.id)).returning();
    if (!row) return reply.code(404).send({ error: "not_found" });
    await audit(db, { actorId: ctx.user.id, action: `contact.${p.data.status}`, entity: "contact_request", entityId: row.id, after: { status: p.data.status }, ip: ctx.ip });
    return { ok: true };
  });

  // Respuesta al cliente desde el panel: sale del mismo SMTP y queda registrada (y la consulta pasa a resuelta).
  app.post<{ Params: { id: string } }>("/admin/contact/:id/reply", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req, reply) => {
    const ctx = await ctxOf(req, reply, ["consultas", "manage"]);
    if (!ctx) return;
    const p = z.object({ message: z.string().trim().min(5).max(3000) }).safeParse(req.body);
    if (!p.success || !uuid.safeParse(req.params.id).success) return reply.code(400).send({ error: "invalid_request" });
    const [row] = await db.select().from(s.contactRequests).where(eq(s.contactRequests.id, req.params.id));
    if (!row) return reply.code(404).send({ error: "not_found" });
    const text = `Hola ${row.name},\n\n${p.data.message}\n\nCódigo de seguimiento: ${row.id.slice(0, 8)}\nEl equipo de MiShowo`;
    const r = render({ subject: `Re: ${row.kind === "arrepentimiento" ? "tu solicitud de arrepentimiento" : "tu consulta"} (${row.id.slice(0, 8)})`, body: text }, {});
    try { await mailer.send({ to: row.email, subject: r.subject, text: r.text, html: r.html }); }
    catch { return reply.code(502).send({ error: "mail_failed" }); }
    await db.update(s.contactRequests).set({ status: "resuelto", repliedAt: new Date(), handledBy: ctx.user.id, handledAt: new Date() }).where(eq(s.contactRequests.id, row.id));
    await audit(db, { actorId: ctx.user.id, action: "contact.reply", entity: "contact_request", entityId: row.id, after: { to: row.email }, ip: ctx.ip });
    return { ok: true };
  });

  // ───────────────────────── Alta de integrantes del equipo (solo Owner) ─────────────────────────
  app.post("/admin/admins/invite", async (req, reply) => {
    const ctx = await ctxOf(req, reply, "owner");
    if (!ctx) return;
    const p = z.object({ email: z.string().trim().toLowerCase().email().max(254), name: z.string().trim().min(2).max(80), role: z.enum(["admin", "support"]), permissions: permissionsSchema.optional() }).safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request" });
    const stored = storedPermissions(p.data.role, p.data.permissions);
    const [existing] = await db.select().from(s.users).where(eq(s.users.email, p.data.email));
    if (existing?.role === "owner") return reply.code(409).send({ error: "is_owner" });
    if (existing && isAdminRole(existing.role)) return reply.code(409).send({ error: "already_member" });
    const raw = newToken();
    const user = await db.transaction(async (tx) => {
      // Si la persona ya tenía cuenta, se le suma el rol (y se cierran sus sesiones para que vuelva a entrar con 2FA).
      const u = existing
        ? (await tx.update(s.users).set({ role: p.data.role, permissions: stored, name: existing.name ?? p.data.name }).where(eq(s.users.id, existing.id)).returning())[0]!
        : (await tx.insert(s.users).values({ email: p.data.email, name: p.data.name, role: p.data.role, permissions: stored, emailVerifiedAt: new Date() }).returning())[0]!;
      if (existing) await tx.delete(s.sessions).where(eq(s.sessions.userId, u.id));
      await tx.update(s.authTokens).set({ usedAt: new Date() }).where(and(eq(s.authTokens.email, u.email), eq(s.authTokens.type, "reset"), sql`${s.authTokens.usedAt} is null`));
      await tx.insert(s.authTokens).values({ userId: u.id, email: u.email, type: "reset", tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 3 * 86_400_000) });
      await audit(tx, { actorId: ctx.user.id, action: "admin.invite", entity: "user", entityId: u.id, before: existing ? { role: existing.role } : null, after: { role: p.data.role, email: u.email, ...(stored ? { permissions: stored } : {}) }, ip: ctx.ip });
      return u;
    });
    const sent = await sendTemplate(db, mailer, "staff_invite", user.email, { name: p.data.name, role: ROLE_LABEL[p.data.role] ?? p.data.role, link: `${config.APP_URL}/restablecer?token=${encodeURIComponent(raw)}` }, (e) => app.log.error({ err: e }, "no se pudo enviar la invitación"));
    return reply.code(201).send({ ok: true, id: user.id, emailSent: sent, existing: !!existing });
  });

  // ───────── Gestión del equipo: mails, reenvío de invitación y reinicio de 2FA (solo Owner) ─────────
  const staffOf = async (id: string) => {
    if (!uuid.safeParse(id).success) return null;
    const [u] = await db.select().from(s.users).where(eq(s.users.id, id));
    return u && isAdminRole(u.role) ? u : null;
  };
  const staffMail = z.object({ subject: z.string().trim().min(3).max(150), body: z.string().trim().min(5).max(5000) });

  /** Mail a una persona del equipo con el texto que escribe el Owner (con el mismo formato de marca que los demás). */
  app.post<{ Params: { id: string } }>("/admin/admins/:id/email", async (req, reply) => {
    const ctx = await ctxOf(req, reply, "owner");
    if (!ctx) return;
    const p = staffMail.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request" });
    const u = await staffOf(req.params.id);
    if (!u) return reply.code(404).send({ error: "not_found" });
    const r = render({ subject: p.data.subject, body: p.data.body }, {});
    try { await mailer.send({ to: u.email, subject: r.subject, text: r.text, ...(r.html ? { html: r.html } : {}) }); }
    catch (e) { app.log.error({ err: e }, "no se pudo enviar el mail al equipo"); return reply.code(502).send({ error: "mail_failed" }); }
    await audit(db, { actorId: ctx.user.id, action: "admin.email", entity: "user", entityId: u.id, after: { subject: p.data.subject }, ip: ctx.ip });
    return { ok: true };
  });

  /** Comunicado a todo el equipo (o a las personas elegidas). Un fallo con una persona no frena al resto. */
  app.post("/admin/admins/email", async (req, reply) => {
    const ctx = await ctxOf(req, reply, "owner");
    if (!ctx) return;
    const p = staffMail.extend({ ids: z.array(z.string().uuid()).max(100).optional() }).safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request" });
    const team = (await db.select().from(s.users).where(and(sql`${s.users.role} in ('owner','admin','support')`, sql`${s.users.blockedAt} is null`)))
      .filter((u) => !p.data.ids || p.data.ids.includes(u.id));
    if (team.length === 0) return reply.code(400).send({ error: "no_recipients" });
    const r = render({ subject: p.data.subject, body: p.data.body }, {});
    let sent = 0, failed = 0;
    for (const u of team) {
      try { await mailer.send({ to: u.email, subject: r.subject, text: r.text, ...(r.html ? { html: r.html } : {}) }); sent++; }
      catch (e) { failed++; app.log.error({ err: e }, "no se pudo enviar el comunicado"); }
    }
    await audit(db, { actorId: ctx.user.id, action: "admin.email_all", entity: "team", entityId: ctx.user.id, after: { subject: p.data.subject, sent, failed }, ip: ctx.ip });
    return { sent, failed };
  });

  /** Vuelve a mandar el mail para elegir contraseña (el enlace anterior deja de valer). */
  app.post<{ Params: { id: string } }>("/admin/admins/:id/resend-invite", async (req, reply) => {
    const ctx = await ctxOf(req, reply, "owner");
    if (!ctx) return;
    const u = await staffOf(req.params.id);
    if (!u || u.role === "owner") return reply.code(404).send({ error: "not_found" });
    const raw = newToken();
    await db.transaction(async (tx) => {
      await tx.update(s.authTokens).set({ usedAt: new Date() }).where(and(eq(s.authTokens.email, u.email), eq(s.authTokens.type, "reset"), sql`${s.authTokens.usedAt} is null`));
      await tx.insert(s.authTokens).values({ userId: u.id, email: u.email, type: "reset", tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 3 * 86_400_000) });
      await audit(tx, { actorId: ctx.user.id, action: "admin.resend_invite", entity: "user", entityId: u.id, ip: ctx.ip });
    });
    const sent = await sendTemplate(db, mailer, "staff_invite", u.email, { name: u.name ?? "equipo", role: ROLE_LABEL[u.role] ?? u.role, link: `${config.APP_URL}/restablecer?token=${encodeURIComponent(raw)}` }, (e) => app.log.error({ err: e }, "no se pudo reenviar la invitación"));
    return { ok: true, emailSent: sent };
  });

  /** Para quien perdió su app de autenticación: borra el 2FA y cierra sus sesiones; al entrar configura uno nuevo. */
  app.post<{ Params: { id: string } }>("/admin/admins/:id/reset-2fa", async (req, reply) => {
    const ctx = await ctxOf(req, reply, "owner");
    if (!ctx) return;
    const u = await staffOf(req.params.id);
    if (!u) return reply.code(404).send({ error: "not_found" });
    if (u.id === ctx.user.id) return reply.code(409).send({ error: "cannot_target_self" });
    await db.transaction(async (tx) => {
      await tx.update(s.users).set({ totpSecret: null, totpEnabledAt: null }).where(eq(s.users.id, u.id));
      await tx.delete(s.sessions).where(eq(s.sessions.userId, u.id));
      await audit(tx, { actorId: ctx.user.id, action: "admin.reset_2fa", entity: "user", entityId: u.id, ip: ctx.ip });
    });
    return { ok: true };
  });
}

/** Baja de novedades con un enlace firmado: no pide sesión (se abre desde el mail). */
export function publicMailRoutes(app: FastifyInstance, db: Db, config: Config) {
  const secret = secretOf(config);
  app.post("/public/unsubscribe", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req, reply) => {
    const p = z.object({ token: z.string().min(40).max(200) }).safeParse(req.body);
    const id = p.success ? readUnsubscribeToken(secret, p.data.token) : null;
    if (!id) return reply.code(400).send({ error: "invalid_token" });
    const r = await db.update(s.users).set({ newsletterOptoutAt: new Date() }).where(eq(s.users.id, id)).returning({ id: s.users.id });
    if (r.length === 0) return reply.code(400).send({ error: "invalid_token" });
    return { ok: true };
  });
}

