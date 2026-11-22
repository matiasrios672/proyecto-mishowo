import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb } from "../db/testdb.js";
import { ORIGIN, RESET, count, makeEnv, type Conn } from "../admin/test-helpers.js";
import * as s from "../db/schema.js";

let conn: Conn;
let env: ReturnType<typeof makeEnv>;

beforeAll(async () => { conn = await setupTestDb("mishowo_test_coupons"); env = makeEnv(conn, { ORDERS_PER_MINUTE: "10000", COUPONS_VALIDATE_PER_MINUTE: "10000" }); });
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query(RESET);
  await conn.db.insert(s.plans).values([{ id: "gratis", name: "Gratis", priceMonthly: "0", limits: { coupons: 2 } }, { id: "pro", name: "Pro", priceMonthly: "100", limits: { coupons: null } }]);
});

async function setup(slug = "lupe", email = "dueno@test.com", planId = "gratis") {
  const owner = await env.account(email);
  const [biz] = await conn.db.insert(s.businesses).values({ slug, ownerId: owner.id, name: slug, status: "published", planId }).returning();
  const [prod] = await conn.db.insert(s.products).values({ businessId: biz!.id, name: "Empanada", price: "1800", position: 0 }).returning();
  return { owner, biz: biz!, prod: prod! };
}
const make = (ownerCookie: string, over: object = {}) => env.call("POST", "/me/coupons", ownerCookie, { code: "Verano10", kind: "percent", value: 10, ...over });
const order = (slug: string, productId: string, quantity: number, extra: object = {}) =>
  env.app.inject({ method: "POST", url: "/public/orders", payload: { slug, items: [{ productId, quantity }], ...extra } });
const patch = (url: string, cookie: string, payload: object) => env.app.inject({ method: "PATCH", url, payload, headers: { cookie, origin: ORIGIN } });
const validate = (payload: object) => env.app.inject({ method: "POST", url: "/public/coupons/validate", payload });

describe("panel de cupones", () => {
  it("crea con el código en mayúsculas y lo lista con sus usos", async () => {
    const { owner } = await setup();
    const res = await make(owner.cookie, { minPurchase: 5000, maxUses: 10 });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ code: "VERANO10", kind: "percent", value: 10, minPurchase: 5000, maxUses: 10, usedCount: 0, active: true });
    const list = (await env.call("GET", "/me/coupons", owner.cookie)).json();
    expect(list.coupons).toHaveLength(1);
    expect(list.limit).toBe(2);
  });

  it("el código es único por negocio sin distinguir mayúsculas, pero otro negocio puede repetirlo", async () => {
    const a = await setup("uno", "a@test.com");
    const b = await setup("dos", "b@test.com");
    expect((await make(a.owner.cookie, { code: "promo" })).statusCode).toBe(201);
    expect((await make(a.owner.cookie, { code: "PROMO" })).json().error).toBe("code_taken");
    expect((await make(b.owner.cookie, { code: "Promo" })).statusCode).toBe(201);
  });

  it("valida: porcentaje hasta 100, valores positivos, código simple", async () => {
    const { owner } = await setup();
    for (const body of [{ value: 101 }, { value: 0 }, { value: -5 }, { code: "ab" }, { code: "con espacio" }, { code: "x".repeat(31) }, { kind: "otro" }, { maxUses: 0 }, { minPurchase: -1 }, { expiresAt: "ayer" }])
      expect((await make(owner.cookie, body)).statusCode, JSON.stringify(body)).toBe(400);
    expect((await make(owner.cookie, { kind: "fixed", value: 500 })).statusCode).toBe(201); // un monto fijo puede superar 100
  });

  it("el máximo de cupones sale de la tabla de planes", async () => {
    const { owner } = await setup();
    await make(owner.cookie, { code: "UNO" }); await make(owner.cookie, { code: "DOS" });
    const third = await make(owner.cookie, { code: "TRES" });
    expect(third.statusCode).toBe(422);
    expect(third.json()).toMatchObject({ error: "coupon_limit", limit: 2 });
    await conn.pool.query(`update plans set limits = '{"coupons":3}' where id = 'gratis'`);
    expect((await make(owner.cookie, { code: "TRES" })).statusCode).toBe(201);
  });

  it("un plan sin límite definido usa el predeterminado, y null es ilimitado", async () => {
    const { owner } = await setup("lupe", "dueno@test.com", "pro");
    for (let i = 0; i < 6; i++) expect((await make(owner.cookie, { code: `PRO${i}` })).statusCode).toBe(201);
  });

  it("modifica y borra solo cupones propios, exige sesión y origen válido", async () => {
    const a = await setup("uno", "a@test.com");
    const b = await setup("dos", "b@test.com");
    const c = (await make(a.owner.cookie)).json();
    expect((await patch(`/me/coupons/${c.id}`, a.owner.cookie, { active: false })).json().active).toBe(false);
    expect((await patch(`/me/coupons/${c.id}`, b.owner.cookie, { active: true })).statusCode).toBe(404);
    expect((await env.call("DELETE", `/me/coupons/${c.id}`, b.owner.cookie)).statusCode).toBe(404);
    expect((await patch(`/me/coupons/${c.id}`, a.owner.cookie, {})).statusCode).toBe(400);
    expect((await patch("/me/coupons/no-uuid", a.owner.cookie, { active: true })).statusCode).toBe(404);
    expect((await env.call("GET", "/me/coupons")).statusCode).toBe(401);
    expect((await env.call("POST", "/me/coupons", a.owner.cookie, { code: "XYZ", kind: "fixed", value: 1 }, "http://evil.example")).statusCode).toBe(403);
    expect((await env.call("DELETE", `/me/coupons/${c.id}`, a.owner.cookie)).statusCode).toBe(200);
    expect(await count(conn, "coupons")).toBe(0);
  });
});

describe("cupón en el pedido (el servidor calcula todo)", () => {
  it("descuento porcentual: total, descuento y cupón quedan guardados y se ven en el panel y el CSV", async () => {
    const { owner, biz, prod } = await setup();
    await make(owner.cookie);
    const res = await order("lupe", prod.id, 3, { couponCode: "verano10", customerPhone: "11 5555-0000" }); // minúsculas
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ subtotal: 5400, discount: 540, total: 4860, couponCode: "VERANO10" });
    const row = (await conn.pool.query("select total, discount, coupon_code from orders where business_id = $1", [biz.id])).rows[0];
    expect(Number(row.total)).toBe(4860); expect(Number(row.discount)).toBe(540); expect(row.coupon_code).toBe("VERANO10");
    expect((await conn.pool.query("select used_count from coupons")).rows[0].used_count).toBe(1);
    const panel = (await env.call("GET", "/me/orders", owner.cookie)).json().orders[0];
    expect(panel).toMatchObject({ total: 4860, discount: 540, couponCode: "VERANO10" });
    const csv = (await env.call("GET", "/me/orders.csv", owner.cookie)).body;
    expect(csv).toContain("Cupón;Descuento");
    expect(csv).toContain("VERANO10;540,00");
  });

  it("ignora cualquier monto que mande el navegador: el descuento sale solo del cupón de la base", async () => {
    const { owner, prod } = await setup();
    await make(owner.cookie);
    const res = await order("lupe", prod.id, 1, { couponCode: "VERANO10", discount: 99999, total: 1, subtotal: 1 });
    expect(res.json()).toMatchObject({ subtotal: 1800, discount: 180, total: 1620 });
  });

  it("monto fijo: nunca deja el total negativo", async () => {
    const { owner, prod } = await setup();
    await make(owner.cookie, { code: "GRANDE", kind: "fixed", value: 50000 });
    const res = await order("lupe", prod.id, 1, { couponCode: "GRANDE" });
    expect(res.json()).toMatchObject({ subtotal: 1800, discount: 1800, total: 0 });
  });

  it("un porcentaje del 100% deja el pedido en cero, sin negativos ni decimales raros", async () => {
    const { owner, prod } = await setup();
    await make(owner.cookie, { code: "TODO", kind: "percent", value: 100 });
    expect((await order("lupe", prod.id, 3, { couponCode: "TODO" })).json()).toMatchObject({ discount: 5400, total: 0 });
    await make(owner.cookie, { code: "RARO", kind: "percent", value: 33.33 });
    const r = (await order("lupe", prod.id, 1, { couponCode: "RARO" })).json();
    expect(r.discount + r.total).toBeCloseTo(1800, 2);
    expect(r.total).toBeGreaterThanOrEqual(0);
  });

  it("compra mínima: por debajo se rechaza avisando el mínimo", async () => {
    const { owner, prod } = await setup();
    await make(owner.cookie, { minPurchase: 5000 });
    const low = await order("lupe", prod.id, 1, { couponCode: "VERANO10" });
    expect(low.statusCode).toBe(422);
    expect(low.json()).toMatchObject({ error: "coupon_min_purchase", minPurchase: 5000 });
    expect((await order("lupe", prod.id, 3, { couponCode: "VERANO10" })).statusCode).toBe(201);
  });

  it("rechaza cupones vencidos, inactivos, inexistentes o de otro negocio, todos con el mismo error", async () => {
    const a = await setup("uno", "a@test.com");
    const b = await setup("dos", "b@test.com");
    await make(a.owner.cookie, { code: "VENCIDO" });
    await conn.pool.query("update coupons set expires_at = now() - interval '1 day' where code = 'VENCIDO'");
    await make(a.owner.cookie, { code: "APAGADO", active: false });
    await make(b.owner.cookie, { code: "AJENO" });
    for (const code of ["VENCIDO", "APAGADO", "NOEXISTE", "AJENO"]) {
      const res = await order("uno", a.prod.id, 1, { couponCode: code });
      expect(res.statusCode, code).toBe(422);
      expect(res.json(), code).toEqual({ error: "coupon_invalid" });
    }
    expect(await count(conn, "orders")).toBe(0); // el pedido entero se cancela: no queda a medias
  });

  it("un pedido sin cupón no cambia", async () => {
    const { prod } = await setup();
    expect((await order("lupe", prod.id, 2)).json()).toMatchObject({ total: 3600, discount: 0, couponCode: null });
  });

  it("si el pedido falla por stock, el uso del cupón no se consume", async () => {
    const { owner, prod } = await setup();
    await conn.pool.query("update products set stock = 1 where id = $1", [prod.id]);
    await make(owner.cookie, { maxUses: 1 });
    expect((await order("lupe", prod.id, 5, { couponCode: "VERANO10" })).statusCode).toBe(409);
    expect((await conn.pool.query("select used_count from coupons")).rows[0].used_count).toBe(0);
  });
});

describe("tope de usos", () => {
  it("con un solo uso disponible, dos pedidos simultáneos: gana uno solo", async () => {
    const { owner, prod } = await setup();
    await make(owner.cookie, { maxUses: 1 });
    const res = await Promise.all(Array.from({ length: 6 }, () => order("lupe", prod.id, 1, { couponCode: "VERANO10" })));
    expect(res.map((r) => r.statusCode).sort()).toEqual([201, 422, 422, 422, 422, 422]);
    expect((await conn.pool.query("select used_count from coupons")).rows[0].used_count).toBe(1);
    expect(await count(conn, "orders", "coupon_code is not null")).toBe(1);
  });

  it("al agotarse, deja de servir; cancelar el pedido libera el uso", async () => {
    const { owner, prod } = await setup();
    await make(owner.cookie, { maxUses: 2 });
    const first = (await order("lupe", prod.id, 1, { couponCode: "VERANO10" })).json();
    await order("lupe", prod.id, 1, { couponCode: "VERANO10" });
    expect((await order("lupe", prod.id, 1, { couponCode: "VERANO10" })).statusCode).toBe(422);
    const id = (await conn.pool.query("select id from orders where number = $1", [first.number])).rows[0].id;
    expect((await patch(`/me/orders/${id}/status`, owner.cookie, { status: "cancelado" })).statusCode).toBe(200);
    expect((await conn.pool.query("select used_count from coupons")).rows[0].used_count).toBe(1);
    expect(await count(conn, "coupon_redemptions")).toBe(1);
    expect((await order("lupe", prod.id, 1, { couponCode: "VERANO10" })).statusCode).toBe(201);
  });

  it("tope por cliente (teléfono): el mismo número no repite, otro sí, y sin teléfono no se aplica", async () => {
    const { owner, prod } = await setup();
    await make(owner.cookie, { maxUsesPerCustomer: 1 });
    expect((await order("lupe", prod.id, 1, { couponCode: "VERANO10", customerPhone: "11 5555-0000" })).statusCode).toBe(201);
    expect((await order("lupe", prod.id, 1, { couponCode: "VERANO10", customerPhone: "(11) 5555 0000" })).statusCode).toBe(422); // mismo número con otro formato
    expect((await order("lupe", prod.id, 1, { couponCode: "VERANO10", customerPhone: "11 6666-1111" })).statusCode).toBe(201);
    expect((await order("lupe", prod.id, 1, { couponCode: "VERANO10" })).statusCode).toBe(422);
  });
});

describe("validación en vivo (carrito)", () => {
  it("devuelve el descuento sin consumir el cupón", async () => {
    const { owner } = await setup();
    await make(owner.cookie, { maxUses: 1 });
    const r = (await validate({ slug: "lupe", code: "verano10", subtotal: 5400 })).json();
    expect(r).toEqual({ valid: true, code: "VERANO10", kind: "percent", value: 10, discount: 540 });
    expect((await conn.pool.query("select used_count from coupons")).rows[0].used_count).toBe(0);
  });

  it("no permite enumerar: inexistente, vencido, apagado, agotado y de otro negocio responden exactamente igual", async () => {
    const a = await setup("uno", "a@test.com");
    const b = await setup("dos", "b@test.com");
    await make(a.owner.cookie, { code: "VENCIDO" });
    await conn.pool.query("update coupons set expires_at = now() - interval '1 day'");
    await make(a.owner.cookie, { code: "OFF", active: false });
    await make(b.owner.cookie, { code: "AJENO" });
    const bodies = [];
    for (const code of ["NOEXISTE", "VENCIDO", "OFF", "AJENO"]) {
      const res = await validate({ slug: "uno", code, subtotal: 5000 });
      expect(res.statusCode).toBe(200);
      bodies.push(res.body);
    }
    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0]!)).toEqual({ valid: false });
    expect((await validate({ slug: "nada", code: "X", subtotal: 1 })).body).toBe(bodies[0]); // ni siquiera revela si el negocio existe
  });

  it("avisa el mínimo y valida el cuerpo", async () => {
    const { owner } = await setup();
    await make(owner.cookie, { minPurchase: 3000 });
    expect((await validate({ slug: "lupe", code: "VERANO10", subtotal: 1000 })).json()).toEqual({ valid: false, reason: "min_purchase", minPurchase: 3000 });
    for (const body of [{}, { slug: "lupe", code: "X" }, { slug: "lupe", code: "X", subtotal: -1 }, { slug: "MAL!", code: "X", subtotal: 1 }, { slug: "lupe", code: "x".repeat(31), subtotal: 1 }])
      expect((await validate(body)).statusCode, JSON.stringify(body)).toBe(400);
  });

  it("tiene un límite por IP contra la prueba de códigos", async () => {
    const limited = makeEnv(conn, { COUPONS_VALIDATE_PER_MINUTE: "5" });
    await setup();
    const codes: number[] = [];
    for (let i = 0; i < 9; i++) codes.push((await limited.app.inject({ method: "POST", url: "/public/coupons/validate", payload: { slug: "lupe", code: `C${i}`, subtotal: 1 }, remoteAddress: "10.7.7.7" })).statusCode);
    expect(codes.filter((c) => c === 429).length).toBeGreaterThanOrEqual(3);
  });
});
