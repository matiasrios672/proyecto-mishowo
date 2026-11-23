import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb } from "../db/testdb.js";
import { RESET, makeEnv, type Conn } from "../admin/test-helpers.js";
import * as s from "../db/schema.js";

let conn: Conn;
let env: ReturnType<typeof makeEnv>;
beforeAll(async () => { conn = await setupTestDb("mishowo_test_pixels"); env = makeEnv(conn); });
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query(RESET);
  await conn.db.insert(s.plans).values([
    { id: "gratis", name: "Gratis", priceMonthly: "0", limits: {} },
    { id: "pro", name: "Pro", priceMonthly: "100", limits: { modules: { pixels: true } } },
  ]);
});

const doc = (over: object = {}) => ({
  industryId: "rotiseria", name: "Lupe", nameIsExample: false, tagline: "Casera", description: "Empanadas", textsAreExample: false,
  whatsapp: "11 5555-0000", instagram: "@lupe", address: "", deliveryZone: "Villa Crespo", extraWhatsapps: [],
  hours: Array.from({ length: 7 }, (_, i) => ({ open: i < 6, from: "09:00", to: "18:00" })),
  announcement: "", whatsappGreeting: "Hola!", showQuantities: true, ordersEnabled: true, askEventDate: false,
  design: { layout: "vidriera", theme: "terracota", fontPair: "calida", brandColor: null, buttonShape: "redondeado" },
  categories: [{ id: "c1", name: "Empanadas", products: [{ id: "p1", name: "Carne", description: "", price: 1800, comparePrice: null, available: true, stock: null, isExample: false, options: [] }] }],
  ...over,
});

describe("medición de campañas (módulo del plan)", () => {
  it("guarda solo IDs con formato válido: nunca texto libre que termine dentro de un script", async () => {
    const owner = await env.account("dueno@test.com");
    const put = (content: object) => env.call("PUT", "/me/business", owner.cookie, { baseVersion: null, content });
    expect((await put(doc({ metaPixelId: "123456789012345", gaId: "G-AB12CD34EF" }))).statusCode).toBe(201);
    for (const bad of [{ metaPixelId: "12" }, { metaPixelId: "');alert(1);//" }, { gaId: "UA-123" }, { gaId: "G-</script>" }, { gaId: "g-ab12cd34ef" }])
      expect((await put(doc(bad))).statusCode, JSON.stringify(bad)).toBe(400);
    const back = (await env.call("GET", "/me/business", owner.cookie)).json();
    expect(back.content).toMatchObject({ metaPixelId: "123456789012345", gaId: "G-AB12CD34EF" });
  });

  it("la página pública solo expone los IDs si el plan incluye el módulo", async () => {
    const free = await env.account("gratis@test.com"); const pro = await env.account("pro@test.com");
    const settings = { metaPixelId: "123456789012345", gaId: "G-AB12CD34EF", announcement: "Hola" };
    await conn.db.insert(s.businesses).values([
      { slug: "libre", ownerId: free.id, name: "Libre", status: "published", planId: "gratis", settings },
      { slug: "conpixel", ownerId: pro.id, name: "Con pixel", status: "published", planId: "pro", settings },
    ]);
    const a = (await env.app.inject({ method: "GET", url: "/public/sites/libre" })).json();
    expect(a.modules.pixels).toBe(false);
    expect(a.business.settings).toEqual({ announcement: "Hola" }); // sin los IDs, pero el resto de los ajustes sigue
    const b = (await env.app.inject({ method: "GET", url: "/public/sites/conpixel" })).json();
    expect(b.modules.pixels).toBe(true);
    expect(b.business.settings).toMatchObject({ metaPixelId: "123456789012345", gaId: "G-AB12CD34EF" });
  });
});
