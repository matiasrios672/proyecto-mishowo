import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb } from "../db/testdb.js";
import { ORIGIN, RESET, makeEnv, type Conn } from "../admin/test-helpers.js";
import * as s from "../db/schema.js";

let conn: Conn;
let env: ReturnType<typeof makeEnv>;

beforeAll(async () => { conn = await setupTestDb("mishowo_test_installments"); env = makeEnv(conn); });
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query(RESET);
  await conn.db.insert(s.plans).values({ id: "gratis", name: "Gratis", priceMonthly: "0" });
});

const doc = (over: object = {}) => ({
  industryId: "rotiseria", name: "Lupe", nameIsExample: false, tagline: "", description: "", textsAreExample: false, whatsapp: "11 5555-0000", instagram: "", address: "", deliveryZone: "",
  extraWhatsapps: [], hours: Array.from({ length: 7 }, () => ({ open: true, from: "09:00", to: "18:00" })), announcement: "", whatsappGreeting: "Hola!", showQuantities: true, askEventDate: false,
  design: { layout: "vidriera", theme: "terracota", fontPair: "calida", brandColor: null, buttonShape: "redondeado" },
  categories: [{ id: "c1", name: "Todo", products: [{ id: "p1", name: "Campera", description: "", price: 60000, comparePrice: null, available: true, stock: null, isExample: false, options: [] }] }], ...over,
});
const put = (cookie: string, baseVersion: number | null, content: object) =>
  env.app.inject({ method: "PUT", url: "/me/business", payload: { baseVersion, content }, headers: { cookie, origin: ORIGIN } });

describe("cuotas sin interés", () => {
  it("un documento sin el campo queda con las cuotas apagadas", async () => {
    const owner = await env.account("dueno@test.com");
    expect((await put(owner.cookie, null, doc())).statusCode).toBe(201);
    expect((await env.call("GET", "/me/business", owner.cookie)).json().content.installments).toEqual({ enabled: false, count: 3, note: "", minAmount: 0 });
  });

  it("se guardan, se leen igual y la página pública las informa", async () => {
    const owner = await env.account("dueno@test.com");
    const installments = { enabled: true, count: 6, note: "Con tarjetas de crédito", minAmount: 20000 };
    expect((await put(owner.cookie, null, doc({ installments }))).statusCode).toBe(201);
    await conn.pool.query("update businesses set status = 'published', slug = 'lupe'");
    expect((await env.call("GET", "/me/business", owner.cookie)).json().content.installments).toEqual(installments);
    const site = (await env.app.inject({ method: "GET", url: "/public/sites/lupe" })).json();
    expect(site.business.settings.installments).toEqual(installments);
  });

  it.each([
    ["1 cuota", { enabled: true, count: 1, note: "", minAmount: 0 }],
    ["25 cuotas", { enabled: true, count: 25, note: "", minAmount: 0 }],
    ["cuotas decimales", { enabled: true, count: 2.5, note: "", minAmount: 0 }],
    ["aclaración larguísima", { enabled: true, count: 3, note: "x".repeat(81), minAmount: 0 }],
    ["mínimo negativo", { enabled: true, count: 3, note: "", minAmount: -1 }],
  ])("rechaza %s", async (_n, installments) => {
    const owner = await env.account("dueno@test.com");
    expect((await put(owner.cookie, null, doc({ installments }))).statusCode).toBe(400);
  });
});
