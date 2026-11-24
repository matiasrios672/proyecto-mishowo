import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { setupTestDb } from "../db/testdb.js";
import { createMemoryMailer } from "../lib/mailer.js";
import type { StorageProvider } from "../storage/index.js";
import * as s from "../db/schema.js";

const ORIGIN = "http://localhost:3000";
let conn: Awaited<ReturnType<typeof setupTestDb>>;
let app: ReturnType<typeof buildApp>;
const mailer = createMemoryMailer();
const files = new Map<string, Buffer>();
const storage: StorageProvider = {
  put: async (k, d) => void files.set(k, d),
  get: async (k) => files.get(k) ?? null,
  delete: async (k) => void files.delete(k),
};
let cookieA: string, cookieB: string, bizA: string;

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(64, 2)]);

function multipartBody(data: Buffer, filename: string, contentType: string) {
  const boundary = "----mishowoTest" + Math.random().toString(16).slice(2);
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { body, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

const call = (method: "GET" | "POST", url: string, cookie?: string, payload?: object, origin: string | null = ORIGIN) =>
  app.inject({ method, url, payload, headers: { ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) } });
const upload = (id: string, cookie: string, data: Buffer, filename = "comprobante.png", type = "image/png") => {
  const m = multipartBody(data, filename, type);
  return app.inject({ method: "POST", url: `/me/payments/${id}/receipt`, payload: m.body, headers: { ...m.headers, cookie, origin: ORIGIN } });
};
const pay = async (cookie: string, over: object = {}) => (await call("POST", "/me/payments", cookie, { planId: "emprende", months: 3, ...over }));

async function signup(email: string) {
  const res = await app.inject({ method: "POST", url: "/auth/register", headers: { origin: ORIGIN }, payload: { email, password: "claveSegura123", name: "Test", lastName: "Persona", phone: "11 5555-0000" } });
  return { cookie: `ms_session=${res.cookies.find((x) => x.name === "ms_session")!.value}`, id: res.json().user.id as string };
}

beforeAll(async () => {
  conn = await setupTestDb("mishowo_test_billing");
  app = buildApp(loadConfig({ NODE_ENV: "test", AUTH_PER_MINUTE: "10000", PAYMENTS_PER_MINUTE: "10000" }), conn.check, conn.db, { mailer, storage });
});
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query("truncate table payments, plans, order_items, orders, product_options, products, categories, businesses, auth_tokens, sessions, users, app_settings restart identity cascade");
  await conn.db.insert(s.plans).values([
    { id: "gratis", name: "Gratis", priceMonthly: "0", limits: { products: 15 } },
    { id: "emprende", name: "Emprende", priceMonthly: "9900", limits: { products: null }, features: ["Panel de pedidos"] },
    { id: "pro", name: "Pro", priceMonthly: "19900.50" },
    { id: "viejo", name: "Viejo", priceMonthly: "5000", active: false },
  ]);
  files.clear(); mailer.outbox.length = 0;
  const a = await signup("a@test.com"), b = await signup("b@test.com");
  cookieA = a.cookie; cookieB = b.cookie;
  const [ba] = await conn.db.insert(s.businesses).values({ slug: "neg-a", ownerId: a.id, name: "A" }).returning();
  await conn.db.insert(s.businesses).values({ slug: "neg-b", ownerId: b.id, name: "B" });
  bizA = ba!.id;
});

describe("acceso", () => {
  it("exige sesión y origen del sitio", async () => {
    expect((await call("GET", "/me/plan")).statusCode).toBe(401);
    expect((await call("POST", "/me/payments", undefined, { planId: "emprende", months: 1 })).statusCode).toBe(401);
    for (const origin of [null, "https://evil.com"]) expect((await call("POST", "/me/payments", cookieA, { planId: "emprende", months: 1 }, origin)).statusCode).toBe(403);
  });
  it("sin negocio: 404", async () => {
    const c = (await signup("sin@test.com")).cookie;
    expect((await call("GET", "/me/plan", c)).json().error).toBe("no_business");
  });
});

describe("GET /me/plan", () => {
  it("muestra el plan actual, los planes activos pagos con su precio y los datos para transferir", async () => {
    await conn.db.insert(s.appSettings).values({ key: "payment", value: { holder: "MiShowo SRL", alias: "mishowo.pagos", cbu: "0000003100000000000001", bank: "Banco X", instructions: "Mandá el comprobante" } });
    const r = (await call("GET", "/me/plan", cookieA)).json();
    expect(r.current).toMatchObject({ id: "gratis", name: "Gratis" });
    expect(r.plans.map((p: { id: string }) => p.id)).toEqual(["gratis", "emprende", "pro"]); // sin el inactivo, de menor a mayor precio
    expect(r.plans.find((p: { id: string }) => p.id === "pro").priceMonthly).toBe(19900.5);
    expect(r.paymentInfo).toMatchObject({ alias: "mishowo.pagos", holder: "MiShowo SRL" });
    expect(r.months).toEqual([1, 3, 6, 12]);
    expect(r.daysLeft).toBeNull();
  });
  it("sin datos de pago cargados devuelve campos vacíos, no falla", async () => {
    expect((await call("GET", "/me/plan", cookieA)).json().paymentInfo).toEqual({ holder: "", alias: "", cbu: "", bank: "", instructions: "" });
  });
  it("cuenta los días que le quedan al plan", async () => {
    await conn.pool.query("update businesses set plan_id = 'emprende', plan_expires_at = now() + interval '10 days 1 hour' where id = $1", [bizA]);
    const r = (await call("GET", "/me/plan", cookieA)).json();
    expect(r.current.id).toBe("emprende");
    expect(r.daysLeft).toBe(11);
  });
});

describe("avisar un pago", () => {
  it("el monto lo calcula el servidor con el precio vigente (se ignora lo que mande el navegador)", async () => {
    const res = await pay(cookieA, { amount: 1, price: 1 });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ planId: "emprende", months: 3, amount: 29700, status: "pendiente", hasReceipt: false });
    expect(Number((await conn.pool.query("select amount from payments")).rows[0].amount)).toBe(29700);
    expect(Number((await pay(cookieA, { planId: "pro", months: 12 })).json().amount)).toBe(238806); // 19900,50 x 12 sin errores de decimales
  });
  it("si cambia el precio en el admin, el próximo aviso usa el nuevo", async () => {
    await conn.pool.query("update plans set price_monthly = 12000 where id = 'emprende'");
    expect((await pay(cookieA, { months: 1 })).json().amount).toBe(12000);
  });
  it("guarda la aclaración, manda un acuse por email y queda en el historial", async () => {
    await pay(cookieA, { months: 1, note: "Transferencia nº 123" });
    const mail = mailer.outbox.find((m) => m.subject === "Recibimos tu aviso de pago")!;
    expect(mail.to).toBe("a@test.com");
    expect(mail.text).toContain("Emprende");
    const hist = (await call("GET", "/me/plan", cookieA)).json().payments;
    expect(hist).toHaveLength(1);
    expect(hist[0].note).toBe("Transferencia nº 123");
  });
  it("rechaza planes inválidos, gratis, inactivos, meses raros y cuerpos sin forma", async () => {
    for (const planId of ["gratis", "viejo", "inventado"]) expect((await pay(cookieA, { planId })).statusCode, planId).toBe(422);
    for (const months of [0, 2, 13, -1, 1.5, "3"]) expect((await pay(cookieA, { months })).statusCode, String(months)).toBe(400);
    expect((await call("POST", "/me/payments", cookieA, {})).statusCode).toBe(400);
    expect((await pay(cookieA, { note: "x".repeat(301) })).statusCode).toBe(400);
  });
  it("no deja acumular más de 3 avisos pendientes", async () => {
    for (let i = 0; i < 3; i++) expect((await pay(cookieA)).statusCode).toBe(201);
    const res = await pay(cookieA);
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe("too_many_pending");
    await conn.pool.query("update payments set status = 'rechazado' where id = (select id from payments limit 1)");
    expect((await pay(cookieA)).statusCode).toBe(201); // al resolverse uno, se puede avisar otro
  });
  it("cada negocio ve solo sus pagos", async () => {
    await pay(cookieA);
    expect((await call("GET", "/me/plan", cookieB)).json().payments).toEqual([]);
  });
});

describe("comprobante", () => {
  it("acepta una imagen o un PDF reales y los guarda", async () => {
    const id = (await pay(cookieA)).json().id;
    expect((await upload(id, cookieA, PNG)).statusCode).toBe(200);
    expect([...files.keys()]).toHaveLength(1);
    expect([...files.keys()][0]).toMatch(new RegExp(`^receipts/${id}-[0-9a-f]{12}\\.png$`));
    expect((await upload(id, cookieA, PDF, "recibo.pdf", "application/pdf")).statusCode).toBe(200);
    expect([...files.keys()]).toHaveLength(1); // el nuevo reemplaza al anterior y el viejo se borra
    expect([...files.keys()][0]).toMatch(/\.pdf$/);
    expect((await call("GET", "/me/plan", cookieA)).json().payments[0].hasReceipt).toBe(true);
  });
  it("rechaza archivos que no son lo que dicen ser, sin importar el nombre ni el tipo declarado", async () => {
    const id = (await pay(cookieA)).json().id;
    const cases: [string, Buffer, string, string][] = [
      ["ejecutable disfrazado de imagen", Buffer.concat([Buffer.from("MZ"), Buffer.alloc(80)]), "foto.png", "image/png"],
      ["script disfrazado de PDF", Buffer.from("<script>alert(1)</script>".padEnd(60, " ")), "recibo.pdf", "application/pdf"],
      ["HTML", Buffer.from("<html><body>hola</body></html>".padEnd(60, " ")), "pagina.html", "text/html"],
      ["SVG con script", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "logo.svg", "image/svg+xml"],
      ["video", Buffer.concat([Buffer.alloc(4), Buffer.from("ftypisom"), Buffer.alloc(40)]), "video.mp4", "video/mp4"],
      ["archivo vacío o muy corto", Buffer.from([1, 2, 3]), "x.png", "image/png"],
    ];
    for (const [name, data, filename, type] of cases) {
      const res = await upload(id, cookieA, data, filename, type);
      expect(res.statusCode, name).toBe(415);
      expect(res.json().error).toBe("unsupported_file");
    }
    expect(files.size).toBe(0);
  });
  it("rechaza archivos de más de 5 MB", async () => {
    const id = (await pay(cookieA)).json().id;
    const big = Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]);
    const res = await upload(id, cookieA, big);
    expect(res.statusCode).toBe(413);
    expect(files.size).toBe(0);
  });
  it("sin archivo: 400", async () => {
    const id = (await pay(cookieA)).json().id;
    const m = multipartBody(Buffer.alloc(0), "x.png", "image/png");
    const res = await app.inject({ method: "POST", url: `/me/payments/${id}/receipt`, payload: Buffer.from(`--x\r\n\r\n--x--\r\n`), headers: { "content-type": "multipart/form-data; boundary=x", cookie: cookieA, origin: ORIGIN } });
    expect([400, 415]).toContain(res.statusCode);
    void m;
  });
  it("no se puede subir al pago de otro negocio ni a un pago ya resuelto", async () => {
    const id = (await pay(cookieA)).json().id;
    expect((await upload(id, cookieB, PNG)).statusCode).toBe(404);
    expect(files.size).toBe(0);
    await conn.pool.query("update payments set status = 'confirmado' where id = $1", [id]);
    expect((await upload(id, cookieA, PNG)).statusCode).toBe(409);
    expect((await upload("no-es-uuid", cookieA, PNG)).statusCode).toBe(404);
  });
  it("solo su dueño puede verlo y se sirve sin riesgo de ejecutar nada", async () => {
    const id = (await pay(cookieA)).json().id;
    await upload(id, cookieA, PNG);
    const res = await call("GET", `/me/payments/${id}/receipt`, cookieA);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toContain("sandbox");
    expect(res.headers["cache-control"]).toContain("no-store");
    expect((await call("GET", `/me/payments/${id}/receipt`, cookieB)).statusCode).toBe(404);
    expect((await call("GET", `/me/payments/${id}/receipt`, undefined)).statusCode).toBe(401);
  });
});
