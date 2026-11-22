import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp, originAllowed } from "../app.js";
import { loadConfig } from "../config.js";
import { setupTestDb } from "../db/testdb.js";
import { tenantScope } from "../db/tenant.js";
import * as s from "../db/schema.js";

let conn: Awaited<ReturnType<typeof setupTestDb>>;
let app: ReturnType<typeof buildApp>;
let bizId: string, otherBizId: string;
let empanada: string, carne: string, docena: string, media: string, remera: string, ajeno: string;

beforeAll(async () => {
  conn = await setupTestDb("mishowo_test_orders");
  const { db } = conn;
  const [u] = await db.insert(s.users).values({ email: "o@test.com" }).returning();
  const [a] = await db.insert(s.businesses).values({ slug: "lupe", ownerId: u!.id, name: "Lupe", status: "published" }).returning();
  const [b] = await db.insert(s.businesses).values({ slug: "otro", ownerId: u!.id, name: "Otro", status: "published" }).returning();
  await db.insert(s.businesses).values({ slug: "borrador", ownerId: u!.id, name: "B", status: "draft" });
  await db.insert(s.businesses).values({ slug: "suspendido", ownerId: u!.id, name: "S", status: "suspended" });
  await db.insert(s.businesses).values({ slug: "fiestas", ownerId: u!.id, name: "F", status: "published", settings: { askEventDate: true } });
  bizId = a!.id; otherBizId = b!.id;
  app = buildApp(loadConfig({ NODE_ENV: "test", ORDERS_PER_MINUTE: "10000" }), conn.check, db);
});
afterAll(async () => { await conn.pool.end(); });

// Cada test parte de un catálogo conocido.
beforeEach(async () => {
  const { db } = conn;
  await conn.pool.query("truncate table order_items, orders, product_options, products restart identity cascade");
  const t = tenantScope(db, bizId);
  const p1 = await t.products.create({ name: "Empanada", price: "1800" });
  const p2 = await t.products.create({ name: "Docena de carne", price: "1000" });
  const o1 = await t.options.create(p2.id, { label: "Docena", price: "19200" });
  const o2 = await t.options.create(p2.id, { label: "Media docena", price: "10200" });
  const p3 = await t.products.create({ name: "Remera", price: "18500", stock: 3 });
  const other = await tenantScope(db, otherBizId).products.create({ name: "Producto ajeno", price: "1" });
  empanada = p1.id; carne = p2.id; docena = o1.id; media = o2.id; remera = p3.id; ajeno = other.id;
});

const order = (payload: object) => app.inject({ method: "POST", url: "/public/orders", payload: { slug: "lupe", ...payload } });

describe("POST /public/orders", () => {
  it("registra el pedido y calcula el total en el servidor", async () => {
    const res = await order({ items: [{ productId: empanada, quantity: 3 }, { productId: carne, optionId: docena, quantity: 2 }], customerName: "Ana", notes: "Sin cebolla" });
    expect(res.statusCode).toBe(201);
    const b = res.json();
    expect(b.number).toBe(1);
    expect(b.total).toBe(3 * 1800 + 2 * 19200);
    expect(b.items).toHaveLength(2);
    const rows = (await conn.pool.query("select total, customer_name, notes from orders")).rows;
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].total)).toBe(43800);
    expect((await conn.pool.query("select count(*)::int as n from order_items")).rows[0].n).toBe(2);
  });

  it("ignora precios mandados por el cliente", async () => {
    const res = await order({ items: [{ productId: empanada, quantity: 1, price: 1, unitPrice: 1 }], total: 1 });
    expect(res.statusCode).toBe(201);
    expect(res.json().total).toBe(1800);
  });

  it("la opción define el precio; sin opción en un producto con opciones se rechaza", async () => {
    const ok = await order({ items: [{ productId: carne, optionId: media, quantity: 1 }] });
    expect(ok.json().total).toBe(10200);
    const bad = await order({ items: [{ productId: carne, quantity: 1 }] });
    expect(bad.statusCode).toBe(422);
    expect(bad.json().error).toBe("option_required");
  });

  it("rechaza opciones inexistentes, agotadas o de otro producto", async () => {
    await conn.pool.query("update product_options set sold_out = true where id = $1", [media]);
    expect((await order({ items: [{ productId: carne, optionId: media, quantity: 1 }] })).statusCode).toBe(422);
    expect((await order({ items: [{ productId: carne, optionId: "00000000-0000-4000-8000-000000000000", quantity: 1 }] })).statusCode).toBe(422);
    expect((await order({ items: [{ productId: empanada, optionId: docena, quantity: 1 }] })).json().error).toBe("invalid_option");
  });

  it("no acepta productos de otro negocio ni no disponibles", async () => {
    const foreign = await order({ items: [{ productId: ajeno, quantity: 1 }] });
    expect(foreign.statusCode).toBe(422);
    expect(foreign.json().error).toBe("unavailable");
    await conn.pool.query("update products set available = false where id = $1", [empanada]);
    expect((await order({ items: [{ productId: empanada, quantity: 1 }] })).statusCode).toBe(422);
  });

  it("numera correlativamente por negocio", async () => {
    const a = await order({ items: [{ productId: empanada, quantity: 1 }] });
    const b = await order({ items: [{ productId: empanada, quantity: 1 }] });
    expect([a.json().number, b.json().number]).toEqual([1, 2]);
  });

  it("pedidos simultáneos no repiten número", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => order({ items: [{ productId: empanada, quantity: 1 }] })));
    expect(results.every((r) => r.statusCode === 201)).toBe(true);
    expect(results.map((r) => r.json().number).sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("descuenta stock y rechaza cuando no alcanza, sin dejar un pedido a medias", async () => {
    expect((await order({ items: [{ productId: remera, quantity: 2 }] })).statusCode).toBe(201);
    expect((await conn.pool.query("select stock from products where id = $1", [remera])).rows[0].stock).toBe(1);
    const fail = await order({ items: [{ productId: empanada, quantity: 1 }, { productId: remera, quantity: 2 }] });
    expect(fail.statusCode).toBe(409);
    expect(fail.json().error).toBe("out_of_stock");
    expect((await conn.pool.query("select count(*)::int as n from orders")).rows[0].n).toBe(1); // solo el primero
    expect((await conn.pool.query("select stock from products where id = $1", [remera])).rows[0].stock).toBe(1);
  });

  it("dos pedidos a la vez por el último stock: solo uno gana", async () => {
    await conn.pool.query("update products set stock = 1 where id = $1", [remera]);
    const [a, b] = await Promise.all([order({ items: [{ productId: remera, quantity: 1 }] }), order({ items: [{ productId: remera, quantity: 1 }] })]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409]);
    expect((await conn.pool.query("select stock from products where id = $1", [remera])).rows[0].stock).toBe(0);
  });

  it("negocios no publicados o inexistentes", async () => {
    for (const slug of ["borrador", "no-existe"]) expect((await order({ slug, items: [{ productId: empanada, quantity: 1 }] })).statusCode).toBe(404);
    expect((await order({ slug: "suspendido", items: [{ productId: empanada, quantity: 1 }] })).statusCode).toBe(409);
  });

  it("exige fecha del evento si el negocio la pide", async () => {
    const res = await order({ slug: "fiestas", items: [{ productId: empanada, quantity: 1 }] });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe("event_date_required");
  });

  it("valida el formato del pedido", async () => {
    const bad: object[] = [
      { items: [] },
      { items: [{ productId: "no-uuid", quantity: 1 }] },
      { items: [{ productId: empanada, quantity: 0 }] },
      { items: [{ productId: empanada, quantity: 100 }] },
      { items: [{ productId: empanada, quantity: 1.5 }] },
      { items: [{ productId: empanada, quantity: 1 }], eventDate: "mañana" },
      { items: [{ productId: empanada, quantity: 1 }], notes: "x".repeat(501) },
    ];
    for (const p of bad) expect((await order(p)).statusCode).toBe(400);
  });

  it("limita la cantidad de pedidos por minuto desde una misma IP", async () => {
    const limited = buildApp(loadConfig({ NODE_ENV: "test", ORDERS_PER_MINUTE: "5" }), conn.check, conn.db);
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) {
      const r = await limited.inject({ method: "POST", url: "/public/orders", payload: { slug: "lupe", items: [{ productId: empanada, quantity: 1 }] } });
      codes.push(r.statusCode);
    }
    expect(codes.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(codes.slice(5).every((c) => c === 429)).toBe(true);
  });
});

describe("CORS", () => {
  const cfg = { FRONTEND_ORIGIN: "http://localhost:3000,https://mishowo.com", ROOT_DOMAIN: "mishowo.com" };
  it("acepta orígenes explícitos y subdominios del dominio raíz", () => {
    expect(originAllowed("https://mishowo.com", cfg)).toBe(true);
    expect(originAllowed("https://lupe.mishowo.com", cfg)).toBe(true);
    expect(originAllowed("http://localhost:3000", cfg)).toBe(true);
    expect(originAllowed(undefined, cfg)).toBe(true);
  });
  it("rechaza dominios parecidos o ajenos", () => {
    for (const o of ["https://evilmishowo.com", "https://mishowo.com.evil.com", "https://evil.com", "no-es-url"])
      expect(originAllowed(o, cfg)).toBe(false);
  });
});
