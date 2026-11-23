import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb } from "../db/testdb.js";
import { RESET, makeEnv, type Conn } from "../admin/test-helpers.js";
import { planModules } from "../lib/modules.js";
import * as s from "../db/schema.js";

let conn: Conn;
let env: ReturnType<typeof makeEnv>;
beforeAll(async () => { conn = await setupTestDb("mishowo_test_modules"); env = makeEnv(conn); });
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query(RESET);
  await conn.db.insert(s.plans).values([{ id: "gratis", name: "Gratis", priceMonthly: "0", limits: {} }, { id: "pro", name: "Pro", priceMonthly: "100", limits: {} }]);
});

const body = (modules: object) => ({ name: "Gratis", priceMonthly: 0, limits: { products: 15, photosPerProduct: 2, whatsappNumbers: 1, uploadMb: 5, coupons: 2, modules }, features: [], active: true });

describe("módulos por plan", () => {
  it("sin configuración, el comportamiento anterior se mantiene (y el flag viejo de turnos sigue valiendo)", () => {
    expect(planModules({})).toMatchObject({ coupons: true, appointments: true, stats_full: true, remove_branding: false });
    expect(planModules({ appointments: false }).appointments).toBe(false);
    expect(planModules({ appointments: false, modules: { appointments: true } }).appointments).toBe(true);
  });

  it("el sysadmin apaga módulos y se aplican de verdad: cupones, turnos y estadísticas", async () => {
    const adm = await env.admin("admin@test.com", "admin");
    const owner = await env.account("dueno@test.com");
    await conn.db.insert(s.businesses).values({ slug: "lupe", ownerId: owner.id, name: "Lupe", status: "published", planId: "gratis" });

    const put = await env.call("PUT", "/admin/plans/gratis", adm.cookie, body({ coupons: false, appointments: false, stats_full: false }));
    expect(put.statusCode).toBe(200);

    const coupon = await env.call("POST", "/me/coupons", owner.cookie, { code: "PROMO", kind: "percent", value: 10 });
    expect(coupon.statusCode).toBe(403);
    expect(coupon.json().error).toBe("plan_not_allowed");

    const appt = await env.call("PUT", "/me/appointments/settings", owner.cookie, { enabled: true, slotMinutes: 30, minNoticeHours: 2, capacity: 1, horizonDays: 14, services: [] });
    expect(appt.statusCode).toBe(403);

    const stats = (await env.call("GET", "/me/stats?days=90", owner.cookie)).json();
    expect(stats.days).toBe(7);
    expect(stats.limited).toBe(true);
    expect(stats.series).toHaveLength(7);

    const mine = (await env.call("GET", "/me/plan", owner.cookie)).json();
    expect(mine.current.modules).toMatchObject({ coupons: false, appointments: false, stats_full: false });
    const pub = (await env.app.inject({ method: "GET", url: "/public/sites/lupe" })).json();
    expect(pub.modules.coupons).toBe(false);
  });

  it("guardar el plan no pisa los límites que el formulario no muestra, y rechaza módulos inventados", async () => {
    const adm = await env.admin("admin@test.com", "admin");
    await env.call("PUT", "/admin/plans/pro", adm.cookie, { ...body({ remove_branding: true }), name: "Pro", priceMonthly: 100 });
    const list = (await env.call("GET", "/admin/plans", adm.cookie)).json();
    const pro = list.plans.find((p: { id: string }) => p.id === "pro");
    expect(pro.limits.coupons).toBe(2);
    expect(pro.modules.remove_branding).toBe(true);
    expect(list.modules.map((m: { key: string }) => m.key)).toContain("appointments");
    const bad = await env.call("PUT", "/admin/plans/pro", adm.cookie, { ...body({ hackear: true }), name: "Pro", priceMonthly: 100 });
    expect(bad.statusCode).toBe(400);
  });

  it("estadísticas completas encendidas: respeta el rango pedido", async () => {
    const owner = await env.account("dueno@test.com");
    await conn.db.insert(s.businesses).values({ slug: "lupe", ownerId: owner.id, name: "Lupe", status: "published", planId: "pro" });
    const stats = (await env.call("GET", "/me/stats?days=90", owner.cookie)).json();
    expect(stats).toMatchObject({ days: 90, limited: false });
  });
});
