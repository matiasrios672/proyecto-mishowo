import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { setupTestDb } from "../db/testdb.js";
import { createMemoryMailer } from "../lib/mailer.js";

const ORIGIN = "http://localhost:3000";
let conn: Awaited<ReturnType<typeof setupTestDb>>;
let app: ReturnType<typeof buildApp>;
let cookieA: string, cookieB: string;

const product = (id: string, name: string, over: object = {}) => ({
  id, name, description: "", price: 1000, comparePrice: null, available: true, stock: null, isExample: false, options: [], ...over,
});
const doc = (over: object = {}) => ({
  industryId: "rotiseria", name: "Lupe", nameIsExample: false, tagline: "Casera", description: "Empanadas", textsAreExample: false,
  whatsapp: "11 5555-0000", instagram: "@lupe", address: "", deliveryZone: "Villa Crespo", extraWhatsapps: [],
  hours: Array.from({ length: 7 }, (_, i) => ({ open: i < 6, from: "09:00", to: "18:00" })),
  announcement: "", whatsappGreeting: "Hola!", metaPixelId: "", gaId: "", showQuantities: true, ordersEnabled: true, installments: { enabled: false, count: 3, note: "", minAmount: 0 }, askEventDate: false,
  design: { layout: "vidriera", theme: "terracota", fontPair: "calida", brandColor: null, buttonShape: "redondeado" },
  categories: [
    { id: "c1", name: "Empanadas", products: [
      product("p1", "Carne", { price: 1800, options: [{ id: "o1", label: "Unidad", price: null, soldOut: false }, { id: "o2", label: "Docena", price: 19200, soldOut: false }] }),
      product("p2", "Jamón y queso", { price: 1700 }),
    ] },
    { id: "c2", name: "Platos", products: [product("p3", "Milanesa", { price: 9500, stock: 4, comparePrice: 11000 })] },
  ],
  ...over,
});

const put = (cookie: string | undefined, baseVersion: number | null, content: object, origin: string | null = ORIGIN) =>
  app.inject({ method: "PUT", url: "/me/business", payload: { baseVersion, content }, headers: { ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) } });
const get = (cookie?: string) => app.inject({ method: "GET", url: "/me/business", headers: cookie ? { cookie } : {} });

async function signup(email: string) {
  const res = await app.inject({ method: "POST", url: "/auth/register", headers: { origin: ORIGIN }, payload: { email, password: "claveSegura123" } });
  const c = res.cookies.find((x) => x.name === "ms_session")!;
  return `ms_session=${c.value}`;
}
const count = async (table: string) => (await conn.pool.query(`select count(*)::int as n from ${table}`)).rows[0].n as number;

beforeAll(async () => {
  conn = await setupTestDb("mishowo_test_me");
  app = buildApp(loadConfig({ NODE_ENV: "test", AUTH_PER_MINUTE: "10000" }), conn.check, conn.db, { mailer: createMemoryMailer() });
});
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query("truncate table order_items, orders, product_options, products, categories, businesses, auth_tokens, sessions, users restart identity cascade");
  cookieA = await signup("a@test.com");
  cookieB = await signup("b@test.com");
});

describe("acceso", () => {
  it("exige sesión", async () => {
    expect((await get()).statusCode).toBe(401);
    expect((await put(undefined, null, doc())).statusCode).toBe(401);
  });
  it("rechaza escrituras que no vengan del sitio (CSRF)", async () => {
    for (const origin of [null, "https://evil.com", "http://lupe.localhost:3000"]) expect((await put(cookieA, null, doc(), origin)).statusCode, String(origin)).toBe(403);
    expect(await count("businesses")).toBe(0);
  });
  it("sin negocio todavía devuelve null", async () => {
    expect((await get(cookieA)).json()).toEqual({ business: null, content: null });
  });
});

describe("crear y leer", () => {
  it("el primer guardado crea el negocio (borrador, slug provisorio válido) y el catálogo", async () => {
    const res = await put(cookieA, null, doc());
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ version: 1 });
    const b = (await conn.pool.query("select b.slug, b.status, b.plan_id, b.name, u.email from businesses b join users u on u.id = b.owner_id")).rows[0];
    expect(b).toMatchObject({ status: "draft", plan_id: "gratis", name: "Lupe", email: "a@test.com" });
    expect(b.slug).toMatch(/^mi-pagina-[0-9a-f]{8}$/);
    expect([await count("categories"), await count("products"), await count("product_options")]).toEqual([2, 3, 2]);
  });

  it("al leerlo devuelve exactamente el mismo documento", async () => {
    const sent = doc({ design: { layout: "grilla", theme: "rosa", fontPair: "clasica", brandColor: "#1B6390", buttonShape: "pildora" }, announcement: "Hoy cerramos temprano", askEventDate: true, showQuantities: false, extraWhatsapps: [{ number: "11 4444-0000", role: "soporte" }] });
    await put(cookieA, null, sent);
    const got = await get(cookieA);
    expect(got.json().content).toEqual(sent);
    expect(got.json().business).toMatchObject({ status: "draft", planId: "gratis", version: 1 });
    expect(got.headers["cache-control"]).toBe("no-store");
  });

  it("acepta un documento con campos a medio escribir (nombre vacío, hora incompleta)", async () => {
    const hours = Array.from({ length: 7 }, () => ({ open: true, from: "", to: "18:00" }));
    expect((await put(cookieA, null, doc({ name: "", hours }))).statusCode).toBe(201);
    expect((await get(cookieA)).json().content.hours[0].from).toBe("");
  });

  it("guarda un catálogo grande rápido (500 productos)", async () => {
    const big = doc({ categories: [{ id: "c", name: "Todo", products: Array.from({ length: 500 }, (_, i) => product(`p${i}`, `Producto ${i}`, { options: [{ id: `o${i}`, label: "Único", price: null, soldOut: false }] })) }] });
    const t0 = Date.now();
    expect((await put(cookieA, null, big)).statusCode).toBe(201);
    expect(Date.now() - t0).toBeLessThan(5000);
    expect([await count("products"), await count("product_options")]).toEqual([500, 500]);
    expect((await get(cookieA)).json().content.categories[0].products).toHaveLength(500);
  });
});

describe("actualizar sin perder identidad", () => {
  it("renombrar y reordenar conserva los uuid; agregar y quitar se refleja", async () => {
    await put(cookieA, null, doc());
    const before = (await conn.pool.query("select id, client_id from products order by client_id")).rows;
    const edited = doc({ categories: [
      { id: "c2", name: "Platos del día", products: [product("p3", "Milanesa napolitana", { price: 10000 }), product("p2", "Jamón y queso", { price: 1700 })] },
      { id: "c1", name: "Empanadas", products: [product("p1", "Carne", { price: 1800 }), product("p9", "Humita")] },
    ] });
    const res = await put(cookieA, 1, edited);
    expect(res.statusCode).toBe(200);
    expect(res.json().version).toBe(2);

    const after = (await conn.pool.query("select id, client_id, name, position from products order by client_id")).rows;
    for (const id of ["p1", "p2", "p3"]) expect(after.find((r) => r.client_id === id).id).toBe(before.find((r) => r.client_id === id).id); // mismo uuid
    expect(after.find((r) => r.client_id === "p3").name).toBe("Milanesa napolitana");
    expect(after.some((r) => r.client_id === "p9")).toBe(true);
    expect(await count("product_options")).toBe(0); // se quitaron las opciones de p1
    expect((await get(cookieA)).json().content).toEqual(edited); // y el orden de categorías cambió
  });

  it("al quitar un producto los pedidos viejos se conservan con su nombre y precio", async () => {
    await put(cookieA, null, doc());
    const biz = (await conn.pool.query("select id from businesses")).rows[0].id;
    const prod = (await conn.pool.query("select id from products where client_id = 'p2'")).rows[0].id;
    const o = (await conn.pool.query("insert into orders (business_id, number, total) values ($1, 1, 1700) returning id", [biz])).rows[0].id;
    await conn.pool.query("insert into order_items (business_id, order_id, product_id, name, unit_price, quantity) values ($1, $2, $3, 'Jamón y queso', 1700, 1)", [biz, o, prod]);

    await put(cookieA, 1, doc({ categories: [{ id: "c1", name: "Empanadas", products: [product("p1", "Carne")] }] }));
    const item = (await conn.pool.query("select product_id, name, unit_price from order_items")).rows[0];
    expect(item).toMatchObject({ product_id: null, name: "Jamón y queso" });
    expect(Number(item.unit_price)).toBe(1700);
    expect(await count("orders")).toBe(1);
  });

  it("vaciar el catálogo borra todo lo del negocio", async () => {
    await put(cookieA, null, doc());
    expect((await put(cookieA, 1, doc({ categories: [] }))).statusCode).toBe(200);
    expect([await count("categories"), await count("products"), await count("product_options")]).toEqual([0, 0, 0]);
  });

  it("no pierde el stock actual si el editor lo reenvía igual, y toma el nuevo si cambia", async () => {
    await put(cookieA, null, doc());
    await put(cookieA, 1, doc({ categories: [{ id: "c2", name: "Platos", products: [product("p3", "Milanesa", { stock: 2 })] }] }));
    expect((await conn.pool.query("select stock from products where client_id = 'p3'")).rows[0].stock).toBe(2);
  });
});

describe("ediciones simultáneas", () => {
  it("una versión vieja se rechaza con 409 y no pisa nada", async () => {
    await put(cookieA, null, doc());
    await put(cookieA, 1, doc({ name: "Desde el celular" })); // v2
    const stale = await put(cookieA, 1, doc({ name: "Desde la compu (viejo)" }));
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({ error: "version_conflict", version: 2 });
    expect((await get(cookieA)).json().content.name).toBe("Desde el celular");
  });
  it("crear de nuevo cuando ya existe es conflicto, y pedir una versión de un negocio inexistente también", async () => {
    await put(cookieA, null, doc());
    expect((await put(cookieA, null, doc())).statusCode).toBe(409);
    expect((await put(cookieB, 3, doc())).statusCode).toBe(409);
    expect(await count("businesses")).toBe(1);
  });
  it("dos guardados a la vez con la misma versión: uno gana y el otro recibe conflicto", async () => {
    await put(cookieA, null, doc());
    const res = await Promise.all([put(cookieA, 1, doc({ name: "Uno" })), put(cookieA, 1, doc({ name: "Dos" }))]);
    expect(res.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect((await conn.pool.query("select content_version from businesses")).rows[0].content_version).toBe(2);
  });
  it("dos primeros guardados a la vez no crean dos negocios", async () => {
    const res = await Promise.all([put(cookieA, null, doc({ name: "Uno" })), put(cookieA, null, doc({ name: "Dos" }))]);
    expect(res.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(await count("businesses")).toBe(1);
  });
});

describe("aislamiento entre usuarios", () => {
  it("dos cuentas pueden usar los mismos ids del editor sin pisarse ni verse", async () => {
    await put(cookieA, null, doc({ name: "Negocio de A" }));
    await put(cookieB, null, doc({ name: "Negocio de B", categories: [{ id: "c1", name: "Cosas", products: [product("p1", "Producto de B")] }] }));
    expect(await count("businesses")).toBe(2);
    expect((await get(cookieA)).json().content.name).toBe("Negocio de A");
    expect((await get(cookieA)).json().content.categories[0].products[0].name).toBe("Carne");
    expect((await get(cookieB)).json().content.categories[0].products[0].name).toBe("Producto de B");

    await put(cookieB, 1, doc({ name: "B cambió", categories: [] }));
    expect((await get(cookieA)).json().content.categories).toHaveLength(2); // A intacto
    expect((await get(cookieA)).json().business.version).toBe(1);
  });
});

describe("validación", () => {
  const bad: [string, object][] = [
    ["ids de producto repetidos", doc({ categories: [{ id: "c1", name: "A", products: [product("x", "1"), product("x", "2")] }] })],
    ["ids de categoría repetidos", doc({ categories: [{ id: "c", name: "A", products: [] }, { id: "c", name: "B", products: [] }] })],
    ["tema inexistente", doc({ design: { layout: "vidriera", theme: "fucsia", fontPair: "calida", brandColor: null, buttonShape: "recto" } })],
    ["color de marca inválido", doc({ design: { layout: "vidriera", theme: "rosa", fontPair: "calida", brandColor: "rojo", buttonShape: "recto" } })],
    ["precio negativo", doc({ categories: [{ id: "c", name: "A", products: [product("p", "x", { price: -1 })] }] })],
    ["stock decimal", doc({ categories: [{ id: "c", name: "A", products: [product("p", "x", { stock: 1.5 })] }] })],
    ["31 categorías", doc({ categories: Array.from({ length: 31 }, (_, i) => ({ id: `c${i}`, name: "x", products: [] })) })],
    ["nombre larguísimo", doc({ name: "x".repeat(61) })],
    ["horarios incompletos", doc({ hours: [] })],
    ["hora inválida", doc({ hours: Array.from({ length: 7 }, () => ({ open: true, from: "25:99", to: "18:00" })) })],
    ["más de 5 WhatsApp extra", doc({ extraWhatsapps: Array.from({ length: 6 }, () => ({ number: "1", role: "ventas" })) })],
  ];
  for (const [name, body] of bad) {
    it(`rechaza: ${name}`, async () => {
      const res = await put(cookieA, null, body);
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("invalid_content");
      expect(await count("businesses")).toBe(0);
    });
  }
  it("rechaza un cuerpo sin forma", async () => {
    expect((await app.inject({ method: "PUT", url: "/me/business", payload: { content: doc() }, headers: { cookie: cookieA, origin: ORIGIN } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: "/me/business", payload: "no es json", headers: { cookie: cookieA, origin: ORIGIN, "content-type": "application/json" } })).statusCode).toBe(400);
  });
});

describe("la página pública ve lo que se guardó", () => {
  it("al publicarse muestra el catálogo sincronizado, con stock y opciones", async () => {
    await put(cookieA, null, doc());
    const slug = (await conn.pool.query("select slug from businesses")).rows[0].slug as string;
    expect((await app.inject({ method: "GET", url: `/public/sites/${slug}` })).statusCode).toBe(404); // borrador: no se ve
    await conn.pool.query("update businesses set status = 'published'");
    const site = (await app.inject({ method: "GET", url: `/public/sites/${slug}` })).json();
    expect(site.business.name).toBe("Lupe");
    expect(site.products.map((p: { name: string }) => p.name).sort()).toEqual(["Carne", "Jamón y queso", "Milanesa"]);
    expect(site.products.find((p: { name: string }) => p.name === "Carne").options).toHaveLength(2);

    await put(cookieA, 1, doc({ categories: [{ id: "c", name: "A", products: [product("p3", "Milanesa", { stock: 0 })] }] }));
    const after = (await app.inject({ method: "GET", url: `/public/sites/${slug}` })).json();
    expect(after.products[0].available).toBe(false); // stock 0 = agotado
  });
});

describe("CORS desde el navegador", () => {
  const preflight = (method: string, origin: string) =>
    app.inject({ method: "OPTIONS", url: "/me/business", headers: { origin, "access-control-request-method": method, "access-control-request-headers": "content-type" } });

  it("el sitio puede hacer PUT con cookies (si no, el autoguardado falla en el navegador)", async () => {
    for (const method of ["PUT", "GET", "DELETE"]) {
      const res = await preflight(method, ORIGIN);
      expect(res.statusCode, method).toBe(204);
      expect(res.headers["access-control-allow-origin"]).toBe(ORIGIN);
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
      expect(String(res.headers["access-control-allow-methods"])).toContain(method);
    }
  });
  it("un origen ajeno no recibe permiso", async () => {
    const res = await preflight("PUT", "https://evil.com");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  describe("varias páginas por cuenta (el plan es por página)", () => {
    const withPage = (cookie: string, page: string | null) => ({ cookie, origin: ORIGIN, ...(page ? { "x-business-id": page } : {}) });
    const putPage = (cookie: string, page: string | null, baseVersion: number | null, content: object) =>
      app.inject({ method: "PUT", url: "/me/business", payload: { baseVersion, content }, headers: withPage(cookie, page) });

    it("«new» crea otra página; cada una guarda y se lee por separado; la lista muestra las dos", async () => {
      const first = await put(cookieA, null, doc({ name: "Primera" }));
      expect(first.statusCode).toBe(201);
      const second = await putPage(cookieA, "new", null, doc({ name: "Segunda" }));
      expect(second.statusCode).toBe(201);
      const id1 = first.json().id as string, id2 = second.json().id as string;
      expect(id1).not.toBe(id2);

      const list = (await app.inject({ method: "GET", url: "/me/pages", headers: { cookie: cookieA } })).json();
      expect(list.pages.map((p: { name: string }) => p.name)).toEqual(["Primera", "Segunda"]);
      expect((await app.inject({ method: "GET", url: "/me/business", headers: withPage(cookieA, id2) })).json().content.name).toBe("Segunda");
      expect((await app.inject({ method: "GET", url: "/me/business", headers: withPage(cookieA, id1) })).json().content.name).toBe("Primera");
      // guardar una no toca la otra
      expect((await putPage(cookieA, id2, 1, doc({ name: "Segunda v2" }))).statusCode).toBe(200);
      expect((await app.inject({ method: "GET", url: "/me/business", headers: withPage(cookieA, id1) })).json().content.name).toBe("Primera");
    });

    it("no se puede elegir (ni guardar en) la página de otra persona, y una página borrada no crea una nueva por error", async () => {
      const b = await put(cookieB, null, doc({ name: "De B" }));
      const idB = b.json().id as string;
      await put(cookieA, null, doc({ name: "De A" }));
      expect((await app.inject({ method: "GET", url: "/me/business", headers: withPage(cookieA, idB) })).json().business).toBeNull();
      expect((await putPage(cookieA, idB, 1, doc({ name: "Robo" }))).statusCode).toBe(404);
      expect((await putPage(cookieA, "00000000-0000-4000-8000-000000000000", null, doc())).statusCode).toBe(404);
      expect(await count("businesses")).toBe(2);
    });

    it("hay un tope de páginas por cuenta", async () => {
      await put(cookieA, null, doc());
      for (let i = 0; i < 9; i++) expect((await putPage(cookieA, "new", null, doc({ name: `P${i}` }))).statusCode).toBe(201);
      const over = await putPage(cookieA, "new", null, doc({ name: "Una de más" }));
      expect(over.statusCode).toBe(422);
      expect(over.json().error).toBe("pages_limit");
    });

    it("el plan de cada página es propio: cambiar una no cambia la otra", async () => {
      await put(cookieA, null, doc({ name: "Uno" }));
      const second = await putPage(cookieA, "new", null, doc({ name: "Dos" }));
      await conn.pool.query("insert into plans (id, name, price_monthly, limits) values ('pro','Pro','100','{}') on conflict do nothing");
      await conn.pool.query("update businesses set plan_id = 'pro' where id = $1", [second.json().id]);
      const list = (await app.inject({ method: "GET", url: "/me/pages", headers: { cookie: cookieA } })).json();
      expect(list.pages.map((p: { planId: string }) => p.planId)).toEqual(["gratis", "pro"]);
      const plan2 = (await app.inject({ method: "GET", url: "/me/plan", headers: withPage(cookieA, second.json().id) })).json();
      expect(plan2.current.id).toBe("pro");
    });
  });
});
