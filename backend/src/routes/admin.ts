import type { FastifyInstance } from "fastify";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Config } from "../config.js";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import { audit } from "../audit.js";
import { requireAdmin, requireAdminSession } from "../admin/guard.js";
import { ADMIN_ROLES, isAdminRole, strictOriginOk } from "../auth/session.js";
import { newTotpSecret, otpauthUrl, verifyTotp } from "../auth/totp.js";
import { decryptSecret, encryptSecret } from "../lib/crypto.js";
import { activatePlan } from "../billing/activate.js";
import { PAYMENT_KEY, getPaymentInfo, paymentInfoSchema } from "../billing/settings.js";
import type { Mailer } from "../lib/mailer.js";
import type { StorageProvider } from "../storage/index.js";
import type { SiteChanged } from "../lib/revalidate.js";
import { sniff } from "../storage/sniff.js";

const PAGE = 25;
const uuid = z.string().uuid();
const page = z.coerce.number().int().min(1).max(10_000).default(1);
const MANAGE = ["owner", "admin"] as const; // Soporte mira y deja notas, pero no toca planes, pagos ni moderación

const limitsSchema = z.object({
  products: z.number().int().min(1).max(100_000).nullable(),
  photosPerProduct: z.number().int().min(0).max(50),
  whatsappNumbers: z.number().int().min(1).max(20),
  uploadMb: z.number().int().min(1).max(100),
});
const planSchema = z.object({
  name: z.string().trim().min(2).max(40),
  priceMonthly: z.number().min(0).max(10_000_000),
  limits: limitsSchema,
  features: z.array(z.string().trim().min(1).max(80)).max(12),
  active: z.boolean(),
});

const dateAr = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });

export function adminRoutes(app: FastifyInstance, db: Db, config: Config, mailer: Mailer, storage: StorageProvider, notify: SiteChanged) {
  // CSRF: solo pedidos que vengan del sitio principal.
  app.addHook("onRequest", async (req, reply) => {
    if (!strictOriginOk(config, req)) return reply.code(403).send({ error: "bad_origin" });
  });
  const safeMail = async (m: Parameters<Mailer["send"]>[0]) => { try { await mailer.send(m); } catch (e) { app.log.error({ err: e }, "no se pudo enviar el email"); } };
  const keyOk = () => !!config.ADMIN_SECRET_KEY;

  // ───────────────────────── 2FA ─────────────────────────
  app.get("/admin/me", async (req, reply) => {
    const ctx = await requireAdminSession(db, config, req, reply);
    if (!ctx) return;
    const verified = !!ctx.session.adminVerifiedAt && Date.now() - ctx.session.adminVerifiedAt.getTime() < config.ADMIN_VERIFY_HOURS * 3600_000;
    reply.header("Cache-Control", "no-store");
    return { user: { id: ctx.user.id, email: ctx.user.email, role: ctx.user.role }, totpEnabled: !!ctx.user.totpEnabledAt, verified };
  });

  app.post("/admin/2fa/setup", { config: { rateLimit: { max: config.ADMIN_2FA_PER_MINUTE, timeWindow: "1 minute" } } }, async (req, reply) => {
    const ctx = await requireAdminSession(db, config, req, reply);
    if (!ctx) return;
    if (!keyOk()) return reply.code(503).send({ error: "admin_not_configured" });
    if (ctx.user.totpEnabledAt) return reply.code(409).send({ error: "already_enabled" });
    const secret = newTotpSecret();
    await db.update(s.users).set({ totpSecret: encryptSecret(secret, config.ADMIN_SECRET_KEY!) }).where(eq(s.users.id, ctx.user.id));
    return { secret, otpauthUrl: otpauthUrl(ctx.user.email, secret) };
  });

  const codeBody = z.object({ code: z.string().regex(/^\d{6}$/) });

  async function check2fa(userId: string, code: string): Promise<boolean> {
    const [u] = await db.select({ secret: s.users.totpSecret }).from(s.users).where(eq(s.users.id, userId));
    if (!u?.secret || !keyOk()) return false;
    try { return verifyTotp(decryptSecret(u.secret, config.ADMIN_SECRET_KEY!), code); } catch { return false; }
  }

  app.post("/admin/2fa/enable", { config: { rateLimit: { max: config.ADMIN_2FA_PER_MINUTE, timeWindow: "1 minute" } } }, async (req, reply) => {
    const ctx = await requireAdminSession(db, config, req, reply);
    if (!ctx) return;
    const p = codeBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_code" });
    if (ctx.user.totpEnabledAt) return reply.code(409).send({ error: "already_enabled" });
    if (!ctx.user.totpSecret) return reply.code(409).send({ error: "setup_required" });
    if (!(await check2fa(ctx.user.id, p.data.code))) return reply.code(401).send({ error: "invalid_code" });
    await db.transaction(async (tx) => {
      await tx.update(s.users).set({ totpEnabledAt: new Date() }).where(eq(s.users.id, ctx.user.id));
      await tx.update(s.sessions).set({ adminVerifiedAt: new Date() }).where(eq(s.sessions.id, ctx.session.id));
      await audit(tx, { actorId: ctx.user.id, action: "admin.2fa_enabled", entity: "user", entityId: ctx.user.id, ip: ctx.ip });
    });
    return { ok: true };
  });

  app.post("/admin/2fa/verify", { config: { rateLimit: { max: config.ADMIN_2FA_PER_MINUTE, timeWindow: "1 minute" } } }, async (req, reply) => {
    const ctx = await requireAdminSession(db, config, req, reply);
    if (!ctx) return;
    const p = codeBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_code" });
    if (!ctx.user.totpEnabledAt) return reply.code(409).send({ error: "setup_required" });
    if (!(await check2fa(ctx.user.id, p.data.code))) {
      await audit(db, { actorId: ctx.user.id, action: "admin.2fa_failed", entity: "user", entityId: ctx.user.id, ip: ctx.ip });
      return reply.code(401).send({ error: "invalid_code" });
    }
    await db.update(s.sessions).set({ adminVerifiedAt: new Date() }).where(eq(s.sessions.id, ctx.session.id));
    await audit(db, { actorId: ctx.user.id, action: "admin.login", entity: "user", entityId: ctx.user.id, ip: ctx.ip });
    return { ok: true };
  });

  // ───────────────────────── Dashboard ─────────────────────────
  app.get("/admin/dashboard", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply);
    if (!ctx) return;
    const one = async <T,>(q: ReturnType<typeof sql>) => ((await db.execute(q)).rows[0] ?? {}) as T;
    const many = async <T,>(q: ReturnType<typeof sql>) => (await db.execute(q)).rows as T[];
    const [k, mrr, orders7, pending, churn, converted, reportsNew, byPlan, byIndustry, signups] = await Promise.all([
      one<Record<string, number>>(sql`select
        count(*) filter (where deleted_at is null)::int as total,
        count(*) filter (where deleted_at is null and status = 'published')::int as published,
        count(*) filter (where deleted_at is null and status = 'suspended')::int as suspended,
        count(*) filter (where deleted_at is null and created_at >= date_trunc('day', now()))::int as today,
        count(*) filter (where deleted_at is null and created_at >= now() - interval '7 days')::int as week,
        count(*) filter (where deleted_at is null and created_at >= now() - interval '30 days')::int as month,
        count(*) filter (where deleted_at is null and plan_id <> 'gratis' and plan_expires_at > now())::int as paid_active,
        count(*) filter (where deleted_at is null and plan_id <> 'gratis' and plan_expires_at between now() and now() + interval '7 days')::int as expiring_7d
        from businesses`),
      one<{ mrr: string }>(sql`select coalesce(sum(p.price_monthly), 0)::text as mrr from businesses b join plans p on p.id = b.plan_id
        where b.deleted_at is null and b.plan_id <> 'gratis' and b.plan_expires_at > now()`),
      one<{ n: number }>(sql`select count(distinct business_id)::int as n from orders where created_at >= now() - interval '7 days'`),
      one<{ n: number; oldest: Date | null }>(sql`select count(*)::int as n, min(created_at) as oldest from payments where status = 'pendiente'`),
      one<{ n: number }>(sql`select count(*)::int as n from audit_log where action = 'plan.expired' and created_at >= now() - interval '30 days'`),
      one<{ n: number }>(sql`select count(distinct business_id)::int as n from payments where status = 'confirmado'`),
      one<{ n: number }>(sql`select count(*)::int as n from reports where status = 'nuevo'`),
      many<{ plan_id: string; n: number }>(sql`select plan_id, count(*)::int as n from businesses where deleted_at is null group by plan_id order by n desc`),
      many<{ industry: string; n: number }>(sql`select industry, count(*)::int as n from businesses where deleted_at is null group by industry order by n desc`),
      many<{ day: string; n: number }>(sql`select to_char(d, 'YYYY-MM-DD') as day, count(b.id)::int as n
        from generate_series(current_date - 29, current_date, interval '1 day') d
        left join businesses b on b.created_at::date = d::date and b.deleted_at is null group by d order by d`),
    ]);
    const total = k.total ?? 0;
    reply.header("Cache-Control", "no-store");
    return {
      kpis: {
        businesses: total, published: k.published, suspended: k.suspended, newToday: k.today, newWeek: k.week, newMonth: k.month,
        active7d: orders7.n ?? 0, paidActive: k.paid_active, mrr: Number(mrr.mrr ?? 0), expiring7d: k.expiring_7d,
        churn30d: churn.n ?? 0, conversion: total > 0 ? Math.round(((converted.n ?? 0) / total) * 1000) / 10 : 0,
      },
      byPlan: byPlan.map((r) => ({ plan: r.plan_id, count: r.n })),
      byIndustry: byIndustry.map((r) => ({ industry: r.industry, count: r.n })),
      signups: signups.map((r) => ({ day: r.day, count: r.n })),
      alerts: { pendingPayments: pending.n ?? 0, oldestPending: pending.oldest, expiring7d: k.expiring_7d, newReports: reportsNew.n ?? 0 },
    };
  });

  // ───────────────────────── Negocios ─────────────────────────
  app.get("/admin/businesses", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply);
    if (!ctx) return;
    const q = z.object({ q: z.string().max(80).optional(), status: z.enum(["draft", "published", "suspended"]).optional(), plan: z.string().max(40).optional(), page }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_request" });
    const term = q.data.q?.trim();
    const where = and(
      isNull(s.businesses.deletedAt),
      q.data.status ? eq(s.businesses.status, q.data.status) : undefined,
      q.data.plan ? eq(s.businesses.planId, q.data.plan) : undefined,
      term ? or(ilike(s.businesses.name, `%${term}%`), ilike(s.businesses.slug, `%${term}%`), ilike(s.users.email, `%${term}%`)) : undefined,
    );
    const base = db.select({ b: s.businesses, email: s.users.email }).from(s.businesses).innerJoin(s.users, eq(s.users.id, s.businesses.ownerId)).where(where);
    const [rows, totalRow] = await Promise.all([
      base.orderBy(desc(s.businesses.createdAt)).limit(PAGE).offset((q.data.page - 1) * PAGE),
      db.select({ n: sql<number>`count(*)::int` }).from(s.businesses).innerJoin(s.users, eq(s.users.id, s.businesses.ownerId)).where(where),
    ]);
    return {
      page: q.data.page, pageSize: PAGE, total: totalRow[0]?.n ?? 0,
      businesses: rows.map(({ b, email }) => ({ id: b.id, slug: b.slug, name: b.name, industry: b.industry, status: b.status, planId: b.planId, planExpiresAt: b.planExpiresAt, ownerEmail: email, createdAt: b.createdAt })),
    };
  });

  app.get<{ Params: { id: string } }>("/admin/businesses/:id", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply);
    if (!ctx) return;
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [row] = await db.select({ b: s.businesses, owner: { id: s.users.id, email: s.users.email, name: s.users.name, blockedAt: s.users.blockedAt } })
      .from(s.businesses).innerJoin(s.users, eq(s.users.id, s.businesses.ownerId)).where(eq(s.businesses.id, req.params.id));
    if (!row) return reply.code(404).send({ error: "not_found" });
    const [counts, payments, history] = await Promise.all([
      db.execute(sql`select (select count(*)::int from products where business_id = ${row.b.id}) as products, (select count(*)::int from orders where business_id = ${row.b.id}) as orders`),
      db.select().from(s.payments).where(eq(s.payments.businessId, row.b.id)).orderBy(desc(s.payments.createdAt)).limit(20),
      db.select().from(s.auditLog).where(and(eq(s.auditLog.entity, "business"), eq(s.auditLog.entityId, row.b.id))).orderBy(desc(s.auditLog.id)).limit(20),
    ]);
    const { settings: _s, hours: _h, ...b } = row.b; void _s; void _h;
    return { business: b, owner: row.owner, counts: counts.rows[0], payments: payments.map((p) => ({ id: p.id, planId: p.planId, months: p.months, amount: Number(p.amount), status: p.status, createdAt: p.createdAt })), history };
  });

  const bizAction = (path: string, roles: readonly (typeof ADMIN_ROLES)[number][], run: (tx: Parameters<Parameters<Db["transaction"]>[0]>[0], biz: typeof s.businesses.$inferSelect, body: unknown, ctx: NonNullable<Awaited<ReturnType<typeof requireAdmin>>>) => Promise<{ action: string; after: Partial<typeof s.businesses.$inferSelect>; error?: undefined } | { error: string; status: number }>, method: "POST" | "PUT" | "DELETE" = "POST") => {
    app.route<{ Params: { id: string } }>({ method, url: `/admin/businesses/:id${path}`, handler: async (req, reply) => {
      const ctx = await requireAdmin(db, config, req, reply, roles);
      if (!ctx) return;
      if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
      const out = await db.transaction(async (tx): Promise<{ error: string; status: number } | { ok: true; slug: string }> => {
        const [biz] = await tx.select().from(s.businesses).where(and(eq(s.businesses.id, req.params.id), isNull(s.businesses.deletedAt)));
        if (!biz) return { error: "not_found", status: 404 };
        const res = await run(tx, biz, req.body, ctx);
        if (res.error !== undefined) return res;
        await tx.update(s.businesses).set(res.after).where(eq(s.businesses.id, biz.id));
        const before = Object.fromEntries(Object.keys(res.after).map((k) => [k, biz[k as keyof typeof biz]]));
        await audit(tx, { actorId: ctx.user.id, action: res.action, entity: "business", entityId: biz.id, before, after: res.after, ip: ctx.ip });
        return { ok: true as const, slug: biz.slug };
      });
      if ("error" in out) return reply.code(out.status).send({ error: out.error });
      notify(out.slug); // si es una página publicada, que se refleje al instante
      return { ok: true };
    } });
  };

  bizAction("/suspend", MANAGE, async (_tx, biz) => (biz.status === "suspended" ? { error: "already_suspended", status: 409 } : { action: "business.suspend", after: { status: "suspended" } }));
  bizAction("/reactivate", MANAGE, async (_tx, biz) =>
    biz.status !== "suspended" ? { error: "not_suspended", status: 409 } : { action: "business.reactivate", after: { status: biz.publishedAt ? "published" : "draft" } });
  bizAction("/unpublish", MANAGE, async (_tx, biz) => (biz.status !== "published" ? { error: "not_published", status: 409 } : { action: "business.unpublish", after: { status: "draft" } }));
  bizAction("", MANAGE, async (_tx, biz) => ({ action: "business.delete", after: { deletedAt: new Date(), status: biz.status === "suspended" ? "suspended" : "draft" } }), "DELETE");
  bizAction("/note", ADMIN_ROLES, async (_tx, _biz, body) => {
    const p = z.object({ note: z.string().trim().max(1000) }).safeParse(body);
    return p.success ? { action: "business.note", after: { internalNote: p.data.note || null } } : { error: "invalid_request", status: 400 };
  }, "PUT");
  bizAction("/plan", MANAGE, async (_tx, biz, body) => {
    const p = z.object({ planId: z.string().min(1).max(40), days: z.number().int().min(1).max(3650).optional() }).safeParse(body);
    if (!p.success) return { error: "invalid_request", status: 400 };
    const [plan] = await db.select().from(s.plans).where(eq(s.plans.id, p.data.planId));
    if (!plan) return { error: "invalid_plan", status: 422 };
    const free = plan.id === "gratis";
    if (!free && !p.data.days) return { error: "days_required", status: 422 };
    return { action: "business.plan_change", after: { planId: plan.id, planExpiresAt: free ? null : new Date(Date.now() + p.data.days! * 86_400_000), planReminderFor: null } };
  });

  // ───────────────────────── Usuarios ─────────────────────────
  app.get("/admin/users", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply);
    if (!ctx) return;
    const q = z.object({ q: z.string().max(80).optional(), page }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_request" });
    const term = q.data.q?.trim();
    const where = term ? or(ilike(s.users.email, `%${term}%`), ilike(s.users.name, `%${term}%`)) : undefined;
    const [rows, total] = await Promise.all([
      db.select({ id: s.users.id, email: s.users.email, name: s.users.name, role: s.users.role, emailVerifiedAt: s.users.emailVerifiedAt, blockedAt: s.users.blockedAt, lastLoginAt: s.users.lastLoginAt, createdAt: s.users.createdAt })
        .from(s.users).where(where).orderBy(desc(s.users.createdAt)).limit(PAGE).offset((q.data.page - 1) * PAGE),
      db.select({ n: sql<number>`count(*)::int` }).from(s.users).where(where),
    ]);
    return { page: q.data.page, pageSize: PAGE, total: total[0]?.n ?? 0, users: rows };
  });

  for (const [path, block] of [["block", true], ["unblock", false]] as const) {
    app.post<{ Params: { id: string } }>(`/admin/users/:id/${path}`, async (req, reply) => {
      const ctx = await requireAdmin(db, config, req, reply, MANAGE);
      if (!ctx) return;
      if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
      if (req.params.id === ctx.user.id) return reply.code(409).send({ error: "cannot_target_self" });
      const [target] = await db.select().from(s.users).where(eq(s.users.id, req.params.id));
      if (!target) return reply.code(404).send({ error: "not_found" });
      if (isAdminRole(target.role) && ctx.user.role !== "owner") return reply.code(403).send({ error: "forbidden_role" });
      await db.transaction(async (tx) => {
        await tx.update(s.users).set({ blockedAt: block ? new Date() : null }).where(eq(s.users.id, target.id));
        if (block) await tx.delete(s.sessions).where(eq(s.sessions.userId, target.id)); // se cierran todas sus sesiones
        await audit(tx, { actorId: ctx.user.id, action: block ? "user.block" : "user.unblock", entity: "user", entityId: target.id, before: { blockedAt: target.blockedAt }, after: { blocked: block }, ip: ctx.ip });
      });
      return { ok: true };
    });
  }

  // ───────────────────────── Pagos ─────────────────────────
  app.get("/admin/payments", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply, MANAGE);
    if (!ctx) return;
    const q = z.object({ status: z.enum(["pendiente", "confirmado", "rechazado"]).default("pendiente"), page }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_request" });
    const rows = await db.select({ p: s.payments, name: s.businesses.name, slug: s.businesses.slug, email: s.users.email })
      .from(s.payments).innerJoin(s.businesses, eq(s.businesses.id, s.payments.businessId)).innerJoin(s.users, eq(s.users.id, s.businesses.ownerId))
      .where(eq(s.payments.status, q.data.status))
      .orderBy(q.data.status === "pendiente" ? s.payments.createdAt : desc(s.payments.createdAt)).limit(PAGE).offset((q.data.page - 1) * PAGE);
    return {
      page: q.data.page, pageSize: PAGE,
      payments: rows.map(({ p, name, slug, email }) => ({ id: p.id, businessId: p.businessId, businessName: name, slug, ownerEmail: email, planId: p.planId, months: p.months, amount: Number(p.amount), method: p.method, status: p.status, note: p.note, rejectReason: p.rejectReason, hasReceipt: !!p.receiptPath, createdAt: p.createdAt, resolvedAt: p.resolvedAt })),
    };
  });

  app.get<{ Params: { id: string } }>("/admin/payments/:id/receipt", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply, MANAGE);
    if (!ctx) return;
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [p] = await db.select({ path: s.payments.receiptPath }).from(s.payments).where(eq(s.payments.id, req.params.id));
    const data = p?.path ? await storage.get(p.path) : null;
    const type = data && sniff(data);
    if (!data || !type) return reply.code(404).send({ error: "not_found" });
    return reply.header("Content-Type", type.mime).header("X-Content-Type-Options", "nosniff").header("Content-Security-Policy", "default-src 'none'; sandbox").header("Cache-Control", "private, no-store").send(data);
  });

  /** Confirma un pago pendiente y activa el plan. El UPDATE condicional hace que dos confirmaciones a la vez no se dupliquen. */
  async function confirm(paymentId: string, ctx: NonNullable<Awaited<ReturnType<typeof requireAdmin>>>) {
    const out = await db.transaction(async (tx) => {
      const [claimed] = await tx.update(s.payments).set({ status: "confirmado", resolvedAt: new Date(), resolvedBy: ctx.user.id })
        .where(and(eq(s.payments.id, paymentId), eq(s.payments.status, "pendiente"))).returning();
      if (!claimed) return null;
      const { business, endsAt } = await activatePlan(tx, claimed.businessId, claimed.planId, claimed.months);
      await audit(tx, { actorId: ctx.user.id, action: "payment.confirm", entity: "payment", entityId: claimed.id, before: { status: "pendiente", plan: business.planId, expiresAt: business.planExpiresAt }, after: { status: "confirmado", plan: claimed.planId, expiresAt: endsAt, months: claimed.months, amount: claimed.amount }, ip: ctx.ip });
      const [owner] = await tx.select({ email: s.users.email }).from(s.users).where(eq(s.users.id, business.ownerId));
      const [plan] = await tx.select({ name: s.plans.name }).from(s.plans).where(eq(s.plans.id, claimed.planId));
      return { slug: business.slug, email: owner?.email, planName: plan?.name ?? claimed.planId, endsAt };
    });
    if (!out) return null;
    if (out.email) await safeMail({ to: out.email, subject: `¡Tu plan ${out.planName} está activo!`, text: `Confirmamos tu pago. Tu plan ${out.planName} está activo hasta el ${dateAr(out.endsAt)}.\n\nGracias por elegir MiShowo.` });
    notify(out.slug);
    return out;
  }

  app.post<{ Params: { id: string } }>("/admin/payments/:id/confirm", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply, MANAGE);
    if (!ctx) return;
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const out = await confirm(req.params.id, ctx);
    if (!out) return reply.code(409).send({ error: "not_pending" });
    return { ok: true, expiresAt: out.endsAt };
  });

  app.post<{ Params: { id: string } }>("/admin/payments/:id/reject", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply, MANAGE);
    if (!ctx) return;
    const p = z.object({ reason: z.string().trim().min(3).max(300) }).safeParse(req.body);
    if (!p.success || !uuid.safeParse(req.params.id).success) return reply.code(400).send({ error: "invalid_request" });
    const out = await db.transaction(async (tx) => {
      const [rej] = await tx.update(s.payments).set({ status: "rechazado", rejectReason: p.data.reason, resolvedAt: new Date(), resolvedBy: ctx.user.id })
        .where(and(eq(s.payments.id, req.params.id), eq(s.payments.status, "pendiente"))).returning();
      if (!rej) return null;
      await audit(tx, { actorId: ctx.user.id, action: "payment.reject", entity: "payment", entityId: rej.id, before: { status: "pendiente" }, after: { status: "rechazado", reason: p.data.reason }, ip: ctx.ip });
      const [row] = await tx.select({ email: s.users.email }).from(s.businesses).innerJoin(s.users, eq(s.users.id, s.businesses.ownerId)).where(eq(s.businesses.id, rej.businessId));
      return row?.email ?? "";
    });
    if (out === null) return reply.code(409).send({ error: "not_pending" });
    if (out) await safeMail({ to: out, subject: "No pudimos confirmar tu pago", text: `No pudimos confirmar tu pago.\n\nMotivo: ${p.data.reason}\n\nPodés volver a avisar tu pago desde la sección de planes, o escribirnos para resolverlo.` });
    return { ok: true };
  });

  app.post("/admin/payments/manual", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply, MANAGE);
    if (!ctx) return;
    const p = z.object({
      businessId: uuid, planId: z.string().min(1).max(40), months: z.number().int().min(1).max(24),
      amount: z.number().min(0).max(100_000_000).optional(), method: z.enum(["transferencia", "efectivo", "otro"]), note: z.string().trim().max(300).optional(),
    }).safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request" });
    const [plan] = await db.select().from(s.plans).where(eq(s.plans.id, p.data.planId));
    const [biz] = await db.select({ id: s.businesses.id }).from(s.businesses).where(and(eq(s.businesses.id, p.data.businessId), isNull(s.businesses.deletedAt)));
    if (!plan || Number(plan.priceMonthly) <= 0) return reply.code(422).send({ error: "invalid_plan" });
    if (!biz) return reply.code(404).send({ error: "not_found" });
    const amount = (p.data.amount ?? (Math.round(Number(plan.priceMonthly) * 100) * p.data.months) / 100).toFixed(2);
    const [created] = await db.insert(s.payments).values({ businessId: biz.id, planId: plan.id, amount, months: p.data.months, method: p.data.method, note: p.data.note || "Registrado por el equipo" }).returning();
    const out = await confirm(created!.id, ctx);
    return reply.code(201).send({ id: created!.id, expiresAt: out?.endsAt ?? null });
  });

  // ───────────────────────── Planes y ajustes ─────────────────────────
  app.get("/admin/plans", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply, MANAGE);
    if (!ctx) return;
    const rows = await db.select().from(s.plans).orderBy(s.plans.priceMonthly);
    return { plans: rows.map((p) => ({ id: p.id, name: p.name, priceMonthly: Number(p.priceMonthly), limits: p.limits, features: p.features, active: p.active })) };
  });

  app.put<{ Params: { id: string } }>("/admin/plans/:id", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply, MANAGE);
    if (!ctx) return;
    if (!/^[a-z0-9-]{2,30}$/.test(req.params.id)) return reply.code(400).send({ error: "invalid_request" });
    const p = planSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request", issues: p.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) });
    // El plan gratuito tiene que seguir existiendo y costando $0: es donde caen las cuentas que no renuevan.
    if (req.params.id === "gratis" && (p.data.priceMonthly !== 0 || !p.data.active)) return reply.code(422).send({ error: "gratis_must_stay_free" });
    await db.transaction(async (tx) => {
      const [before] = await tx.select().from(s.plans).where(eq(s.plans.id, req.params.id));
      await tx.insert(s.plans).values({ id: req.params.id, name: p.data.name, priceMonthly: String(p.data.priceMonthly), limits: p.data.limits, features: p.data.features, active: p.data.active })
        .onConflictDoUpdate({ target: s.plans.id, set: { name: p.data.name, priceMonthly: String(p.data.priceMonthly), limits: p.data.limits, features: p.data.features, active: p.data.active } });
      await audit(tx, { actorId: ctx.user.id, action: before ? "plan.update" : "plan.create", entity: "plan", entityId: req.params.id, before: before ? { name: before.name, priceMonthly: Number(before.priceMonthly), limits: before.limits, features: before.features, active: before.active } : null, after: p.data, ip: ctx.ip });
    });
    return { ok: true };
  });

  app.get("/admin/settings/payment", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply, ["owner"]);
    if (!ctx) return;
    return getPaymentInfo(db);
  });
  app.put("/admin/settings/payment", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply, ["owner"]);
    if (!ctx) return;
    const p = paymentInfoSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request" });
    await db.transaction(async (tx) => {
      const before = await getPaymentInfo(tx);
      await tx.insert(s.appSettings).values({ key: PAYMENT_KEY, value: p.data }).onConflictDoUpdate({ target: s.appSettings.key, set: { value: p.data, updatedAt: new Date() } });
      await audit(tx, { actorId: ctx.user.id, action: "settings.payment", entity: "settings", entityId: PAYMENT_KEY, before, after: p.data, ip: ctx.ip });
    });
    return { ok: true };
  });

  // ───────────────────────── Administradores (solo Owner) ─────────────────────────
  app.get("/admin/admins", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply, ["owner"]);
    if (!ctx) return;
    const rows = await db.select({ id: s.users.id, email: s.users.email, role: s.users.role, totpEnabledAt: s.users.totpEnabledAt, lastLoginAt: s.users.lastLoginAt })
      .from(s.users).where(or(eq(s.users.role, "owner"), eq(s.users.role, "admin"), eq(s.users.role, "support"))).orderBy(s.users.createdAt);
    return { admins: rows.map((r) => ({ ...r, totpEnabled: !!r.totpEnabledAt })) };
  });

  app.post("/admin/admins", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply, ["owner"]);
    if (!ctx) return;
    const p = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(["admin", "support"]) }).safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request" });
    const [u] = await db.select().from(s.users).where(eq(s.users.email, p.data.email));
    if (!u) return reply.code(404).send({ error: "user_not_found" }); // la persona tiene que crearse una cuenta primero
    if (u.role === "owner") return reply.code(409).send({ error: "is_owner" });
    await db.transaction(async (tx) => {
      await tx.update(s.users).set({ role: p.data.role }).where(eq(s.users.id, u.id));
      await tx.delete(s.sessions).where(eq(s.sessions.userId, u.id)); // al cambiar de rol vuelve a ingresar (y pasar el 2FA)
      await audit(tx, { actorId: ctx.user.id, action: "admin.grant", entity: "user", entityId: u.id, before: { role: u.role }, after: { role: p.data.role }, ip: ctx.ip });
    });
    return reply.code(201).send({ ok: true });
  });

  app.delete<{ Params: { id: string } }>("/admin/admins/:id", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply, ["owner"]);
    if (!ctx) return;
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    if (req.params.id === ctx.user.id) return reply.code(409).send({ error: "cannot_target_self" });
    const [u] = await db.select().from(s.users).where(eq(s.users.id, req.params.id));
    if (!u || !isAdminRole(u.role)) return reply.code(404).send({ error: "not_found" });
    if (u.role === "owner") return reply.code(409).send({ error: "is_owner" });
    await db.transaction(async (tx) => {
      await tx.update(s.users).set({ role: "user", totpSecret: null, totpEnabledAt: null }).where(eq(s.users.id, u.id));
      await tx.delete(s.sessions).where(eq(s.sessions.userId, u.id));
      await audit(tx, { actorId: ctx.user.id, action: "admin.revoke", entity: "user", entityId: u.id, before: { role: u.role }, after: { role: "user" }, ip: ctx.ip });
    });
    return { ok: true };
  });

  // ───────────────────────── Auditoría ─────────────────────────
  app.get("/admin/audit", async (req, reply) => {
    const ctx = await requireAdmin(db, config, req, reply, MANAGE);
    if (!ctx) return;
    const q = z.object({ entity: z.string().max(30).optional(), entityId: z.string().max(64).optional(), action: z.string().max(40).optional(), page }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_request" });
    const where = and(q.data.entity ? eq(s.auditLog.entity, q.data.entity) : undefined, q.data.entityId ? eq(s.auditLog.entityId, q.data.entityId) : undefined, q.data.action ? eq(s.auditLog.action, q.data.action) : undefined);
    const rows = await db.select({ a: s.auditLog, actor: s.users.email }).from(s.auditLog).leftJoin(s.users, eq(s.users.id, s.auditLog.actorId)).where(where).orderBy(desc(s.auditLog.id)).limit(50).offset((q.data.page - 1) * 50);
    return { page: q.data.page, entries: rows.map(({ a, actor }) => ({ id: a.id, at: a.createdAt, actor: actor ?? null, action: a.action, entity: a.entity, entityId: a.entityId, before: a.before, after: a.after, ip: a.ip })) };
  });
}
