import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb } from "../db/testdb.js";
import { ORIGIN, RESET, count, makeEnv, type Conn } from "../admin/test-helpers.js";
import * as s from "../db/schema.js";

let conn: Conn;
let env: ReturnType<typeof makeEnv>;

beforeAll(async () => { conn = await setupTestDb("mishowo_test_orders_optional"); env = makeEnv(conn, { ORDERS_PER_MINUTE: "10000", COUPONS_VALIDATE_PER_MINUTE: "10000" }); });
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query(RESET);
  await conn.db.insert(s.plans).values({ id: "gratis", name: "Gratis", priceMonthly: "0" });
});

const product = (id: string, name: string) => ({ id, name, description: "", price: 1000, comparePrice: null, available: true, stock: null, isExample: false, options: [] });
const doc = (over: object = {}) => ({
  industryId: "rotiseria", name: "Lupe", nameIsExample: false, tagline: "", description: "", textsAreExample: false, whatsapp: "11 5555-0000", instagram: "", address: "", deliveryZone: "",
  extraWhatsapps: [], hours: Array.from({ length: 7 }, () => ({ open: true, from: "09:00", to: "18:00" })), announcement: "", whatsappGreeting: "Hola!", showQuantities: true, askEventDate: false,
  design: { layout: "vidriera", theme: "terracota", fontPair: "calida", brandColor: null, buttonShape: "redondeado" },
  categories: [{ id: "c1", name: "Todo", products: [product("p1", "Empanada")] }], ...over,
});
const put = (cookie: string, baseVersion: number | null, content: object) =>
  env.app.inject({ method: "PUT", url: "/me/business", payload: { baseVersion, content }, headers: { cookie, origin: ORIGIN } });
const order = (slug: string, productId: string) => env.app.inject({ method: "POST", url: "/public/orders", payload: { slug, items: [{ productId, quantity: 1 }] } });

async function published(content: object, slug = "lupe") {
  const owner = await env.account("dueno@test.com");
  expect((await put(owner.cookie, null, content)).statusCode).toBe(201);
  await conn.pool.query("update businesses set status = 'published', slug = $1", [slug]);
  const productId = (await conn.pool.query("select id from products limit 1")).rows[0].id as string;
  return { owner, productId };
}

describe("pedidos opcionales", () => {
  it("por defecto los pedidos están encendidos (un documento sin el campo no cambia nada)", async () => {
    const { owner, productId } = await published(doc());
    expect((await env.call("GET", "/me/business", owner.cookie)).json().content.ordersEnabled).toBe(true);
    expect((await order("lupe", productId)).statusCode).toBe(201);
  });

  it("apagados: se guarda, se lee igual y la página pública lo informa", async () => {
    const { owner } = await published(doc({ ordersEnabled: false }));
    expect((await env.call("GET", "/me/business", owner.cookie)).json().content.ordersEnabled).toBe(false);
    const site = (await env.app.inject({ method: "GET", url: "/public/sites/lupe" })).json();
    expect(site.business.settings.ordersEnabled).toBe(false);
  });

  it("se puede volver a encender", async () => {
    const { owner, productId } = await published(doc({ ordersEnabled: false }));
    expect((await order("lupe", productId)).statusCode).toBe(409);
    expect((await put(owner.cookie, 1, doc({ ordersEnabled: true }))).statusCode).toBe(200);
    expect((await order("lupe", productId)).statusCode).toBe(201);
  });

  it("apagados: POST /public/orders responde 409 orders_disabled y no crea nada", async () => {
    const { productId } = await published(doc({ ordersEnabled: false }));
    const res = await order("lupe", productId);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("orders_disabled");
    expect(await count(conn, "orders")).toBe(0);
    expect(await count(conn, "order_items")).toBe(0);
  });

  it("apagados: los pedidos que ya existían siguen visibles en el panel", async () => {
    const { owner, productId } = await published(doc());
    expect((await order("lupe", productId)).statusCode).toBe(201);
    expect((await put(owner.cookie, 1, doc({ ordersEnabled: false }))).statusCode).toBe(200);
    const list = (await env.call("GET", "/me/orders", owner.cookie)).json();
    expect(list.orders).toHaveLength(1);
  });

  it("apagados: un cupón existente no se valida ni se aplica", async () => {
    const { owner, productId } = await published(doc());
    expect((await env.call("POST", "/me/coupons", owner.cookie, { code: "Verano10", kind: "percent", value: 10 })).statusCode).toBe(201);
    const check = () => env.app.inject({ method: "POST", url: "/public/coupons/validate", payload: { slug: "lupe", code: "Verano10", subtotal: 1000 } });
    expect((await check()).json().valid).toBe(true);
    await put(owner.cookie, 1, doc({ ordersEnabled: false }));
    expect((await check()).json()).toEqual({ valid: false });
    const res = await env.app.inject({ method: "POST", url: "/public/orders", payload: { slug: "lupe", items: [{ productId, quantity: 1 }], couponCode: "Verano10" } });
    expect(res.statusCode).toBe(409);
    expect(await count(conn, "coupon_redemptions")).toBe(0);
  });

  it("el flag es por negocio: apagar uno no afecta a otro", async () => {
    const a = await published(doc({ ordersEnabled: false }), "uno");
    const other = await env.account("otro@test.com");
    expect((await put(other.cookie, null, doc({ name: "Otro" }))).statusCode).toBe(201);
    await conn.pool.query("update businesses set status = 'published', slug = 'dos' where owner_id = $1", [other.id]);
    const pid = (await conn.pool.query("select p.id from products p join businesses b on b.id = p.business_id where b.slug = 'dos'")).rows[0].id as string;
    expect((await order("uno", a.productId)).statusCode).toBe(409);
    expect((await order("dos", pid)).statusCode).toBe(201);
  });
});
