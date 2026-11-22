import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { setupTestDb } from "../db/testdb.js";
import { createMemoryMailer } from "../lib/mailer.js";
import { csvCell, toCsv } from "../orders/csv.js";
import { canTransition, nextStatuses } from "../orders/status.js";
import * as s from "../db/schema.js";

const ORIGIN = "http://localhost:3000";
let conn: Awaited<ReturnType<typeof setupTestDb>>;
let app: ReturnType<typeof buildApp>;
const mailer = createMemoryMailer();
let cookieA: string, cookieB: string, bizA: string, bizB: string;
let pEmp: string, pRem: string, pSin: string, oDoc: string;

const call = (method: "GET" | "POST" | "PATCH", url: string, cookie?: string, payload?: object, origin: string | null = ORIGIN) =>
  app.inject({ method, url, payload, headers: { ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) } });

async function signup(email: string) {
  const res = await app.inject({ method: "POST", url: "/auth/register", headers: { origin: ORIGIN }, payload: { email, password: "claveSegura123" } });
  return { cookie: `ms_session=${res.cookies.find((x) => x.name === "ms_session")!.value}`, id: res.json().user.id as string };
}
const stock = async (table: "products" | "product_options", id: string) => (await conn.pool.query(`select stock from ${table} where id = $1`, [id])).rows[0].stock as number | null;
const place = (slug: string, items: object[], extra: object = {}) => app.inject({ method: "POST", url: "/public/orders", payload: { slug, items, ...extra } });
const orderIds = async (biz: string) => (await conn.pool.query("select id from orders where business_id = $1 order by number", [biz])).rows.map((r) => r.id as string);

beforeAll(async () => {
  conn = await setupTestDb("mishowo_test_panel");
  app = buildApp(loadConfig({ NODE_ENV: "test", AUTH_PER_MINUTE: "10000", ORDERS_PER_MINUTE: "10000" }), conn.check, conn.db, { mailer });
});
afterAll(async () => { await conn.pool.end(); });

beforeEach(async () => {
  await conn.pool.query("truncate table order_items, orders, product_options, products, categories, businesses, auth_tokens, sessions, users restart identity cascade");
  mailer.outbox.length = 0;
  const a = await signup("a@test.com");
  const b = await signup("b@test.com");
  cookieA = a.cookie; cookieB = b.cookie;
  const [ba] = await conn.db.insert(s.businesses).values({ slug: "negocio-a", ownerId: a.id, name: "Negocio A", status: "published" }).returning();
  const [bb] = await conn.db.insert(s.businesses).values({ slug: "negocio-b", ownerId: b.id, name: "Negocio B", status: "published" }).returning();
  bizA = ba!.id; bizB = bb!.id;
  const [emp] = await conn.db.insert(s.products).values({ businessId: bizA, name: "Empanada", price: "1000", stock: 5 }).returning();
  const [rem] = await conn.db.insert(s.products).values({ businessId: bizA, name: "Remera", price: "500", stock: null }).returning();
  const [sin] = await conn.db.insert(s.products).values({ businessId: bizA, name: "Pan", price: "300" }).returning();
  const [docena] = await conn.db.insert(s.productOptions).values({ businessId: bizA, productId: rem!.id, label: "M", price: "600", stock: 4 }).returning();
  await conn.db.insert(s.products).values({ businessId: bizB, name: "Producto de B", price: "100" });
  pEmp = emp!.id; pRem = rem!.id; pSin = sin!.id; oDoc = docena!.id;
});

describe("reglas de estado (puras)", () => {
  it("avanza paso a paso y se puede cancelar hasta entregar; entregado y cancelado son finales", () => {
    expect(canTransition("nuevo", "confirmado")).toBe(true);
    expect(canTransition("nuevo", "cancelado")).toBe(true);
    expect(canTransition("confirmado", "listo")).toBe(true);
    expect(canTransition("listo", "entregado")).toBe(true);
    expect(canTransition("listo", "cancelado")).toBe(true);
    for (const to of ["nuevo", "confirmado", "listo", "entregado", "cancelado"]) {
      expect(canTransition("entregado", to)).toBe(false);
      expect(canTransition("cancelado", to)).toBe(false);
    }
    expect(canTransition("nuevo", "listo")).toBe(false); // no se saltea
    expect(canTransition("nuevo", "entregado")).toBe(false);
    expect(canTransition("listo", "nuevo")).toBe(false); // no se retrocede
    expect(canTransition("raro", "nuevo")).toBe(false);
    expect(nextStatuses("nuevo")).toEqual(["confirmado", "cancelado"]);
    expect(nextStatuses("cancelado")).toEqual([]);
  });
});

describe("CSV (puro)", () => {
  it("escapa comillas, saltos de línea y separadores", () => {
    expect(csvCell('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell("línea 1\nlínea 2")).toBe('"línea 1\nlínea 2"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(12.5)).toBe("12.5");
  });
  it("neutraliza fórmulas: Excel no ejecuta lo que escribió un cliente", () => {
    for (const evil of ['=HYPERLINK("http://evil.com","click")', "+cmd|' /C calc'!A0", "-2+3", "@SUM(A1)", "\t=1+1"]) {
      const cell = csvCell(evil);
      expect(cell.replace(/^"/, "").startsWith("'"), evil).toBe(true);
    }
    expect(csvCell("normal =no pasa nada")).toBe("normal =no pasa nada");
  });
  it("arma el archivo con BOM, separador ; y fin de línea de Windows", () => {
    const out = toCsv(["A", "B"], [[1, "x"], [2, "y;z"]]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toBe('﻿A;B\r\n1;x\r\n2;"y;z"\r\n');
  });
});

describe("acceso y aislamiento", () => {
  it("todo exige sesión", async () => {
    for (const url of ["/me/orders", "/me/orders/summary", "/me/orders.csv", "/me/orders/00000000-0000-4000-8000-000000000000"]) expect((await call("GET", url)).statusCode, url).toBe(401);
    expect((await call("PATCH", "/me/orders/00000000-0000-4000-8000-000000000000/status", undefined, { status: "confirmado" })).statusCode).toBe(401);
  });
  it("cambiar un estado desde otro origen se rechaza (CSRF)", async () => {
    await place("negocio-a", [{ productId: pSin, quantity: 1 }]);
    const [id] = await orderIds(bizA);
    for (const origin of [null, "https://evil.com", "http://negocio-a.localhost:3000"])
      expect((await call("PATCH", `/me/orders/${id}/status`, cookieA, { status: "confirmado" }, origin)).statusCode, String(origin)).toBe(403);
  });
  it("sin negocio: 404", async () => {
    const c = (await signup("sin@test.com")).cookie;
    expect((await call("GET", "/me/orders", c)).json().error).toBe("no_business");
  });
  it("cada negocio ve solo sus pedidos y no puede leer ni cambiar los de otro", async () => {
    await place("negocio-a", [{ productId: pSin, quantity: 2 }], { customerName: "Ana" });
    const [bProd] = (await conn.pool.query("select id from products where business_id = $1", [bizB])).rows;
    await place("negocio-b", [{ productId: bProd.id, quantity: 1 }], { customerName: "Beto" });
    const [idA] = await orderIds(bizA);
    const [idB] = await orderIds(bizB);

    expect((await call("GET", "/me/orders", cookieA)).json().orders.map((o: { customerName: string }) => o.customerName)).toEqual(["Ana"]);
    expect((await call("GET", "/me/orders", cookieB)).json().orders.map((o: { customerName: string }) => o.customerName)).toEqual(["Beto"]);
    expect((await call("GET", `/me/orders/${idB}`, cookieA)).statusCode).toBe(404);
    expect((await call("PATCH", `/me/orders/${idB}/status`, cookieA, { status: "cancelado" })).statusCode).toBe(404);
    expect((await conn.pool.query("select status from orders where id = $1", [idB])).rows[0].status).toBe("nuevo");
    expect((await call("GET", `/me/orders/${idA}`, cookieA)).json()).toMatchObject({ number: 1, customerName: "Ana", total: 600 });
    expect((await call("GET", "/me/orders/no-es-uuid", cookieA)).statusCode).toBe(404);
  });
});

describe("listado, filtros y resumen", () => {
  it("devuelve el más nuevo primero, con sus productos, y filtra por estado", async () => {
    for (let i = 0; i < 3; i++) await place("negocio-a", [{ productId: pSin, quantity: i + 1 }]);
    const ids = await orderIds(bizA);
    await call("PATCH", `/me/orders/${ids[0]}/status`, cookieA, { status: "confirmado" });
    const all = (await call("GET", "/me/orders", cookieA)).json();
    expect(all.orders.map((o: { number: number }) => o.number)).toEqual([3, 2, 1]);
    expect(all.orders[0].items).toEqual([{ name: "Pan", optionLabel: null, unitPrice: 300, quantity: 3 }]);
    expect(all.orders[2].nextStatuses).toEqual(["listo", "cancelado"]);
    expect((await call("GET", "/me/orders?status=confirmado", cookieA)).json().orders).toHaveLength(1);
    expect((await call("GET", "/me/orders?status=nuevo", cookieA)).json().orders).toHaveLength(2);
    expect((await call("GET", "/me/orders?status=inventado", cookieA)).statusCode).toBe(400);
  });
  it("pagina con límite y cursor, sin repetir ni saltear pedidos", async () => {
    for (let i = 0; i < 5; i++) { await place("negocio-a", [{ productId: pSin, quantity: 1 }]); await new Promise((r) => setTimeout(r, 5)); }
    const p1 = (await call("GET", "/me/orders?limit=2", cookieA)).json();
    expect(p1.orders.map((o: { number: number }) => o.number)).toEqual([5, 4]);
    const p2 = (await call("GET", `/me/orders?limit=2&before=${encodeURIComponent(p1.nextBefore)}`, cookieA)).json();
    expect(p2.orders.map((o: { number: number }) => o.number)).toEqual([3, 2]);
    const p3 = (await call("GET", `/me/orders?limit=2&before=${encodeURIComponent(p2.nextBefore)}`, cookieA)).json();
    expect(p3.orders.map((o: { number: number }) => o.number)).toEqual([1]);
    expect(p3.nextBefore).toBeNull();
    expect((await call("GET", "/me/orders?limit=0", cookieA)).statusCode).toBe(400);
    expect((await call("GET", "/me/orders?limit=500", cookieA)).statusCode).toBe(400);
    expect((await call("GET", "/me/orders?before=ayer", cookieA)).statusCode).toBe(400);
  });
  it("el resumen cuenta por estado", async () => {
    for (let i = 0; i < 3; i++) await place("negocio-a", [{ productId: pSin, quantity: 1 }]);
    const ids = await orderIds(bizA);
    await call("PATCH", `/me/orders/${ids[0]}/status`, cookieA, { status: "cancelado" });
    expect((await call("GET", "/me/orders/summary", cookieA)).json()).toEqual({ counts: { nuevo: 2, confirmado: 0, listo: 0, entregado: 0, cancelado: 1 }, total: 3 });
  });
});

describe("cambiar el estado", () => {
  it("recorre todo el circuito y rechaza saltos y movimientos desde un estado final", async () => {
    await place("negocio-a", [{ productId: pSin, quantity: 1 }]);
    const [id] = await orderIds(bizA);
    const set = (status: string) => call("PATCH", `/me/orders/${id}/status`, cookieA, { status });
    expect((await set("listo")).statusCode).toBe(409); // se saltea "confirmado"
    expect((await set("confirmado")).json().status).toBe("confirmado");
    expect((await set("listo")).json().nextStatuses).toEqual(["entregado", "cancelado"]);
    expect((await set("entregado")).json().status).toBe("entregado");
    const final = await set("cancelado");
    expect(final.statusCode).toBe(409);
    expect(final.json()).toMatchObject({ error: "invalid_transition", from: "entregado" });
    expect((await set("inventado")).statusCode).toBe(400);
  });
});

describe("cancelar repone el stock", () => {
  it("devuelve al producto lo que el pedido descontó", async () => {
    await place("negocio-a", [{ productId: pEmp, quantity: 2 }]);
    expect(await stock("products", pEmp)).toBe(3);
    const [id] = await orderIds(bizA);
    expect((await call("PATCH", `/me/orders/${id}/status`, cookieA, { status: "cancelado" })).statusCode).toBe(200);
    expect(await stock("products", pEmp)).toBe(5);
  });
  it("si la opción controla su propio stock, se repone ahí y no en el producto", async () => {
    await place("negocio-a", [{ productId: pRem, optionId: oDoc, quantity: 3 }]);
    expect(await stock("product_options", oDoc)).toBe(1);
    const [id] = await orderIds(bizA);
    await call("PATCH", `/me/orders/${id}/status`, cookieA, { status: "cancelado" });
    expect(await stock("product_options", oDoc)).toBe(4);
    expect(await stock("products", pRem)).toBeNull();
  });
  it("productos sin control de stock no se tocan", async () => {
    await place("negocio-a", [{ productId: pSin, quantity: 7 }]);
    const [id] = await orderIds(bizA);
    await call("PATCH", `/me/orders/${id}/status`, cookieA, { status: "cancelado" });
    expect(await stock("products", pSin)).toBeNull();
  });
  it("si el producto ya se borró, cancelar igual funciona", async () => {
    await place("negocio-a", [{ productId: pEmp, quantity: 1 }]);
    await conn.pool.query("delete from products where id = $1", [pEmp]);
    const [id] = await orderIds(bizA);
    expect((await call("PATCH", `/me/orders/${id}/status`, cookieA, { status: "cancelado" })).statusCode).toBe(200);
  });
  it("cancelar dos veces repone una sola vez", async () => {
    await place("negocio-a", [{ productId: pEmp, quantity: 2 }]);
    const [id] = await orderIds(bizA);
    expect((await call("PATCH", `/me/orders/${id}/status`, cookieA, { status: "cancelado" })).statusCode).toBe(200);
    expect((await call("PATCH", `/me/orders/${id}/status`, cookieA, { status: "cancelado" })).statusCode).toBe(409);
    expect(await stock("products", pEmp)).toBe(5);
  });
  it("dos cancelaciones simultáneas: una gana y el stock se repone exactamente una vez", async () => {
    await place("negocio-a", [{ productId: pEmp, quantity: 2 }]);
    const [id] = await orderIds(bizA);
    const res = await Promise.all([call("PATCH", `/me/orders/${id}/status`, cookieA, { status: "cancelado" }), call("PATCH", `/me/orders/${id}/status`, cookieA, { status: "cancelado" })]);
    expect(res.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(await stock("products", pEmp)).toBe(5);
  });
});

describe("CORS desde el navegador", () => {
  it("permite el PATCH del cambio de estado (si no, el panel falla en el navegador aunque el backend funcione)", async () => {
    const res = await app.inject({ method: "OPTIONS", url: "/me/orders/00000000-0000-4000-8000-000000000000/status", headers: { origin: ORIGIN, "access-control-request-method": "PATCH", "access-control-request-headers": "content-type" } });
    expect(res.statusCode).toBe(204);
    expect(String(res.headers["access-control-allow-methods"])).toContain("PATCH");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});

describe("exportar a CSV", () => {
  it("baja solo los pedidos propios, con BOM y sin dejar que un cliente inyecte fórmulas", async () => {
    await place("negocio-a", [{ productId: pEmp, quantity: 2 }], { customerName: '=HYPERLINK("http://evil.com","ver")', notes: 'Sin "cebolla";\ntocar timbre', customerPhone: "11 5555-0000" });
    const [bProd] = (await conn.pool.query("select id from products where business_id = $1", [bizB])).rows;
    await place("negocio-b", [{ productId: bProd.id, quantity: 1 }], { customerName: "Beto" });

    const res = await call("GET", "/me/orders.csv", cookieA);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toBe('attachment; filename="pedidos-negocio-a.csv"');
    const body = res.body;
    expect(body.startsWith("﻿Pedido;Fecha;Estado;Cliente;Teléfono;Total;Fecha del evento;Notas;Productos")).toBe(true);
    expect(body).toContain("'=HYPERLINK"); // la fórmula quedó como texto
    expect(body).not.toMatch(/;=HYPERLINK/);
    expect(body).toContain('"Sin ""cebolla"";\ntocar timbre"'); // comillas y salto de línea bien escapados
    expect(body).toContain("2 x Empanada");
    expect(body).toContain("2000,00"); // el total con coma decimal (Excel en español)
    expect(body).not.toContain("Beto"); // nada del otro negocio
    expect((await call("GET", "/me/orders.csv", undefined)).statusCode).toBe(401);
  });
});

describe("aviso al dueño", () => {
  it("al entrar un pedido le llega un email con el detalle y el link al panel", async () => {
    const res = await place("negocio-a", [{ productId: pEmp, quantity: 2 }, { productId: pRem, optionId: oDoc, quantity: 1 }], { customerName: "Ana", notes: "Sin cebolla" });
    expect(res.statusCode).toBe(201);
    expect(JSON.stringify(res.json())).not.toMatch(/ownerId|businessName|a@test\.com/); // la respuesta pública no filtra datos del dueño
    const orderMail = () => mailer.outbox.find((m) => m.to === "a@test.com" && m.subject.startsWith("Nuevo pedido"));
    for (let i = 0; i < 40 && !orderMail(); i++) await new Promise((r) => setTimeout(r, 25));
    const mail = orderMail()!;
    expect(mail.subject).toBe("Nuevo pedido #1 en Negocio A");
    expect(mail.text).toContain("2 x Empanada");
    expect(mail.text).toContain("1 x Remera (M)");
    expect(mail.text).toContain("Cliente: Ana");
    expect(mail.text).toContain("Aclaraciones: Sin cebolla");
    expect(mail.text).toContain("/panel/pedidos");
    expect(mailer.outbox.some((m) => m.to === "b@test.com" && m.subject.startsWith("Nuevo pedido"))).toBe(false);
  });
  it("si el mail falla el pedido igual queda registrado", async () => {
    const broken = buildApp(loadConfig({ NODE_ENV: "test", ORDERS_PER_MINUTE: "10000" }), conn.check, conn.db, { mailer: { send: async () => { throw new Error("SMTP caído"); } } });
    const res = await broken.inject({ method: "POST", url: "/public/orders", payload: { slug: "negocio-a", items: [{ productId: pSin, quantity: 1 }] } });
    expect(res.statusCode).toBe(201);
    expect((await conn.pool.query("select count(*)::int as n from orders")).rows[0].n).toBe(1);
  });
});
