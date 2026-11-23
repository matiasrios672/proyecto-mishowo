import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb } from "../db/testdb.js";
import { RESET, count, lastAudit, makeEnv, type Conn } from "../admin/test-helpers.js";
import * as s from "../db/schema.js";

let conn: Conn;
let env: ReturnType<typeof makeEnv>;
const UA = "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Safari/604.1";

beforeAll(async () => { conn = await setupTestDb("mishowo_test_adminops"); env = makeEnv(conn, { ORDERS_PER_MINUTE: "10000" }); });
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query(RESET);
  await conn.db.insert(s.plans).values({ id: "gratis", name: "Gratis", priceMonthly: "0" });
  env.mailer.outbox.length = 0; env.notified.length = 0;
});

async function biz(slug = "lupe", email = "dueno@test.com", status = "published") {
  const owner = await env.account(email);
  const [b] = await conn.db.insert(s.businesses).values({ slug, ownerId: owner.id, name: slug, status, publishedAt: new Date() }).returning();
  return { owner, biz: b! };
}
const report = async (businessId: string, over: Partial<typeof s.reports.$inferInsert> = {}) =>
  (await conn.db.insert(s.reports).values({ businessId, reason: "estafa", detail: "me estafaron", ...over }).returning())[0]!;
const status = async (table: string, id: string) => (await conn.pool.query(`select status from ${table} where id = $1`, [id])).rows[0].status as string;

describe("moderación de denuncias", () => {
  it("lista por estado con el negocio denunciado y contadores", async () => {
    const adm = await env.admin("a@test.com", "admin");
    const { biz: b } = await biz();
    await report(b.id, { detail: "uno" });
    await report(b.id, { status: "revisado" });
    const r = (await env.call("GET", "/admin/reports", adm.cookie)).json();
    expect(r.reports).toHaveLength(1);
    expect(r.reports[0]).toMatchObject({ reason: "estafa", detail: "uno", business: { slug: "lupe", status: "published" } });
    expect(r.counts).toEqual({ nuevo: 1, revisado: 1, accion_tomada: 0 });
    expect((await env.call("GET", "/admin/reports?status=todas", adm.cookie)).json().reports).toHaveLength(2);
    expect((await env.call("GET", "/admin/reports?status=raro", adm.cookie)).statusCode).toBe(400);
  });

  it("descartar marca revisada y audita con antes/después y la nota", async () => {
    const adm = await env.admin("a@test.com", "admin");
    const { biz: b } = await biz();
    const rep = await report(b.id);
    expect((await env.call("POST", `/admin/reports/${rep.id}/resolve`, adm.cookie, { action: "dismiss", note: "Sin fundamento" })).statusCode).toBe(200);
    expect(await status("reports", rep.id)).toBe("revisado");
    expect(await status("businesses", b.id)).toBe("published");
    expect(await lastAudit(conn, "report.dismiss")).toMatchObject({ actor_id: adm.id, entity_id: rep.id, before: { status: "nuevo" }, after: { status: "revisado", note: "Sin fundamento" } });
    const hist = (await env.call("GET", "/admin/reports?status=revisado", adm.cookie)).json().reports[0].history;
    expect(hist[0]).toMatchObject({ action: "report.dismiss", note: "Sin fundamento", by: "a@test.com" });
  });

  it("despublicar y suspender cambian el negocio, resuelven las demás denuncias abiertas y refrescan la página", async () => {
    const adm = await env.admin("a@test.com", "owner");
    const one = await biz("uno", "u1@test.com");
    const two = await biz("dos", "u2@test.com");
    const r1 = await report(one.biz.id), r1b = await report(one.biz.id), r2 = await report(two.biz.id);
    expect((await env.call("POST", `/admin/reports/${r1.id}/resolve`, adm.cookie, { action: "unpublish" })).statusCode).toBe(200);
    expect(await status("businesses", one.biz.id)).toBe("draft");
    expect(await status("reports", r1b.id)).toBe("accion_tomada");
    expect(env.notified).toContain("uno");
    expect((await env.call("POST", `/admin/reports/${r2.id}/resolve`, adm.cookie, { action: "suspend", note: "Estafa confirmada" })).statusCode).toBe(200);
    expect(await status("businesses", two.biz.id)).toBe("suspended");
    expect(await lastAudit(conn, "business.suspend")).toMatchObject({ entity_id: two.biz.id, before: { status: "published" } });
    expect((await lastAudit(conn, "report.suspend")).after).toMatchObject({ status: "accion_tomada", note: "Estafa confirmada" });
  });

  it("si la acción no se puede aplicar, la denuncia NO queda marcada (nada a medias)", async () => {
    const adm = await env.admin("a@test.com", "admin");
    const { biz: b } = await biz("borrador", "x@test.com", "draft");
    const rep = await report(b.id);
    const res = await env.call("POST", `/admin/reports/${rep.id}/resolve`, adm.cookie, { action: "unpublish" });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("not_published");
    expect(await status("reports", rep.id)).toBe("nuevo");
    expect(await count(conn, "audit_log", "action like 'report.%'")).toBe(0);
  });

  it("dos admins resolviendo la misma denuncia a la vez: gana uno solo", async () => {
    const a = await env.admin("a@test.com", "admin");
    const b2 = await env.admin("b@test.com", "owner");
    const { biz: b } = await biz();
    const rep = await report(b.id);
    const res = await Promise.all([
      env.call("POST", `/admin/reports/${rep.id}/resolve`, a.cookie, { action: "suspend" }),
      env.call("POST", `/admin/reports/${rep.id}/resolve`, b2.cookie, { action: "dismiss" }),
    ]);
    expect(res.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(await count(conn, "audit_log", `entity = 'report' and entity_id = '${rep.id}'`)).toBe(1);
  });

  it("Soporte solo mira y deja notas: no puede descartar, despublicar ni suspender", async () => {
    const sup = await env.admin("s@test.com", "support");
    const { biz: b } = await biz();
    const rep = await report(b.id);
    expect((await env.call("GET", "/admin/reports", sup.cookie)).statusCode).toBe(200);
    for (const action of ["dismiss", "unpublish", "suspend"]) {
      const r = await env.call("POST", `/admin/reports/${rep.id}/resolve`, sup.cookie, { action });
      expect(r.statusCode, action).toBe(403);
    }
    expect(await status("reports", rep.id)).toBe("nuevo");
    expect(await status("businesses", b.id)).toBe("published");
    expect((await env.call("POST", `/admin/reports/${rep.id}/resolve`, sup.cookie, { action: "note" })).statusCode).toBe(400); // la nota no puede ir vacía
    expect((await env.call("POST", `/admin/reports/${rep.id}/resolve`, sup.cookie, { action: "note", note: "Pedir más datos" })).statusCode).toBe(200);
    expect(await status("reports", rep.id)).toBe("nuevo"); // la nota no resuelve
    expect((await lastAudit(conn, "report.note")).after).toEqual({ note: "Pedir más datos" });
  });

  it("exige 2FA y un usuario común no accede", async () => {
    const { owner, biz: b } = await biz();
    const rep = await report(b.id);
    expect((await env.call("GET", "/admin/reports", owner.cookie)).statusCode).toBe(403);
    const adm = await env.admin("a@test.com", "admin");
    const fresh = await env.login("a@test.com"); // sesión nueva, sin segundo factor
    expect((await env.call("GET", "/admin/reports", fresh)).json().error).toBe("admin_2fa_required");
    expect((await env.call("POST", `/admin/reports/${rep.id}/resolve`, fresh, { action: "dismiss" })).statusCode).toBe(401);
    expect((await env.call("POST", `/admin/reports/${rep.id}/resolve`, adm.cookie, { action: "dismiss" }, "http://evil.example")).statusCode).toBe(403);
    expect((await env.call("POST", "/admin/reports/no-uuid/resolve", adm.cookie, { action: "dismiss" })).statusCode).toBe(400);
  });
});

describe("modo mantenimiento", () => {
  const register = (email: string) => env.app.inject({ method: "POST", url: "/auth/register", headers: { origin: "http://localhost:3000" }, payload: { email, password: "claveSegura123" } });
  const order = (slug: string) => env.app.inject({ method: "POST", url: "/public/orders", headers: { "user-agent": UA }, payload: { slug, customerName: "Ana", customerPhone: "1155550000", items: [] } });

  it("encendido: bloquea registros y pedidos nuevos con 503 y mensaje; apagado: vuelve a andar", async () => {
    const adm = await env.admin("a@test.com", "owner");
    await biz();
    expect((await register("antes@test.com")).statusCode).toBe(201);
    const on = await env.call("PUT", "/admin/system/maintenance", adm.cookie, { enabled: true, message: "Migrando la base, volvemos en 10 minutos" });
    expect(on.statusCode).toBe(200);
    const blocked = await register("durante@test.com");
    expect(blocked.statusCode).toBe(503);
    expect(blocked.json()).toEqual({ error: "maintenance", message: "Migrando la base, volvemos en 10 minutos" });
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect(await count(conn, "users", "email = 'durante@test.com'")).toBe(0);
    const o = await order("lupe");
    expect(o.statusCode).toBe(503);
    expect(o.json().error).toBe("maintenance");
    expect((await lastAudit(conn, "settings.maintenance")).after).toMatchObject({ enabled: true });
    await env.call("PUT", "/admin/system/maintenance", adm.cookie, { enabled: false });
    expect((await register("despues@test.com")).statusCode).toBe(201);
  });

  it("en mantenimiento siguen andando el login, el panel, el admin y las páginas públicas", async () => {
    const adm = await env.admin("a@test.com", "owner");
    const { owner } = await biz();
    await env.call("PUT", "/admin/system/maintenance", adm.cookie, { enabled: true, message: "" });
    expect((await env.app.inject({ method: "POST", url: "/auth/login", headers: { origin: "http://localhost:3000" }, payload: { email: "dueno@test.com", password: "claveSegura123" } })).statusCode).toBe(200);
    expect((await env.call("GET", "/me/business", owner.cookie)).statusCode).toBe(200);
    expect((await env.call("GET", "/admin/dashboard", adm.cookie)).statusCode).toBe(200);
    expect((await env.app.inject({ method: "GET", url: "/public/sites/lupe" })).statusCode).toBe(200);
    const pub = (await env.app.inject({ method: "GET", url: "/public/site-config" })).json();
    expect(pub.maintenance.message).toContain("Volvé a intentar"); // mensaje por defecto cuando no se escribe uno
  });

  it("solo Owner/Admin lo encienden; Soporte no, y se valida el cuerpo", async () => {
    const sup = await env.admin("s@test.com", "support");
    const adm = await env.admin("a@test.com", "admin");
    expect((await env.call("PUT", "/admin/system/maintenance", sup.cookie, { enabled: true })).statusCode).toBe(403);
    expect((await register("sigue@test.com")).statusCode).toBe(201);
    expect((await env.call("PUT", "/admin/system/maintenance", adm.cookie, { enabled: "si" })).statusCode).toBe(400);
    expect((await env.call("PUT", "/admin/system/maintenance", adm.cookie, { enabled: true, message: "x".repeat(201) })).statusCode).toBe(400);
  });
});

describe("estado del sistema", () => {
  it("informa DB, latencia, uploads, versión y mantenimiento (solo lectura para todo el equipo)", async () => {
    const sup = await env.admin("s@test.com", "support");
    const r = (await env.call("GET", "/admin/system", sup.cookie)).json();
    expect(r.db.ok).toBe(true);
    expect(r.db.latencyMs).toBeGreaterThanOrEqual(0);
    expect(r.version).toMatch(/\d/);
    expect(r.uploads).toMatchObject({ bytes: expect.any(Number), files: expect.any(Number) });
    expect(r.maintenance).toEqual({ enabled: false, message: "" });
    expect(r.cron.lastRun).toBeNull();
    expect(JSON.stringify(r)).not.toMatch(/DATABASE_URL|SECRET|password/i);
    expect((await env.call("GET", "/admin/system")).statusCode).toBe(401);
  });
  it("muestra la última corrida del cron si hay registro", async () => {
    const adm = await env.admin("a@test.com", "admin");
    await conn.db.insert(s.appSettings).values({ key: "cron_last_run", value: { task: "all", at: "2026-11-20T03:00:00.000Z" } });
    expect((await env.call("GET", "/admin/system", adm.cookie)).json().cron.lastRun).toBe("2026-11-20T03:00:00.000Z");
  });
});

describe("slugs reservados", () => {
  it("el owner reserva slugs, se aplican a nuevos links (chequeo y publicación) y queda auditado", async () => {
    const adm = await env.admin("a@test.com", "admin");
    await biz("existente", "e@test.com");
    const u = await env.account("nuevo@test.com");
    await conn.db.insert(s.businesses).values({ slug: "borrador-nuevo", ownerId: u.id, name: "N", status: "draft" });
    const put = await env.call("PUT", "/admin/settings/reserved-slugs", adm.cookie, { slugs: ["Banco-Nacion", "existente", "banco-nacion"] });
    expect(put.json()).toEqual({ slugs: ["banco-nacion", "existente"], inUse: ["existente"] });
    expect((await lastAudit(conn, "settings.reserved_slugs")).after).toEqual({ slugs: ["banco-nacion", "existente"] });
    const chk = (await env.call("GET", "/me/slug?slug=banco-nacion", u.cookie)).json();
    expect(chk).toEqual({ available: false, reason: "reservado" });
    expect((await env.call("GET", "/me/slug?slug=libre-123", u.cookie)).json().available).toBe(true);
  });
  it("valida el formato y la lista fija sigue vigente", async () => {
    const adm = await env.admin("a@test.com", "admin");
    for (const slugs of [["con espacio"], ["-malo"], ["x".repeat(31)], ["ñandú"]]) expect((await env.call("PUT", "/admin/settings/reserved-slugs", adm.cookie, { slugs })).statusCode, JSON.stringify(slugs)).toBe(400);
    const g = (await env.call("GET", "/admin/settings/reserved-slugs", adm.cookie)).json();
    expect(g.builtin).toContain("admin");
    const u = await env.account("u@test.com");
    expect((await env.call("GET", "/me/slug?slug=admin", u.cookie)).json().reason).toBe("reservado");
  });
  it("Soporte puede ver pero no cambiar", async () => {
    const sup = await env.admin("s@test.com", "support");
    expect((await env.call("GET", "/admin/settings/reserved-slugs", sup.cookie)).statusCode).toBe(200);
    expect((await env.call("PUT", "/admin/settings/reserved-slugs", sup.cookie, { slugs: ["x1"] })).statusCode).toBe(403);
  });
});

describe("mini CMS de la landing", () => {
  const faq = [{ q: "¿Hacen envíos?", a: "No, el envío lo coordinás con tu cliente." }];
  it("guarda FAQ y aviso, y la landing los recibe por /public/site-config (sin datos sensibles)", async () => {
    const adm = await env.admin("a@test.com", "admin");
    const empty = (await env.app.inject({ method: "GET", url: "/public/site-config" })).json();
    expect(empty).toEqual({ banner: null, maintenance: null, faq: null }); // sin cargar nada: la landing usa sus valores por defecto
    const put = await env.call("PUT", "/admin/settings/cms", adm.cookie, { faq, banner: { enabled: true, text: "Nuevo: estadísticas gratis", link: "/ayuda" } });
    expect(put.statusCode).toBe(200);
    const pub = (await env.app.inject({ method: "GET", url: "/public/site-config" })).json();
    expect(pub).toEqual({ banner: { text: "Nuevo: estadísticas gratis", link: "/ayuda" }, maintenance: null, faq });
    expect((await lastAudit(conn, "settings.cms")).before).toMatchObject({ faq: [] });
  });
  it("un aviso apagado no se publica, y rechaza links peligrosos, textos largos y aviso vacío", async () => {
    const adm = await env.admin("a@test.com", "admin");
    await env.call("PUT", "/admin/settings/cms", adm.cookie, { faq: [], banner: { enabled: false, text: "oculto", link: "" } });
    expect((await env.app.inject({ method: "GET", url: "/public/site-config" })).json().banner).toBeNull();
    for (const link of ["javascript:alert(1)", "data:text/html,x", "http://inseguro.com", "//evil.com"])
      expect((await env.call("PUT", "/admin/settings/cms", adm.cookie, { faq: [], banner: { enabled: true, text: "hola", link } })).statusCode, link).toBe(400);
    expect((await env.call("PUT", "/admin/settings/cms", adm.cookie, { faq: [], banner: { enabled: true, text: "x".repeat(161), link: "" } })).statusCode).toBe(400);
    expect((await env.call("PUT", "/admin/settings/cms", adm.cookie, { faq: [], banner: { enabled: true, text: "", link: "" } })).statusCode).toBe(422);
    expect((await env.call("PUT", "/admin/settings/cms", adm.cookie, { faq: Array(21).fill(faq[0]), banner: { enabled: false, text: "", link: "" } })).statusCode).toBe(400);
  });
  it("Soporte puede leer pero no editar", async () => {
    const sup = await env.admin("s@test.com", "support");
    expect((await env.call("GET", "/admin/settings/cms", sup.cookie)).statusCode).toBe(200);
    expect((await env.call("PUT", "/admin/settings/cms", sup.cookie, { faq, banner: { enabled: false, text: "", link: "" } })).statusCode).toBe(403);
  });
});

describe("dashboard y ficha de solo lectura", () => {
  it("suma pagos pendientes viejos a las alertas y denuncias abiertas", async () => {
    const adm = await env.admin("a@test.com", "admin");
    const { biz: b } = await biz();
    await conn.db.insert(s.payments).values([
      { businessId: b.id, planId: "gratis", amount: "100", months: 1, createdAt: new Date(Date.now() - 5 * 86_400_000) },
      { businessId: b.id, planId: "gratis", amount: "100", months: 1 },
    ]);
    await report(b.id);
    const a = (await env.call("GET", "/admin/dashboard", adm.cookie)).json().alerts;
    expect(a).toMatchObject({ pendingPayments: 2, stalePayments: 1, newReports: 1 });
  });
  it("Soporte no ve ingresos, pagos ni planes en el resumen; Admin sí", async () => {
    const sup = await env.admin("s2@test.com", "support");
    const adm = await env.admin("a2@test.com", "admin");
    const { biz: b } = await biz();
    await conn.db.insert(s.payments).values({ businessId: b.id, planId: "gratis", amount: "100", months: 1 });
    const forSupport = (await env.call("GET", "/admin/dashboard", sup.cookie)).json();
    expect(forSupport.finance).toBe(false);
    expect(forSupport.alerts).toMatchObject({ pendingPayments: 0, stalePayments: 0, expiring7d: 0 });
    expect(forSupport.kpis).toMatchObject({ mrr: 0, paidActive: 0, conversion: 0 });
    expect(forSupport.byPlan).toEqual([]);
    const forAdmin = (await env.call("GET", "/admin/dashboard", adm.cookie)).json();
    expect(forAdmin.finance).toBe(true);
    expect(forAdmin.alerts.pendingPayments).toBe(1);
  });
  it("la ficha muestra un resumen de la configuración sin credenciales ni sesiones (no existe 'entrar como')", async () => {
    const sup = await env.admin("s@test.com", "support");
    const { biz: b } = await biz();
    const r = (await env.call("GET", `/admin/businesses/${b.id}`, sup.cookie)).json();
    expect(r.view).toMatchObject({ openDays: 0, categories: 0, available_products: 0, media: 0, open_reports: 0, whatsappSet: false });
    expect(JSON.stringify(r)).not.toMatch(/password|hash|totp|secret|token/i);
    for (const url of [`/admin/businesses/${b.id}/impersonate`, `/admin/businesses/${b.id}/login-as`]) expect((await env.call("POST", url, sup.cookie, {})).statusCode).toBe(404);
  });
});
