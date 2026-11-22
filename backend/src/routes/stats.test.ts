import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb } from "../db/testdb.js";
import { RESET, count, makeEnv, type Conn } from "../admin/test-helpers.js";
import { sourceOf } from "./stats.js";
import * as s from "../db/schema.js";

let conn: Conn;
let env: ReturnType<typeof makeEnv>;
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1";

beforeAll(async () => { conn = await setupTestDb("mishowo_test_stats"); env = makeEnv(conn, { EVENTS_PER_MINUTE: "10000" }); });
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query(RESET);
  await conn.db.insert(s.plans).values({ id: "gratis", name: "Gratis", priceMonthly: "0" });
});

async function setup(slug = "lupe", email = "dueno@test.com", status = "published") {
  const owner = await env.account(email);
  const [biz] = await conn.db.insert(s.businesses).values({ slug, ownerId: owner.id, name: slug, status }).returning();
  const [prod] = await conn.db.insert(s.products).values({ businessId: biz!.id, clientId: `c-${slug}`, name: `Prod ${slug}` }).returning();
  return { owner, biz: biz!, prod: prod! };
}
const event = (slug: string, body: object, opts: { ua?: string; ip?: string } = {}) =>
  env.app.inject({ method: "POST", url: `/public/sites/${slug}/events`, payload: body, remoteAddress: opts.ip ?? "10.0.0.1", headers: { "user-agent": opts.ua ?? UA } });
const stats = async (cookie: string, days = 30) => (await env.call("GET", `/me/stats?days=${days}`, cookie)).json();

describe("registro de eventos", () => {
  it("cuenta una visita por visitante y día: recargar no infla el número", async () => {
    const { owner } = await setup();
    for (let i = 0; i < 4; i++) expect((await event("lupe", { type: "visit" })).statusCode).toBe(204);
    await event("lupe", { type: "visit" }, { ip: "10.0.0.2" }); // otra persona
    expect((await stats(owner.cookie)).totals.visits).toBe(2);
  });

  it("no guarda la IP ni nada que identifique: el visitante es un hash", async () => {
    await setup();
    await event("lupe", { type: "visit" }, { ip: "203.0.113.77" });
    const row = (await conn.pool.query("select * from site_events")).rows[0];
    expect(JSON.stringify(row)).not.toContain("203.0.113.77");
    expect(row.visitor).toMatch(/^[0-9a-f]{24}$/);
  });

  it("cuenta cada clic a WhatsApp, y una vista de producto por visitante y día", async () => {
    const { owner, prod } = await setup();
    for (let i = 0; i < 3; i++) await event("lupe", { type: "whatsapp_click" });
    for (let i = 0; i < 3; i++) await event("lupe", { type: "product_view", productId: prod.id });
    const r = await stats(owner.cookie);
    expect(r.totals).toMatchObject({ whatsappClicks: 3, productViews: 1 });
    expect(r.topProducts).toEqual([{ id: prod.id, name: "Prod lupe", views: 1 }]);
  });

  it("ignora robots y pedidos sin navegador", async () => {
    const { owner } = await setup();
    for (const ua of ["Googlebot/2.1", "facebookexternalhit/1.1", "WhatsApp/2.23", "curl/8.0", "HeadlessChrome", ""]) expect((await event("lupe", { type: "visit" }, { ua })).statusCode).toBe(204);
    expect((await stats(owner.cookie)).totals.visits).toBe(0);
  });

  it("solo cuenta páginas publicadas; el borrador, inexistentes o suspendidas devuelven 404", async () => {
    await setup("borrador", "a@test.com", "draft");
    await setup("suspendida", "b@test.com", "suspended");
    for (const slug of ["borrador", "suspendida", "noexiste"]) expect((await event(slug, { type: "visit" })).statusCode, slug).toBe(404);
    expect(await count(conn, "site_events")).toBe(0);
  });

  it("un producto de OTRO negocio no se puede contar (no se infla la competencia)", async () => {
    const a = await setup("uno", "a@test.com");
    const b = await setup("dos", "b@test.com");
    await event("uno", { type: "product_view", productId: b.prod.id });
    expect(await count(conn, "site_events")).toBe(0);
    expect((await stats(a.owner.cookie)).totals.productViews).toBe(0);
  });

  it("valida el cuerpo", async () => {
    await setup();
    for (const body of [{}, { type: "hack" }, { type: "product_view" }, { type: "product_view", productId: "no-uuid" }, { type: "visit", utmSource: "<script>" }, { type: "visit", utmSource: "x".repeat(41) }])
      expect((await event("lupe", body)).statusCode, JSON.stringify(body)).toBe(400);
    expect((await event("MAYUS!", { type: "visit" })).statusCode).toBe(400);
  });

  it("tiene un límite por IP contra el abuso", async () => {
    const limited = makeEnv(conn, { EVENTS_PER_MINUTE: "5" });
    await setup();
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) codes.push((await limited.app.inject({ method: "POST", url: "/public/sites/lupe/events", payload: { type: "whatsapp_click" }, remoteAddress: "10.9.9.9", headers: { "user-agent": UA } })).statusCode);
    expect(codes.filter((c) => c === 429).length).toBeGreaterThan(0);
    expect(await count(conn, "site_events")).toBeLessThanOrEqual(5);
  });
});

describe("origen del tráfico", () => {
  it("prioriza utm_source (QR, Instagram) y si no, el sitio de origen", () => {
    expect(sourceOf("QR", undefined)).toBe("qr");
    expect(sourceOf(undefined, "https://l.instagram.com/?u=x")).toBe("instagram");
    expect(sourceOf(undefined, "https://www.google.com.ar/search")).toBe("google");
    expect(sourceOf(undefined, "https://m.facebook.com/")).toBe("facebook");
    expect(sourceOf(undefined, "https://blog.ejemplo.com/nota")).toBe("blog.ejemplo.com");
    expect(sourceOf(undefined, undefined)).toBe("directo");
    expect(sourceOf(undefined, "no es una url")).toBe("directo");
  });
  it("las estadísticas agrupan las visitas por origen", async () => {
    const { owner } = await setup();
    await event("lupe", { type: "visit", utmSource: "qr" }, { ip: "10.0.0.1" });
    await event("lupe", { type: "visit", utmSource: "qr" }, { ip: "10.0.0.2" });
    await event("lupe", { type: "visit", referrer: "https://l.instagram.com/" }, { ip: "10.0.0.3" });
    await event("lupe", { type: "visit" }, { ip: "10.0.0.4" });
    const src = Object.fromEntries((await stats(owner.cookie)).sources.map((x: { source: string; visits: number }) => [x.source, x.visits]));
    expect(src).toEqual({ qr: 2, instagram: 1, directo: 1 });
  });
});

describe("GET /me/stats", () => {
  it("devuelve la serie completa de días (con ceros), los pedidos y la conversión", async () => {
    const { owner, biz } = await setup();
    await event("lupe", { type: "visit" }, { ip: "10.0.0.1" });
    await event("lupe", { type: "visit" }, { ip: "10.0.0.2" });
    await conn.db.insert(s.orders).values([{ businessId: biz.id, number: 1, total: "100" }, { businessId: biz.id, number: 2, total: "50" }]);
    await conn.db.insert(s.orders).values({ businessId: biz.id, number: 3, total: "10", createdAt: new Date(Date.now() - 60 * 86_400_000) }); // fuera del rango
    const r = await stats(owner.cookie, 7);
    expect(r.series).toHaveLength(7);
    expect(r.series.at(-1).visits).toBe(2);
    expect(r.series.slice(0, 6).every((d: { visits: number }) => d.visits === 0)).toBe(true);
    expect(r.totals).toMatchObject({ visits: 2, orders: 2, conversion: 100 });
    expect((await stats(owner.cookie, 90)).totals.orders).toBe(3);
  });

  it("cada negocio ve solo lo suyo", async () => {
    const a = await setup("uno", "a@test.com");
    const b = await setup("dos", "b@test.com");
    await event("uno", { type: "visit" });
    await event("uno", { type: "whatsapp_click" });
    expect((await stats(a.owner.cookie)).totals).toMatchObject({ visits: 1, whatsappClicks: 1 });
    expect((await stats(b.owner.cookie)).totals).toMatchObject({ visits: 0, whatsappClicks: 0 });
  });

  it("exige sesión, un rango válido y un negocio", async () => {
    const { owner } = await setup();
    expect((await env.call("GET", "/me/stats")).statusCode).toBe(401);
    expect((await env.call("GET", "/me/stats?days=5", owner.cookie)).statusCode).toBe(400);
    const lone = await env.account("sin-negocio@test.com");
    expect((await env.call("GET", "/me/stats", lone.cookie)).statusCode).toBe(404);
  });
});
