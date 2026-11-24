import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb } from "../db/testdb.js";
import { RESET, makeEnv, type Conn } from "../admin/test-helpers.js";
import * as s from "../db/schema.js";

let conn: Conn;
let env: ReturnType<typeof makeEnv>;
beforeAll(async () => { conn = await setupTestDb("mishowo_test_adminstats"); env = makeEnv(conn); });
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query(RESET);
  await conn.pool.query("truncate table site_events restart identity cascade");
  await conn.db.insert(s.plans).values([{ id: "gratis", name: "Gratis", priceMonthly: "0", limits: {} }, { id: "pro", name: "Pro", priceMonthly: "10000", limits: {} }]);
});

/** Tres personas: una de Instagram que publicó, vendió y pagó; una de Instagram que solo confirmó; una directa sin confirmar. */
async function seed() {
  const a = await env.account("ana@test.com"), b = await env.account("beto@test.com"), c = await env.account("cami@test.com");
  await conn.pool.query("update users set signup_source = 'instagram', email_verified_at = now() where id in ($1, $2)", [a.id, b.id]);
  const [biz] = await conn.db.insert(s.businesses).values({ slug: "ana", ownerId: a.id, name: "Ana", industry: "ropa", status: "published", publishedAt: new Date() }).returning();
  await conn.db.insert(s.siteEvents).values([
    { businessId: biz!.id, day: new Date().toISOString().slice(0, 10), type: "visit", visitor: "v1", source: "instagram" },
    { businessId: biz!.id, day: new Date().toISOString().slice(0, 10), type: "visit", visitor: "v2", source: null },
    { businessId: biz!.id, day: new Date().toISOString().slice(0, 10), type: "whatsapp_click", visitor: "v1" },
  ]);
  await conn.pool.query("insert into orders (business_id, number, total, status) values ($1, 1, 5000, 'nuevo')", [biz!.id]);
  await conn.pool.query("insert into payments (business_id, plan_id, amount, months, status, resolved_at) values ($1, 'pro', 10000, 1, 'confirmado', now())", [biz!.id]);
  return { a, b, c };
}

describe("estadísticas del admin", () => {
  it("arma el embudo, los canales, los ingresos y la actividad", async () => {
    const owner = await env.admin("owner@test.com", "owner");
    await seed();
    const res = await env.call("GET", "/admin/stats?days=30", owner.cookie);
    expect(res.statusCode, res.body).toBe(200);
    const st = res.json();
    const steps = Object.fromEntries(st.funnel.map((f: { key: string; count: number }) => [f.key, f.count]));
    expect(steps).toMatchObject({ verified: 2, with_page: 1, published: 1, moved: 1, paid: 1 });
    expect(steps.registered).toBeGreaterThanOrEqual(3);

    const insta = st.channels.find((x: { source: string }) => x.source === "instagram");
    expect(insta).toMatchObject({ signups: 2, verified: 2, published: 1, paid: 1, revenue: 10000 });
    expect(st.revenue).toMatchObject({ revenue: 10000, payments: 1 });
    expect(st.byPlan).toEqual([{ plan: "pro", payments: 1, revenue: 10000 }]);
    expect(st.activity).toMatchObject({ visits: 2, visitors: 2, whatsapp: 1, orders: 1, orders_total: 5000, pages_with_visits: 1 });
    expect(st.visitSources).toEqual(expect.arrayContaining([{ source: "instagram", visits: 1 }, { source: "directo", visits: 1 }]));
    expect(st.topPages[0]).toMatchObject({ slug: "ana", visits: 2, whatsapp: 1, orders: 1 });
    expect(st.daily).toHaveLength(30);
    expect(st.daily.at(-1)).toMatchObject({ visits: 2, orders: 1 });
  });

  it("Soporte ve la actividad pero no ingresos ni pagos; y valida el período", async () => {
    const sup = await env.admin("soporte@test.com", "support");
    await seed();
    const st = (await env.call("GET", "/admin/stats?days=7", sup.cookie)).json();
    expect(st.finance).toBe(false);
    expect(st.revenue).toBeNull();
    expect(st.funnel.map((f: { key: string }) => f.key)).not.toContain("paid");
    expect(st.channels[0].revenue).toBeNull();
    expect((await env.call("GET", "/admin/stats?days=0", sup.cookie)).statusCode).toBe(400);
    expect((await env.call("GET", "/admin/stats")).statusCode).toBe(401);
  });
});
