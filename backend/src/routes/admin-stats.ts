import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Config } from "../config.js";
import type { Db } from "../db/tenant.js";
import { requirePerm } from "../admin/guard.js";
import { can } from "../lib/permissions.js";

const query = z.object({ days: z.coerce.number().int().min(1).max(730).default(30) });
type Row = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0);
/** Cuentas técnicas (las de los negocios de ejemplo) no cuentan como personas. */
const REAL = sql`u.role = 'user' and u.email not like '%@mishowo.local'`;

/**
 * Estadísticas de la plataforma para medir marketing y conversión: de dónde llegan las personas, cuántas avanzan en el embudo
 * (registro → email confirmado → página creada → publicada → primer movimiento → plan pago), ingresos y actividad de las páginas.
 * Todo se calcula contra el período pedido y contra el período anterior de la misma duración.
 */
export function adminStatsRoutes(app: FastifyInstance, db: Db, config: Config) {
  app.get("/admin/stats", async (req, reply) => {
    const ctx = await requirePerm(db, config, req, reply, "negocios", "view");
    if (!ctx) return;
    const q = query.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_request" });
    const d = q.data.days;
    const finance = can(ctx.user, "pagos", "view");
    const from = sql`(now() - make_interval(days => ${d}))`;
    const prevFrom = sql`(now() - make_interval(days => ${d * 2}))`;

    const [totals, funnel, channels, daily, revenue, byPlan, activity, topPages, industries, visitSources, accounts, campaigns] = await Promise.all([
      // Comparación contra el período anterior
      db.execute(sql`select
        (select count(*)::int from users u where ${REAL} and u.created_at >= ${from}) as signups,
        (select count(*)::int from users u where ${REAL} and u.created_at >= ${prevFrom} and u.created_at < ${from}) as signups_prev,
        (select count(*)::int from businesses b where b.published_at >= ${from} and b.deleted_at is null) as published,
        (select count(*)::int from businesses b where b.published_at >= ${prevFrom} and b.published_at < ${from} and b.deleted_at is null) as published_prev,
        (select count(*)::int from site_events e where e.type = 'visit' and e.created_at >= ${from}) as visits,
        (select count(*)::int from site_events e where e.type = 'visit' and e.created_at >= ${prevFrom} and e.created_at < ${from}) as visits_prev,
        (select count(*)::int from orders o where o.created_at >= ${from}) as orders,
        (select count(*)::int from orders o where o.created_at >= ${prevFrom} and o.created_at < ${from}) as orders_prev`),
      // Embudo: solo de quienes se registraron en el período (cada paso es un subconjunto del anterior)
      db.execute(sql`with c as (
          select u.id, u.email_verified_at is not null as verified,
            exists (select 1 from businesses b where b.owner_id = u.id and b.deleted_at is null) as has_page,
            exists (select 1 from businesses b where b.owner_id = u.id and b.deleted_at is null and b.published_at is not null) as published,
            exists (select 1 from businesses b where b.owner_id = u.id and b.deleted_at is null and (
              exists (select 1 from orders o where o.business_id = b.id) or exists (select 1 from site_events e where e.business_id = b.id and e.type = 'whatsapp_click'))) as moved,
            exists (select 1 from payments p join businesses b on b.id = p.business_id where b.owner_id = u.id and p.status = 'confirmado') as paid
          from users u where ${REAL} and u.created_at >= ${from})
        select count(*)::int as registered,
          count(*) filter (where verified)::int as verified,
          count(*) filter (where verified and has_page)::int as with_page,
          count(*) filter (where verified and has_page and published)::int as published,
          count(*) filter (where verified and has_page and published and moved)::int as moved,
          count(*) filter (where verified and has_page and published and moved and paid)::int as paid
        from c`),
      // Canales de adquisición (signup_source: utm_source, sitio de origen, «referido» o directo)
      db.execute(sql`with c as (
          select coalesce(nullif(u.signup_source, ''), 'directo') as source, u.id, u.email_verified_at is not null as verified,
            exists (select 1 from businesses b where b.owner_id = u.id and b.deleted_at is null and b.published_at is not null) as published,
            (select coalesce(sum(p.amount), 0)::float from payments p join businesses b on b.id = p.business_id where b.owner_id = u.id and p.status = 'confirmado') as revenue
          from users u where ${REAL} and u.created_at >= ${from})
        select source, count(*)::int as signups, count(*) filter (where verified)::int as verified, count(*) filter (where published)::int as published,
          count(*) filter (where revenue > 0)::int as paid, sum(revenue)::float as revenue
        from c group by source order by signups desc, source limit 25`),
      // Serie diaria
      db.execute(sql`select to_char(g.day, 'YYYY-MM-DD') as day,
          (select count(*)::int from users u where ${REAL} and u.created_at::date = g.day) as signups,
          (select count(*)::int from businesses b where b.deleted_at is null and b.published_at::date = g.day) as published,
          (select count(*)::int from site_events e where e.type = 'visit' and e.day = g.day) as visits,
          (select count(*)::int from site_events e where e.type = 'whatsapp_click' and e.day = g.day) as whatsapp,
          (select count(*)::int from orders o where o.created_at::date = g.day) as orders
        from generate_series(current_date - ${d - 1}::int, current_date, interval '1 day') as g(day) order by g.day`),
      finance
        ? db.execute(sql`select
            (select coalesce(sum(amount), 0)::float from payments where status = 'confirmado' and resolved_at >= ${from}) as revenue,
            (select coalesce(sum(amount), 0)::float from payments where status = 'confirmado' and resolved_at >= ${prevFrom} and resolved_at < ${from}) as revenue_prev,
            (select count(*)::int from payments where status = 'confirmado' and resolved_at >= ${from}) as payments,
            (select count(*)::int from payments where status = 'pendiente') as pending,
            (select count(*)::int from payments where status = 'rechazado' and resolved_at >= ${from}) as rejected,
            (select count(*)::int from businesses b join plans pl on pl.id = b.plan_id where b.deleted_at is null and pl.price_monthly::float > 0 and (b.plan_expires_at is null or b.plan_expires_at > now())) as paid_active,
            (select coalesce(sum(pl.price_monthly::float), 0)::float from businesses b join plans pl on pl.id = b.plan_id where b.deleted_at is null and pl.price_monthly::float > 0 and (b.plan_expires_at is null or b.plan_expires_at > now())) as mrr,
            (select count(*)::int from businesses b where b.deleted_at is null and b.plan_expires_at between now() and now() + interval '7 days') as expiring7,
            (select count(*)::int from businesses b where b.deleted_at is null and b.plan_id = 'gratis' and b.plan_expires_at is null and exists (select 1 from payments p where p.business_id = b.id and p.status = 'confirmado')) as churned`)
        : Promise.resolve({ rows: [] as Row[] }),
      finance
        ? db.execute(sql`select p.plan_id as plan, count(*)::int as payments, sum(p.amount)::float as revenue from payments p where p.status = 'confirmado' and p.resolved_at >= ${from} group by p.plan_id order by revenue desc`)
        : Promise.resolve({ rows: [] as Row[] }),
      // Actividad de las páginas de los clientes
      db.execute(sql`select
          (select count(*)::int from site_events where type = 'visit' and created_at >= ${from}) as visits,
          (select count(distinct visitor)::int from site_events where type = 'visit' and created_at >= ${from}) as visitors,
          (select count(*)::int from site_events where type = 'product_view' and created_at >= ${from}) as product_views,
          (select count(*)::int from site_events where type = 'whatsapp_click' and created_at >= ${from}) as whatsapp,
          (select count(*)::int from orders where created_at >= ${from}) as orders,
          (select coalesce(sum(total), 0)::float from orders where created_at >= ${from} and status <> 'cancelado') as orders_total,
          (select count(*)::int from appointments where created_at >= ${from}) as appointments,
          (select count(distinct business_id)::int from site_events where type = 'visit' and created_at >= ${from}) as pages_with_visits,
          (select count(*)::int from businesses where status = 'published' and deleted_at is null) as pages_published`),
      db.execute(sql`select b.id, b.name, b.slug, b.industry, b.plan_id,
          count(*) filter (where e.type = 'visit')::int as visits, count(*) filter (where e.type = 'whatsapp_click')::int as whatsapp,
          (select count(*)::int from orders o where o.business_id = b.id and o.created_at >= ${from}) as orders
        from site_events e join businesses b on b.id = e.business_id where e.created_at >= ${from} and b.deleted_at is null
        group by b.id order by visits desc limit 10`),
      db.execute(sql`select b.industry, count(distinct b.id)::int as pages, count(distinct b.id) filter (where b.published_at >= ${from})::int as new_published,
          (select count(*)::int from site_events e join businesses bb on bb.id = e.business_id where bb.industry = b.industry and e.type = 'visit' and e.created_at >= ${from}) as visits,
          (select count(*)::int from orders o join businesses bb on bb.id = o.business_id where bb.industry = b.industry and o.created_at >= ${from}) as orders
        from businesses b where b.deleted_at is null and b.status = 'published' group by b.industry order by pages desc limit 12`),
      db.execute(sql`select coalesce(nullif(source, ''), 'directo') as source, count(*)::int as visits from site_events where type = 'visit' and created_at >= ${from} group by 1 order by visits desc limit 10`),
      db.execute(sql`select
          (select count(*)::int from users u where ${REAL} and u.last_login_at >= now() - interval '7 days') as active7,
          (select count(*)::int from users u where ${REAL} and u.last_login_at >= now() - interval '30 days') as active30,
          (select count(*)::int from users u where ${REAL}) as total,
          (select count(*)::int from users u where ${REAL} and u.referred_by is not null and u.created_at >= ${from}) as referred`),
      db.execute(sql`select count(*)::int as sent, coalesce(sum(recipients), 0)::int as recipients from email_campaigns where status = 'enviado' and sent_at >= ${from}`),
    ]);

    const t = totals.rows[0] as Row;
    const f = funnel.rows[0] as Row;
    return {
      days: d, finance,
      totals: Object.fromEntries(Object.entries(t).map(([k, v]) => [k, n(v)])),
      funnel: [
        { key: "registered", label: "Se registraron", count: n(f.registered) },
        { key: "verified", label: "Confirmaron su email", count: n(f.verified) },
        { key: "with_page", label: "Crearon su página", count: n(f.with_page) },
        { key: "published", label: "Publicaron", count: n(f.published) },
        { key: "moved", label: "Recibieron un pedido o un clic de WhatsApp", count: n(f.moved) },
        ...(finance ? [{ key: "paid", label: "Pagaron un plan", count: n(f.paid) }] : []),
      ],
      channels: channels.rows.map((r) => ({ source: String(r.source), signups: n(r.signups), verified: n(r.verified), published: n(r.published), paid: finance ? n(r.paid) : null, revenue: finance ? n(r.revenue) : null })),
      daily: daily.rows.map((r) => ({ day: String(r.day), signups: n(r.signups), published: n(r.published), visits: n(r.visits), whatsapp: n(r.whatsapp), orders: n(r.orders) })),
      revenue: finance ? Object.fromEntries(Object.entries(revenue.rows[0] ?? {}).map(([k, v]) => [k, n(v)])) : null,
      byPlan: finance ? byPlan.rows.map((r) => ({ plan: String(r.plan), payments: n(r.payments), revenue: n(r.revenue) })) : [],
      activity: Object.fromEntries(Object.entries(activity.rows[0] as Row).map(([k, v]) => [k, n(v)])),
      topPages: topPages.rows.map((r) => ({ id: String(r.id), name: String(r.name), slug: String(r.slug), industry: String(r.industry), plan: String(r.plan_id), visits: n(r.visits), whatsapp: n(r.whatsapp), orders: n(r.orders) })),
      industries: industries.rows.map((r) => ({ industry: String(r.industry), pages: n(r.pages), newPublished: n(r.new_published), visits: n(r.visits), orders: n(r.orders) })),
      visitSources: visitSources.rows.map((r) => ({ source: String(r.source), visits: n(r.visits) })),
      accounts: Object.fromEntries(Object.entries(accounts.rows[0] as Row).map(([k, v]) => [k, n(v)])),
      campaigns: Object.fromEntries(Object.entries(campaigns.rows[0] as Row).map(([k, v]) => [k, n(v)])),
    };
  });
}
