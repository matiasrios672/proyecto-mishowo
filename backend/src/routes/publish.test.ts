import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { setupTestDb } from "../db/testdb.js";
import { createMemoryMailer } from "../lib/mailer.js";
import * as s from "../db/schema.js";

const ORIGIN = "http://localhost:3000";
let conn: Awaited<ReturnType<typeof setupTestDb>>;
let app: ReturnType<typeof buildApp>;
const notified: string[] = [];
let cookieA: string, cookieB: string;

const product = (id: string, name: string, over: object = {}) => ({
  id, name, description: "", price: 1000, comparePrice: null, available: true, stock: null, isExample: false, options: [], ...over,
});
const doc = (over: object = {}) => ({
  industryId: "rotiseria", name: "Lupe", nameIsExample: false, tagline: "Casera", description: "Empanadas", textsAreExample: false,
  whatsapp: "11 5555-0000", instagram: "", address: "", deliveryZone: "Villa Crespo", extraWhatsapps: [],
  hours: Array.from({ length: 7 }, (_, i) => ({ open: i < 6, from: "09:00", to: "18:00" })),
  announcement: "", whatsappGreeting: "Hola!", showQuantities: true, askEventDate: false,
  design: { layout: "vidriera", theme: "terracota", fontPair: "calida", brandColor: null, buttonShape: "redondeado" },
  categories: [{ id: "c1", name: "Empanadas", products: [product("p1", "Carne"), product("p2", "Jamón y queso")] }],
  ...over,
});

const call = (method: "GET" | "PUT" | "POST", url: string, cookie: string | undefined, payload?: object, origin: string | null = ORIGIN) =>
  app.inject({ method, url, payload, headers: { ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) } });
const save = (cookie: string, baseVersion: number | null, content: object) => call("PUT", "/me/business", cookie, { baseVersion, content });
const publish = (cookie: string | undefined, slug: string) => call("POST", "/me/business/publish", cookie, { slug });

async function signup(email: string, verified = true) {
  const res = await app.inject({ method: "POST", url: "/auth/register", headers: { origin: ORIGIN }, payload: { email, password: "claveSegura123", name: "Test", lastName: "Persona", phone: "11 5555-0000" } });
  if (verified) await conn.pool.query("update users set email_verified_at = now() where email = $1", [email]);
  return `ms_session=${res.cookies.find((x) => x.name === "ms_session")!.value}`;
}

beforeAll(async () => {
  conn = await setupTestDb("mishowo_test_publish");
  await conn.pool.query("truncate table plans cascade");
  await conn.db.insert(s.plans).values([{ id: "gratis", name: "Gratis", priceMonthly: "0", limits: { products: 3 } }, { id: "pro", name: "Pro", priceMonthly: "100", limits: { products: null } }]);
  app = buildApp(loadConfig({ NODE_ENV: "test", AUTH_PER_MINUTE: "10000", PUBLISH_PER_MINUTE: "10000" }), conn.check, conn.db, {
    mailer: createMemoryMailer(), onSiteChanged: (slug) => void notified.push(slug),
  });
});
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query("truncate table order_items, orders, product_options, products, categories, businesses, auth_tokens, sessions, users restart identity cascade");
  notified.length = 0;
  cookieA = await signup("a@test.com");
  cookieB = await signup("b@test.com");
});

describe("¿está libre este link?", () => {
  it("valida formato, reservados y prohibidos", async () => {
    await save(cookieA, null, doc());
    const check = async (slug: string) => (await call("GET", `/me/slug?slug=${encodeURIComponent(slug)}`, cookieA)).json();
    expect(await check("empanadas-lupe")).toEqual({ available: true, slug: "empanadas-lupe" });
    expect(await check("admin")).toEqual({ available: false, reason: "reservado" });
    expect(await check("a")).toEqual({ available: false, reason: "formato" });
    expect(await check("Con Espacios")).toEqual({ available: false, reason: "formato" });
    expect(await check("mundo-porno")).toEqual({ available: false, reason: "prohibido" });
  });
  it("uno ocupado por otro negocio no está libre, pero el propio sí", async () => {
    await save(cookieA, null, doc());
    await save(cookieB, null, doc({ name: "Otro" }));
    expect((await publish(cookieA, "lupe")).statusCode).toBe(200);
    expect((await call("GET", "/me/slug?slug=lupe", cookieB)).json()).toEqual({ available: false, reason: "ocupado" });
    expect((await call("GET", "/me/slug?slug=lupe", cookieA)).json()).toEqual({ available: true, slug: "lupe" });
  });
  it("exige sesión", async () => {
    expect((await call("GET", "/me/slug?slug=lupe", undefined)).statusCode).toBe(401);
  });
});

describe("publicar", () => {
  it("exige sesión y que el pedido venga del sitio", async () => {
    expect((await publish(undefined, "lupe")).statusCode).toBe(401);
    await save(cookieA, null, doc());
    expect((await call("POST", "/me/business/publish", cookieA, { slug: "lupe" }, "https://evil.com")).statusCode).toBe(403);
    expect((await call("POST", "/me/business/publish", cookieA, { slug: "lupe" }, null)).statusCode).toBe(403);
  });
  it("sin negocio guardado: 404", async () => {
    expect((await publish(cookieA, "lupe")).statusCode).toBe(404);
  });
  it("exige el email verificado", async () => {
    const c = await signup("sin@test.com", false);
    await save(c, null, doc());
    const res = await publish(c, "sin-verificar");
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("email_not_verified");
  });
  it("lista qué falta cuando el negocio no está listo", async () => {
    await save(cookieA, null, doc({ name: "Mi Negocio", nameIsExample: true, whatsapp: "123", categories: [{ id: "c", name: "A", products: [product("x", "Ejemplo", { isExample: true })] }] }));
    const res = await publish(cookieA, "lupe");
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: "not_ready", missing: ["name", "whatsapp", "products"] });
  });
  it("rechaza links inválidos con el motivo", async () => {
    await save(cookieA, null, doc());
    for (const [slug, reason] of [["admin", "reservado"], ["x", "formato"], ["mal--link", "formato"], ["sexo-total", "prohibido"]] as const) {
      const res = await publish(cookieA, slug);
      expect(res.statusCode, slug).toBe(422);
      expect(res.json()).toEqual({ error: "invalid_slug", reason });
    }
  });

  it("publica: la página queda visible, sin los productos de ejemplo, y se avisa al frontend", async () => {
    await save(cookieA, null, doc({ categories: [{ id: "c1", name: "Empanadas", products: [product("p1", "Carne"), product("p9", "Producto de ejemplo", { isExample: true })] }] }));
    const slugBefore = (await conn.pool.query("select slug from businesses")).rows[0].slug as string;
    expect((await app.inject({ method: "GET", url: "/public/sites/lupe-empanadas" })).statusCode).toBe(404);

    const res = await publish(cookieA, "Lupe-Empanadas");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ slug: "lupe-empanadas", status: "published" });
    expect(notified).toEqual(["lupe-empanadas", slugBefore]); // el nuevo link y el provisorio que dejó de existir

    const site = (await app.inject({ method: "GET", url: "/public/sites/lupe-empanadas" })).json();
    expect(site.status).toBe("published");
    expect(site.products.map((p: { name: string }) => p.name)).toEqual(["Carne"]); // el ejemplo no sale
    expect((await conn.pool.query("select published_at from businesses")).rows[0].published_at).not.toBeNull();
  });

  it("dos links iguales: el segundo recibe 409", async () => {
    await save(cookieA, null, doc());
    await save(cookieB, null, doc({ name: "Otro" }));
    expect((await publish(cookieA, "lupe")).statusCode).toBe(200);
    const res = await publish(cookieB, "lupe");
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("slug_taken");
  });
  it("dos personas publicando el mismo link a la vez: solo una gana", async () => {
    await save(cookieA, null, doc());
    await save(cookieB, null, doc({ name: "Otro" }));
    const res = await Promise.all([publish(cookieA, "carrera"), publish(cookieB, "carrera")]);
    expect(res.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect((await conn.pool.query("select count(*)::int as n from businesses where slug = 'carrera'")).rows[0].n).toBe(1);
  });
  it("se puede cambiar el link y el anterior queda libre", async () => {
    await save(cookieA, null, doc());
    await publish(cookieA, "viejo");
    notified.length = 0;
    expect((await publish(cookieA, "nuevo")).statusCode).toBe(200);
    expect(notified).toEqual(["nuevo", "viejo"]);
    expect((await app.inject({ method: "GET", url: "/public/sites/viejo" })).statusCode).toBe(404);
    expect((await call("GET", "/me/slug?slug=viejo", cookieB)).json().available).toBe(true);
  });

  it("despublicar oculta la página y avisa", async () => {
    await save(cookieA, null, doc());
    await publish(cookieA, "lupe");
    notified.length = 0;
    expect((await call("POST", "/me/business/unpublish", cookieA, {})).json()).toEqual({ status: "draft" });
    expect(notified).toEqual(["lupe"]);
    expect((await app.inject({ method: "GET", url: "/public/sites/lupe" })).statusCode).toBe(404);
  });
  it("un negocio suspendido por el admin no puede publicar ni despublicar", async () => {
    await save(cookieA, null, doc());
    await publish(cookieA, "lupe");
    await conn.pool.query("update businesses set status = 'suspended'");
    expect((await publish(cookieA, "lupe")).json().error).toBe("suspended");
    expect((await call("POST", "/me/business/unpublish", cookieA, {})).statusCode).toBe(403);
  });
});

describe("límite de publicaciones", () => {
  it("frena a quien publica sin parar", async () => {
    const limited = buildApp(loadConfig({ NODE_ENV: "test", AUTH_PER_MINUTE: "10000", PUBLISH_PER_MINUTE: "3" }), conn.check, conn.db, { mailer: createMemoryMailer(), onSiteChanged: () => {} });
    await save(cookieA, null, doc());
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await limited.inject({ method: "POST", url: "/me/business/publish", payload: { slug: "lupe" }, headers: { cookie: cookieA, origin: ORIGIN } })).statusCode);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
  });
});

describe("límites del plan (los edita el admin)", () => {
  const many = (n: number, example = false) => doc({ categories: [{ id: "c", name: "Todo", products: Array.from({ length: n }, (_, i) => product(`q${i}`, `Producto ${i}`, { isExample: example })) }] });

  it("el plan gratis no deja guardar más productos propios que su límite", async () => {
    const ok = await save(cookieA, null, many(3));
    expect(ok.statusCode).toBe(201);
    const over = await save(cookieA, 1, many(4));
    expect(over.statusCode).toBe(422);
    expect(over.json()).toEqual({ error: "plan_limit", limit: 3, count: 4 });
    expect((await call("GET", "/me/business", cookieA)).json().content.categories[0].products).toHaveLength(3); // no se guardó
  });
  it("los productos de ejemplo no cuentan para el límite", async () => {
    expect((await save(cookieA, null, many(10, true))).statusCode).toBe(201);
  });
  it("el límite se lee de la tabla de planes: al subirlo desde el admin, deja guardar más", async () => {
    await save(cookieA, null, many(3));
    expect((await save(cookieA, 1, many(5))).statusCode).toBe(422);
    await conn.pool.query("update plans set limits = '{\"products\": 10}' where id = 'gratis'");
    expect((await save(cookieA, 1, many(5))).statusCode).toBe(200);
    await conn.pool.query("update plans set limits = '{\"products\": 3}' where id = 'gratis'");
  });
  it("un plan sin límite no restringe", async () => {
    await save(cookieA, null, many(2));
    await conn.pool.query("update businesses set plan_id = 'pro'");
    expect((await save(cookieA, 1, many(40))).statusCode).toBe(200);
  });
  it("al publicar también se respeta el límite (si bajó después de guardar)", async () => {
    await save(cookieA, null, many(3));
    await conn.pool.query("update plans set limits = '{\"products\": 2}' where id = 'gratis'");
    const res = await publish(cookieA, "lupe");
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: "plan_limit", limit: 2, count: 3 });
    await conn.pool.query("update plans set limits = '{\"products\": 3}' where id = 'gratis'");
  });
});

describe("la página publicada se actualiza al editar", () => {
  it("avisa al guardar si el negocio está publicado, y no si es un borrador", async () => {
    const r1 = await save(cookieA, null, doc());
    expect(notified).toEqual([]); // borrador: nadie para avisar
    await publish(cookieA, "lupe");
    notified.length = 0;
    expect((await save(cookieA, r1.json().version, doc({ name: "Lupe 2" }))).statusCode).toBe(200);
    expect(notified).toEqual(["lupe"]);
  });
  it("el aviso real usa el secreto y no rompe si el frontend no responde", async () => {
    const { createRevalidator } = await import("../lib/revalidate.js");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("sin red"));
    const logs: string[] = [];
    createRevalidator(loadConfig({ NODE_ENV: "test", REVALIDATE_SECRET: "x".repeat(20) }), (m) => logs.push(m))("lupe");
    createRevalidator(loadConfig({ NODE_ENV: "test" }))("lupe"); // sin secreto: no hace nada
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect((fetchSpy.mock.calls[0]![1] as RequestInit).headers).toMatchObject({ "x-revalidate-secret": "x".repeat(20) });
    expect(logs[0]).toContain("lupe");
    fetchSpy.mockRestore();
  });
});
