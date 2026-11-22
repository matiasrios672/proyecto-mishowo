import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb } from "../db/testdb.js";
import { decryptSecret } from "../lib/crypto.js";
import { totp } from "../auth/totp.js";
import { ADMIN_KEY, RESET, count, lastAudit, makeEnv, type Conn } from "../admin/test-helpers.js";
import * as s from "../db/schema.js";

let conn: Conn;
let env: ReturnType<typeof makeEnv>;
beforeAll(async () => { conn = await setupTestDb("mishowo_test_admin"); env = makeEnv(conn); });
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query(RESET);
  await conn.db.insert(s.plans).values([{ id: "gratis", name: "Gratis", priceMonthly: "0", limits: { products: 15 } }, { id: "emprende", name: "Emprende", priceMonthly: "9900" }]);
  env.mailer.outbox.length = 0; env.notified.length = 0;
});

const biz = async (ownerId: string, over: Partial<typeof s.businesses.$inferInsert> = {}) =>
  (await conn.db.insert(s.businesses).values({ slug: `neg-${Math.random().toString(16).slice(2, 8)}`, ownerId, name: "Negocio", ...over }).returning())[0]!;

describe("acceso al admin", () => {
  it("sin sesión 401; un usuario común 403; los pedidos de otro origen se rechazan", async () => {
    const { call, account } = env;
    expect((await call("GET", "/admin/dashboard")).statusCode).toBe(401);
    const u = await account("user@test.com");
    expect((await call("GET", "/admin/dashboard", u.cookie)).statusCode).toBe(403);
    expect((await call("GET", "/admin/me", u.cookie)).statusCode).toBe(403);
    const a = await env.admin("admin@test.com");
    for (const origin of [null, "https://evil.com", "http://negocio.localhost:3000"]) expect((await call("POST", "/admin/users/00000000-0000-4000-8000-000000000000/block", a.cookie, {}, origin)).statusCode, String(origin)).toBe(403);
  });
  it("un admin sin 2FA configurado no entra a nada, pero puede ver su estado para configurarlo", async () => {
    const a = await env.account("sin2fa@test.com", "admin");
    const me = await env.call("GET", "/admin/me", a.cookie);
    expect(me.json()).toMatchObject({ user: { email: "sin2fa@test.com", role: "admin" }, totpEnabled: false, verified: false });
    const res = await env.call("GET", "/admin/dashboard", a.cookie);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "admin_2fa_required", totpEnabled: false });
  });
  it("la sesión de administración dura menos que la de un usuario común", async () => {
    await env.account("adm@test.com", "admin");
    const cookie = await env.login("adm@test.com");
    const row = (await conn.pool.query("select expires_at - created_at as dur from sessions order by created_at desc limit 1")).rows[0];
    const hours = row.dur.hours + (row.dur.days ?? 0) * 24;
    expect(hours).toBeLessThanOrEqual(12);
    expect(cookie).toMatch(/^ms_session=/);
  });
  it("con IP permitida configurada, desde otra IP se bloquea incluso con credenciales y 2FA correctos", async () => {
    const restricted = makeEnv(conn, { ADMIN_ALLOWED_IPS: "10.0.0.1, 10.0.0.2" });
    const a = await restricted.admin("ip@test.com", "admin", "10.0.0.1");
    expect((await restricted.call("GET", "/admin/dashboard", a.cookie, undefined, undefined, "10.0.0.1")).statusCode).toBe(200);
    const blocked = await restricted.call("GET", "/admin/dashboard", a.cookie, undefined, undefined, "203.0.113.9");
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error).toBe("ip_not_allowed");
    expect((await restricted.call("GET", "/admin/me", a.cookie, undefined, undefined, "203.0.113.9")).statusCode).toBe(403);
  });
});

describe("2FA", () => {
  it("configurar: el secreto se guarda cifrado y nunca en claro", async () => {
    const a = await env.account("a@test.com", "admin");
    const res = await env.call("POST", "/admin/2fa/setup", a.cookie, {});
    expect(res.statusCode).toBe(200);
    const { secret, otpauthUrl } = res.json();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(otpauthUrl).toContain("otpauth://totp/MiShowo:");
    const stored = (await conn.pool.query("select totp_secret from users where id = $1", [a.id])).rows[0].totp_secret as string;
    expect(stored).not.toContain(secret);
    expect(decryptSecret(stored, ADMIN_KEY)).toBe(secret);
  });
  it("activar: con un código incorrecto no se activa; con el correcto sí, deja la sesión verificada y queda auditado", async () => {
    const a = await env.account("a@test.com", "admin");
    const { secret } = (await env.call("POST", "/admin/2fa/setup", a.cookie, {})).json();
    expect((await env.call("POST", "/admin/2fa/enable", a.cookie, { code: "000000" })).statusCode).toBe(401);
    expect((await env.call("POST", "/admin/2fa/enable", a.cookie, { code: "abc" })).statusCode).toBe(400);
    expect((await conn.pool.query("select totp_enabled_at from users where id = $1", [a.id])).rows[0].totp_enabled_at).toBeNull();
    expect((await env.call("POST", "/admin/2fa/enable", a.cookie, { code: totp(secret) })).statusCode).toBe(200);
    expect((await env.call("GET", "/admin/dashboard", a.cookie)).statusCode).toBe(200);
    expect((await lastAudit(conn, "admin.2fa_enabled")).actor_id).toBe(a.id);
  });
  it("una vez activo no se puede volver a configurar (nadie pisa el secreto con una sesión robada)", async () => {
    const a = await env.admin("a@test.com");
    expect((await env.call("POST", "/admin/2fa/setup", a.cookie, {})).statusCode).toBe(409);
    expect((await env.call("POST", "/admin/2fa/enable", a.cookie, { code: totp(a.secret) })).statusCode).toBe(409);
  });
  it("activar sin haber pedido el secreto: 409", async () => {
    const a = await env.account("a@test.com", "admin");
    expect((await env.call("POST", "/admin/2fa/enable", a.cookie, { code: "123456" })).statusCode).toBe(409);
  });
  it("sin la clave de cifrado del servidor no se puede activar el 2FA (el admin no queda a medio configurar)", async () => {
    const noKey = makeEnv(conn, { ADMIN_SECRET_KEY: "" });
    const a = await noKey.account("nokey@test.com", "admin");
    expect((await noKey.call("POST", "/admin/2fa/setup", a.cookie, {})).statusCode).toBe(503);
  });
  it("una sesión nueva llega sin verificar y entra recién con el código", async () => {
    const a = await env.admin("a@test.com");
    const cookie = await env.login("a@test.com");
    expect((await env.call("GET", "/admin/dashboard", cookie)).json()).toEqual({ error: "admin_2fa_required", totpEnabled: true });
    expect((await env.call("GET", "/admin/me", cookie)).json().verified).toBe(false);
    const bad = await env.call("POST", "/admin/2fa/verify", cookie, { code: "000000" });
    expect(bad.statusCode).toBe(401);
    expect((await lastAudit(conn, "admin.2fa_failed")).actor_id).toBe(a.id); // el intento fallido queda registrado
    expect((await env.call("GET", "/admin/dashboard", cookie)).statusCode).toBe(401);
    expect((await env.call("POST", "/admin/2fa/verify", cookie, { code: totp(a.secret) })).statusCode).toBe(200);
    expect((await env.call("GET", "/admin/dashboard", cookie)).statusCode).toBe(200);
    expect((await lastAudit(conn, "admin.login")).actor_id).toBe(a.id);
  });
  it("verificar sin tener 2FA configurado: 409", async () => {
    const a = await env.account("a@test.com", "admin");
    expect((await env.call("POST", "/admin/2fa/verify", a.cookie, { code: "123456" })).statusCode).toBe(409);
  });
  it("la verificación vence: pasadas las horas configuradas hay que ingresar el código de nuevo", async () => {
    const a = await env.admin("a@test.com");
    expect((await env.call("GET", "/admin/dashboard", a.cookie)).statusCode).toBe(200);
    await conn.pool.query("update sessions set admin_verified_at = now() - interval '9 hours' where user_id = $1", [a.id]);
    expect((await env.call("GET", "/admin/dashboard", a.cookie)).json().error).toBe("admin_2fa_required");
  });
  it("límite de intentos: frena la fuerza bruta aunque después llegue el código correcto", async () => {
    const strict = makeEnv(conn, { ADMIN_2FA_PER_MINUTE: "3" });
    const a = await strict.admin("brute@test.com");
    const cookie = await strict.login("brute@test.com");
    const codes: number[] = [];
    for (let i = 0; i < 3; i++) codes.push((await strict.call("POST", "/admin/2fa/verify", cookie, { code: "000000" })).statusCode);
    expect(codes).toEqual([401, 401, 401]);
    const right = await strict.call("POST", "/admin/2fa/verify", cookie, { code: totp(a.secret) });
    expect(right.statusCode).toBe(429);
  });
  it("un código de otro admin no sirve", async () => {
    const a = await env.admin("a@test.com");
    const b = await env.admin("b@test.com");
    expect(a.secret).not.toBe(b.secret);
    const cookie = await env.login("a@test.com");
    expect((await env.call("POST", "/admin/2fa/verify", cookie, { code: totp(b.secret) })).statusCode).toBe(401);
  });
});

describe("roles", () => {
  it("Soporte mira y deja notas, pero no toca planes, pagos ni moderación", async () => {
    const owner = await env.admin("o@test.com", "owner");
    const sup = await env.admin("s@test.com", "support");
    const b = await biz(owner.id, { status: "published" });
    for (const url of ["/admin/dashboard", "/admin/businesses", "/admin/users", `/admin/businesses/${b.id}`]) expect((await env.call("GET", url, sup.cookie)).statusCode, url).toBe(200);
    expect((await env.call("PUT", `/admin/businesses/${b.id}/note`, sup.cookie, { note: "Cliente VIP" })).statusCode).toBe(200);
    for (const [method, url, body] of [
      ["POST", `/admin/businesses/${b.id}/suspend`, {}], ["POST", `/admin/businesses/${b.id}/unpublish`, {}], ["DELETE", `/admin/businesses/${b.id}`, undefined],
      ["POST", `/admin/businesses/${b.id}/plan`, { planId: "emprende", days: 5 }], ["POST", `/admin/users/${owner.id}/block`, {}],
      ["GET", "/admin/payments", undefined], ["GET", "/admin/plans", undefined], ["GET", "/admin/audit", undefined], ["GET", "/admin/settings/payment", undefined], ["GET", "/admin/admins", undefined],
    ] as const) {
      const res = await env.call(method, url, sup.cookie, body);
      expect(res.statusCode, `${method} ${url}`).toBe(403);
      expect(res.json().error).toBe("forbidden_role");
    }
    expect((await conn.pool.query("select status from businesses where id = $1", [b.id])).rows[0].status).toBe("published");
  });
  it("Admin gestiona negocios, pagos y planes, pero no los ajustes críticos ni a otros admins (solo Owner)", async () => {
    const adm = await env.admin("a@test.com", "admin");
    for (const url of ["/admin/payments", "/admin/plans", "/admin/audit"]) expect((await env.call("GET", url, adm.cookie)).statusCode, url).toBe(200);
    for (const [method, url, body] of [["GET", "/admin/settings/payment", undefined], ["PUT", "/admin/settings/payment", { alias: "x" }], ["GET", "/admin/admins", undefined], ["POST", "/admin/admins", { email: "x@test.com", role: "admin" }]] as const)
      expect((await env.call(method, url, adm.cookie, body)).statusCode, `${method} ${url}`).toBe(403);
    const owner = await env.admin("o@test.com", "owner");
    expect((await env.call("GET", "/admin/settings/payment", owner.cookie)).statusCode).toBe(200);
    expect((await env.call("GET", "/admin/admins", owner.cookie)).statusCode).toBe(200);
  });
});

describe("auditoría", () => {
  it("el registro es de solo lectura: la base impide modificar o borrar", async () => {
    const o = await env.admin("o@test.com", "owner");
    const row = await lastAudit(conn, "admin.2fa_enabled");
    await expect(conn.pool.query("update audit_log set action = 'borrado' where id = $1", [row.id])).rejects.toThrow(/solo lectura/);
    await expect(conn.pool.query("delete from audit_log where id = $1", [row.id])).rejects.toThrow(/solo lectura/);
    await expect(conn.pool.query("delete from audit_log")).rejects.toThrow(/solo lectura/);
    expect(await count(conn, "audit_log", `id = ${row.id}`)).toBe(1);
    void o;
  });
  it("cada acción queda con quién, qué, antes y después, y desde qué IP", async () => {
    const adm = await env.admin("a@test.com", "admin");
    const owner = await env.account("dueno@test.com");
    const b = await biz(owner.id, { status: "published", publishedAt: new Date() });
    expect((await env.call("POST", `/admin/businesses/${b.id}/suspend`, adm.cookie, {})).statusCode).toBe(200);
    const a = await lastAudit(conn, "business.suspend");
    expect(a).toMatchObject({ actor_id: adm.id, entity: "business", entity_id: b.id });
    expect(a.before).toEqual({ status: "published" });
    expect(a.after).toEqual({ status: "suspended" });
    expect(a.ip).toBeTruthy();
  });
  it("se consulta del más nuevo al más viejo, con el email de quien actuó, y se puede filtrar", async () => {
    const adm = await env.admin("a@test.com", "admin");
    const owner = await env.account("dueno@test.com");
    const b = await biz(owner.id);
    await env.call("POST", `/admin/businesses/${b.id}/suspend`, adm.cookie, {});
    await env.call("POST", `/admin/businesses/${b.id}/reactivate`, adm.cookie, {});
    const all = (await env.call("GET", "/admin/audit", adm.cookie)).json();
    expect(all.entries[0]).toMatchObject({ action: "business.reactivate", actor: "a@test.com" });
    const only = (await env.call("GET", `/admin/audit?entity=business&entityId=${b.id}`, adm.cookie)).json();
    expect(only.entries.map((e: { action: string }) => e.action)).toEqual(["business.reactivate", "business.suspend"]);
    expect((await env.call("GET", "/admin/audit?page=0", adm.cookie)).statusCode).toBe(400);
  });
});

describe("dashboard", () => {
  it("calcula KPIs, MRR, distribución y alertas con datos reales", async () => {
    const adm = await env.admin("a@test.com", "owner");
    const u = await env.account("u@test.com");
    const day = 86_400_000;
    const paid = await biz(u.id, { status: "published", planId: "emprende", planExpiresAt: new Date(Date.now() + 3 * day), industry: "ropa" });
    await biz(u.id, { status: "published", industry: "ropa" });
    await biz(u.id, { status: "suspended" });
    await biz(u.id, { status: "draft", createdAt: new Date(Date.now() - 20 * day) });
    await biz(u.id, { status: "published", deletedAt: new Date() }); // borrado: no cuenta
    await conn.db.insert(s.orders).values({ businessId: paid.id, number: 1, total: "100" });
    await conn.db.insert(s.payments).values([{ businessId: paid.id, planId: "emprende", amount: "9900", status: "confirmado" }, { businessId: paid.id, planId: "emprende", amount: "9900", status: "pendiente" }]);
    await conn.db.insert(s.auditLog).values({ actorId: null, action: "plan.expired", entity: "business", entityId: "x" });
    await conn.db.insert(s.reports).values({ businessId: paid.id, reason: "estafa" });

    const d = (await env.call("GET", "/admin/dashboard", adm.cookie)).json();
    expect(d.kpis).toMatchObject({ businesses: 4, published: 2, suspended: 1, newToday: 3, newWeek: 3, newMonth: 4, active7d: 1, paidActive: 1, mrr: 9900, expiring7d: 1, churn30d: 1, conversion: 25 });
    expect(d.byPlan).toEqual(expect.arrayContaining([{ plan: "gratis", count: 3 }, { plan: "emprende", count: 1 }]));
    expect(d.byIndustry.find((i: { industry: string }) => i.industry === "ropa").count).toBe(2);
    expect(d.signups).toHaveLength(30);
    expect(d.signups.reduce((n: number, x: { count: number }) => n + x.count, 0)).toBe(4);
    expect(d.alerts).toMatchObject({ pendingPayments: 1, expiring7d: 1, newReports: 1 });
  });
  it("con la base vacía devuelve ceros, no falla", async () => {
    const adm = await env.admin("a@test.com", "owner");
    const d = (await env.call("GET", "/admin/dashboard", adm.cookie)).json();
    expect(d.kpis).toMatchObject({ businesses: 0, mrr: 0, conversion: 0, active7d: 0 });
    expect(d.alerts.pendingPayments).toBe(0);
  });
});

describe("negocios", () => {
  it("lista con paginación, búsqueda por nombre, link o email del dueño, y filtros; los borrados no aparecen", async () => {
    const adm = await env.admin("a@test.com");
    const a = await env.account("ana@test.com"), b = await env.account("beto@test.com");
    for (let i = 0; i < 30; i++) await biz(i % 2 ? a.id : b.id, { name: `Rotisería ${i}`, slug: `rot-${i}`, status: i < 10 ? "published" : "draft", planId: i < 5 ? "emprende" : "gratis" });
    await biz(a.id, { name: "Borrado", slug: "borrado", deletedAt: new Date() });
    const list = async (qs = "") => (await env.call("GET", `/admin/businesses${qs}`, adm.cookie)).json();
    const p1 = await list(), p2 = await list("?page=2");
    expect([p1.businesses.length, p2.businesses.length, p1.total, p1.pageSize]).toEqual([25, 5, 30, 25]);
    expect(new Set([...p1.businesses, ...p2.businesses].map((x: { id: string }) => x.id)).size).toBe(30); // sin repetir ni saltear
    expect((await list("?q=rot-7")).businesses.map((x: { slug: string }) => x.slug)).toEqual(["rot-7"]);
    expect((await list("?q=Rotisería 12")).total).toBe(1);
    expect((await list("?q=ana@test")).total).toBe(15); // por email del dueño
    expect((await list("?status=published")).total).toBe(10);
    expect((await list("?plan=emprende")).total).toBe(5);
    expect((await list("?q=Borrado")).total).toBe(0);
    expect((await list("?status=inventado")) .error).toBe("invalid_request");
    expect((await list("?page=0")).error).toBe("invalid_request");
  });
  it("la búsqueda no se rompe con comodines ni intentos de inyección", async () => {
    const adm = await env.admin("a@test.com");
    const u = await env.account("u@test.com");
    await biz(u.id, { name: "Normal", slug: "normal" });
    for (const q of ["%", "_", "'; drop table businesses; --", "\\"]) expect((await env.call("GET", `/admin/businesses?q=${encodeURIComponent(q)}`, adm.cookie)).statusCode, q).toBe(200);
    expect(await count(conn, "businesses")).toBe(1);
  });
  it("la ficha trae dueño, conteos, pagos e historial; un id inválido o inexistente da 404", async () => {
    const adm = await env.admin("a@test.com");
    const u = await env.account("dueno@test.com");
    const b = await biz(u.id);
    await conn.db.insert(s.products).values({ businessId: b.id, name: "P" });
    await conn.db.insert(s.payments).values({ businessId: b.id, planId: "emprende", amount: "9900" });
    await env.call("PUT", `/admin/businesses/${b.id}/note`, adm.cookie, { note: "hola" });
    const f = (await env.call("GET", `/admin/businesses/${b.id}`, adm.cookie)).json();
    expect(f.owner.email).toBe("dueno@test.com");
    expect(f.counts).toMatchObject({ products: 1, orders: 0 });
    expect(f.payments).toHaveLength(1);
    expect(f.history[0].action).toBe("business.note");
    expect(JSON.stringify(f)).not.toMatch(/passwordHash|totpSecret/);
    for (const id of ["no-es-uuid", "00000000-0000-4000-8000-000000000000"]) expect((await env.call("GET", `/admin/businesses/${id}`, adm.cookie)).statusCode).toBe(404);
  });
  it("suspender oculta la página (aviso de 'no disponible'), bloquea publicar y avisa al frontend; reactivar la devuelve", async () => {
    const adm = await env.admin("a@test.com");
    const u = await env.account("u@test.com");
    const b = await biz(u.id, { slug: "lupe", status: "published", publishedAt: new Date() });
    expect((await env.call("POST", `/admin/businesses/${b.id}/suspend`, adm.cookie, {})).statusCode).toBe(200);
    expect(env.notified).toContain("lupe");
    expect((await env.app.inject({ method: "GET", url: "/public/sites/lupe" })).json()).toMatchObject({ status: "suspended" });
    expect((await env.call("POST", `/admin/businesses/${b.id}/suspend`, adm.cookie, {})).json().error).toBe("already_suspended");
    expect((await env.call("POST", "/me/business/unpublish", u.cookie, {})).statusCode).toBe(403); // el dueño no puede esquivar la suspensión
    expect((await env.call("POST", `/admin/businesses/${b.id}/reactivate`, adm.cookie, {})).statusCode).toBe(200);
    expect((await conn.pool.query("select status from businesses where id = $1", [b.id])).rows[0].status).toBe("published");
    expect((await env.call("POST", `/admin/businesses/${b.id}/reactivate`, adm.cookie, {})).json().error).toBe("not_suspended");
  });
  it("reactivar un negocio que nunca se publicó lo deja en borrador", async () => {
    const adm = await env.admin("a@test.com");
    const u = await env.account("u@test.com");
    const b = await biz(u.id, { status: "suspended" });
    await env.call("POST", `/admin/businesses/${b.id}/reactivate`, adm.cookie, {});
    expect((await conn.pool.query("select status from businesses where id = $1", [b.id])).rows[0].status).toBe("draft");
  });
  it("despublicar y eliminar (borrado lógico): desaparece de la web y de las listas, pero queda en la base y en la auditoría", async () => {
    const adm = await env.admin("a@test.com");
    const u = await env.account("u@test.com");
    const b = await biz(u.id, { slug: "chau", status: "published" });
    expect((await env.call("POST", `/admin/businesses/${b.id}/unpublish`, adm.cookie, {})).statusCode).toBe(200);
    expect((await env.call("POST", `/admin/businesses/${b.id}/unpublish`, adm.cookie, {})).json().error).toBe("not_published");
    expect((await env.app.inject({ method: "GET", url: "/public/sites/chau" })).statusCode).toBe(404);
    expect((await env.call("DELETE", `/admin/businesses/${b.id}`, adm.cookie)).statusCode).toBe(200);
    expect((await conn.pool.query("select deleted_at from businesses where id = $1", [b.id])).rows[0].deleted_at).not.toBeNull();
    expect((await env.call("GET", "/admin/businesses?q=chau", adm.cookie)).json().total).toBe(0);
    expect((await env.call("DELETE", `/admin/businesses/${b.id}`, adm.cookie)).statusCode).toBe(404); // ya no existe para el admin
    expect((await lastAudit(conn, "business.delete")).entity_id).toBe(b.id);
  });
  it("cambiar el plan a mano: gratis no pide días; uno pago sí, y queda con vencimiento", async () => {
    const adm = await env.admin("a@test.com");
    const u = await env.account("u@test.com");
    const b = await biz(u.id);
    expect((await env.call("POST", `/admin/businesses/${b.id}/plan`, adm.cookie, { planId: "emprende" })).json().error).toBe("days_required");
    expect((await env.call("POST", `/admin/businesses/${b.id}/plan`, adm.cookie, { planId: "inventado", days: 5 })).json().error).toBe("invalid_plan");
    expect((await env.call("POST", `/admin/businesses/${b.id}/plan`, adm.cookie, { planId: "emprende", days: 30 })).statusCode).toBe(200);
    const row = (await conn.pool.query("select plan_id, plan_expires_at from businesses where id = $1", [b.id])).rows[0];
    expect(row.plan_id).toBe("emprende");
    expect(Math.round((new Date(row.plan_expires_at).getTime() - Date.now()) / 86_400_000)).toBe(30);
    expect((await env.call("POST", `/admin/businesses/${b.id}/plan`, adm.cookie, { planId: "gratis" })).statusCode).toBe(200);
    expect((await conn.pool.query("select plan_expires_at from businesses where id = $1", [b.id])).rows[0].plan_expires_at).toBeNull();
  });
  it("las notas internas se guardan y se pueden borrar", async () => {
    const adm = await env.admin("a@test.com");
    const u = await env.account("u@test.com");
    const b = await biz(u.id);
    await env.call("PUT", `/admin/businesses/${b.id}/note`, adm.cookie, { note: "  Pidió factura  " });
    expect((await conn.pool.query("select internal_note from businesses where id = $1", [b.id])).rows[0].internal_note).toBe("Pidió factura");
    await env.call("PUT", `/admin/businesses/${b.id}/note`, adm.cookie, { note: "" });
    expect((await conn.pool.query("select internal_note from businesses where id = $1", [b.id])).rows[0].internal_note).toBeNull();
    expect((await env.call("PUT", `/admin/businesses/${b.id}/note`, adm.cookie, { note: "x".repeat(1001) })).statusCode).toBe(400);
  });
});

describe("usuarios", () => {
  it("lista y busca por email o nombre, con paginación y sin exponer contraseñas ni secretos", async () => {
    const adm = await env.admin("a@test.com");
    for (let i = 0; i < 27; i++) await env.account(`persona${i}@test.com`);
    const r1 = (await env.call("GET", "/admin/users", adm.cookie)).json(), r2 = (await env.call("GET", "/admin/users?page=2", adm.cookie)).json();
    expect([r1.users.length, r2.users.length, r1.total]).toEqual([25, 3, 28]);
    expect((await env.call("GET", "/admin/users?q=persona13", adm.cookie)).json().total).toBe(1);
    expect(JSON.stringify(r1)).not.toMatch(/passwordHash|password_hash|totpSecret|totp_secret/);
  });
  it("bloquear cierra todas sus sesiones, le impide ingresar y se puede revertir", async () => {
    const adm = await env.admin("a@test.com");
    const u = await env.account("u@test.com");
    expect((await env.call("GET", "/auth/me", u.cookie)).json().user.email).toBe("u@test.com");
    expect((await env.call("POST", `/admin/users/${u.id}/block`, adm.cookie, {})).statusCode).toBe(200);
    expect((await env.call("GET", "/auth/me", u.cookie)).json().user).toBeNull();
    expect(await count(conn, "sessions", `user_id = '${u.id}'`)).toBe(0);
    expect((await env.app.inject({ method: "POST", url: "/auth/login", headers: { origin: "http://localhost:3000" }, payload: { email: "u@test.com", password: "claveSegura123" } })).statusCode).toBe(403);
    expect((await env.call("POST", `/admin/users/${u.id}/unblock`, adm.cookie, {})).statusCode).toBe(200);
    expect((await env.app.inject({ method: "POST", url: "/auth/login", headers: { origin: "http://localhost:3000" }, payload: { email: "u@test.com", password: "claveSegura123" } })).statusCode).toBe(200);
  });
  it("no se puede bloquear a uno mismo; un admin no bloquea a otro admin pero el owner sí", async () => {
    const adm = await env.admin("a@test.com", "admin");
    const other = await env.admin("b@test.com", "admin");
    const owner = await env.admin("o@test.com", "owner");
    expect((await env.call("POST", `/admin/users/${adm.id}/block`, adm.cookie, {})).json().error).toBe("cannot_target_self");
    expect((await env.call("POST", `/admin/users/${other.id}/block`, adm.cookie, {})).statusCode).toBe(403);
    expect((await env.call("POST", `/admin/users/${other.id}/block`, owner.cookie, {})).statusCode).toBe(200);
    expect((await env.call("POST", "/admin/users/00000000-0000-4000-8000-000000000000/block", adm.cookie, {})).statusCode).toBe(404);
  });
});

describe("gestión de administradores (solo Owner)", () => {
  it("nombrar admin o soporte a una cuenta existente cierra sus sesiones (tiene que volver a ingresar y pasar el 2FA)", async () => {
    const owner = await env.admin("o@test.com", "owner");
    const u = await env.account("nuevo@test.com");
    expect((await env.call("POST", "/admin/admins", owner.cookie, { email: "NUEVO@test.com", role: "support" })).statusCode).toBe(201);
    expect((await conn.pool.query("select role from users where id = $1", [u.id])).rows[0].role).toBe("support");
    expect(await count(conn, "sessions", `user_id = '${u.id}'`)).toBe(0);
    expect((await lastAudit(conn, "admin.grant")).after).toEqual({ role: "support" });
    expect((await env.call("GET", "/admin/admins", owner.cookie)).json().admins.map((a: { email: string }) => a.email)).toContain("nuevo@test.com");
  });
  it("no se puede nombrar a quien no tiene cuenta, ni cambiar al owner, ni usar roles inventados", async () => {
    const owner = await env.admin("o@test.com", "owner");
    expect((await env.call("POST", "/admin/admins", owner.cookie, { email: "nadie@test.com", role: "admin" })).json().error).toBe("user_not_found");
    expect((await env.call("POST", "/admin/admins", owner.cookie, { email: "o@test.com", role: "admin" })).json().error).toBe("is_owner");
    expect((await env.call("POST", "/admin/admins", owner.cookie, { email: "x@test.com", role: "owner" })).statusCode).toBe(400);
  });
  it("revocar vuelve a la persona un usuario común y le borra el 2FA; no se puede revocar a uno mismo ni al owner", async () => {
    const owner = await env.admin("o@test.com", "owner");
    const adm = await env.admin("a@test.com", "admin");
    expect((await env.call("DELETE", `/admin/admins/${owner.id}`, owner.cookie)).json().error).toBe("cannot_target_self");
    expect((await env.call("DELETE", `/admin/admins/${adm.id}`, owner.cookie)).statusCode).toBe(200);
    expect((await conn.pool.query("select role, totp_secret, totp_enabled_at from users where id = $1", [adm.id])).rows[0]).toEqual({ role: "user", totp_secret: null, totp_enabled_at: null });
    expect((await env.call("GET", "/admin/dashboard", adm.cookie)).statusCode).toBe(401); // su sesión ya no existe
    const u = await env.account("comun@test.com");
    expect((await env.call("DELETE", `/admin/admins/${u.id}`, owner.cookie)).statusCode).toBe(404);
  });
});
