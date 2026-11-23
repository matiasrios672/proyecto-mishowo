import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { setupTestDb } from "../db/testdb.js";
import { RESET, lastAudit, makeEnv, type Conn } from "../admin/test-helpers.js";
import * as s from "../db/schema.js";

let conn: Conn;
let env: ReturnType<typeof makeEnv>;

beforeAll(async () => { conn = await setupTestDb("mishowo_test_permissions"); env = makeEnv(conn, { ORDERS_PER_MINUTE: "10000" }); });
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query(RESET);
  await conn.db.insert(s.plans).values({ id: "gratis", name: "Gratis", priceMonthly: "0" });
  env.mailer.outbox.length = 0;
});

const setPerms = (id: string, permissions: object | null) => conn.pool.query("update users set permissions = $1 where id = $2", [permissions ? JSON.stringify(permissions) : null, id]);
const ghost = () => `/admin/payments/${randomUUID()}`;

describe("permisos por área del equipo", () => {
  it("las plantillas se comportan como los roles de antes (Soporte no toca pagos; Admin sí)", async () => {
    const sup = await env.admin("s@test.com", "support");
    const adm = await env.admin("a@test.com", "admin");
    expect((await env.call("GET", "/admin/users", sup.cookie)).statusCode).toBe(200);
    expect((await env.call("GET", "/admin/contact", sup.cookie)).statusCode).toBe(200);
    expect((await env.call("GET", "/admin/payments", sup.cookie)).statusCode).toBe(403);
    expect((await env.call("GET", "/admin/plans", sup.cookie)).statusCode).toBe(403);
    expect((await env.call("GET", "/admin/audit", sup.cookie)).statusCode).toBe(403);
    expect((await env.call("GET", "/admin/payments", adm.cookie)).statusCode).toBe(200);
    expect((await env.call("GET", "/admin/admins", adm.cookie)).statusCode).toBe(403); // el equipo es solo del Owner
  });

  it("/admin/me devuelve los permisos efectivos (para armar el menú)", async () => {
    const sup = await env.admin("s@test.com", "support");
    const owner = await env.admin("o@test.com", "owner");
    const me = (await env.call("GET", "/admin/me", sup.cookie)).json();
    expect(me.permissions).toMatchObject({ consultas: "manage", negocios: "view" });
    expect(me.permissions.pagos).toBeUndefined();
    const om = (await env.call("GET", "/admin/me", owner.cookie)).json();
    expect(om.permissions.pagos).toBe("manage");
    expect(om.permissions.auditoria).toBe("manage");
  });

  it("«ver» no alcanza para gestionar y «gestionar» incluye ver", async () => {
    const sup = await env.admin("s@test.com", "support");
    await setPerms(sup.id, { pagos: "view" });
    expect((await env.call("GET", "/admin/payments", sup.cookie)).statusCode).toBe(200);
    expect((await env.call("POST", `${ghost()}/confirm`, sup.cookie, {})).statusCode).toBe(403);
    expect((await env.call("POST", "/admin/payments/manual", sup.cookie, {})).statusCode).toBe(403);
    await setPerms(sup.id, { pagos: "manage" });
    expect((await env.call("GET", "/admin/payments", sup.cookie)).statusCode).toBe(200); // gestionar incluye ver
    expect((await env.call("POST", `${ghost()}/confirm`, sup.cookie, {})).statusCode).toBe(409); // pasó el permiso: el pago no existe (no está pendiente)
  });

  it("los permisos a medida reemplazan a la plantilla: un Admin sin acceso a usuarios ni planes", async () => {
    const adm = await env.admin("a@test.com", "admin");
    await setPerms(adm.id, { negocios: "view" });
    expect((await env.call("GET", "/admin/users", adm.cookie)).statusCode).toBe(403);
    expect((await env.call("GET", "/admin/plans", adm.cookie)).statusCode).toBe(403);
    expect((await env.call("GET", "/admin/payments", adm.cookie)).statusCode).toBe(403);
    expect((await env.call("GET", "/admin/businesses", adm.cookie)).statusCode).toBe(200);
    expect((await env.call("GET", "/admin/dashboard", adm.cookie)).json().finance).toBe(false); // sin pagos no ve ingresos
  });

  it("cambiar el plan de un negocio pide permiso de planes, no solo de negocios", async () => {
    const adm = await env.admin("a@test.com", "admin");
    const owner = await env.account("dueno@test.com");
    const [b] = await conn.db.insert(s.businesses).values({ slug: "lupe", ownerId: owner.id, name: "Lupe", status: "published", publishedAt: new Date() }).returning();
    await setPerms(adm.id, { negocios: "manage" });
    expect((await env.call("POST", `/admin/businesses/${b!.id}/plan`, adm.cookie, { planId: "gratis" })).statusCode).toBe(403);
    expect((await env.call("POST", `/admin/businesses/${b!.id}/suspend`, adm.cookie, {})).statusCode).toBe(200);
    await setPerms(adm.id, { negocios: "manage", planes: "manage" });
    expect((await env.call("POST", `/admin/businesses/${b!.id}/plan`, adm.cookie, { planId: "gratis" })).statusCode).toBe(200);
  });

  it("la ficha del negocio no muestra pagos a quien no puede ver pagos", async () => {
    const owner = await env.account("dueno@test.com");
    const [b] = await conn.db.insert(s.businesses).values({ slug: "lupe", ownerId: owner.id, name: "Lupe", status: "published", publishedAt: new Date() }).returning();
    await conn.db.insert(s.payments).values({ businessId: b!.id, planId: "gratis", amount: "100", months: 1 });
    const sup = await env.admin("s@test.com", "support");
    const adm = await env.admin("a@test.com", "admin");
    expect((await env.call("GET", `/admin/businesses/${b!.id}`, sup.cookie)).json().payments).toEqual([]);
    expect((await env.call("GET", `/admin/businesses/${b!.id}`, adm.cookie)).json().payments).toHaveLength(1);
  });

  it("denuncias: con «ver» se deja una nota pero no se resuelve", async () => {
    const owner = await env.account("dueno@test.com");
    const [b] = await conn.db.insert(s.businesses).values({ slug: "lupe", ownerId: owner.id, name: "Lupe", status: "published", publishedAt: new Date() }).returning();
    const [r] = await conn.db.insert(s.reports).values({ businessId: b!.id, reason: "estafa", detail: "x" }).returning();
    const sup = await env.admin("s@test.com", "support");
    expect((await env.call("POST", `/admin/reports/${r!.id}/resolve`, sup.cookie, { action: "note", note: "revisando" })).statusCode).toBe(200);
    expect((await env.call("POST", `/admin/reports/${r!.id}/resolve`, sup.cookie, { action: "dismiss" })).statusCode).toBe(403);
    await setPerms(sup.id, { denuncias: "manage" });
    expect((await env.call("POST", `/admin/reports/${r!.id}/resolve`, sup.cookie, { action: "dismiss" })).statusCode).toBe(200);
  });
});

describe("el Owner administra los permisos del equipo", () => {
  it("lista el equipo con permisos efectivos, el catálogo de áreas y las plantillas", async () => {
    const owner = await env.admin("o@test.com", "owner");
    await env.admin("s@test.com", "support");
    const r = (await env.call("GET", "/admin/admins", owner.cookie)).json();
    expect(r.areas.map((a: { key: string }) => a.key)).toEqual(expect.arrayContaining(["pagos", "negocios", "auditoria"]));
    expect(r.presets.support.pagos).toBeUndefined();
    expect(r.presets.admin.pagos).toBe("manage");
    const sup = r.admins.find((a: { email: string }) => a.email === "s@test.com");
    expect(sup).toMatchObject({ role: "support", customPermissions: false });
    expect(sup.permissions.consultas).toBe("manage");
    expect(JSON.stringify(r)).not.toMatch(/totpSecret|password/i);
  });

  it("edita permisos y rige de inmediato, sin que la persona vuelva a ingresar", async () => {
    const owner = await env.admin("o@test.com", "owner");
    const sup = await env.admin("s@test.com", "support");
    expect((await env.call("GET", "/admin/payments", sup.cookie)).statusCode).toBe(403);
    const res = await env.call("PUT", `/admin/admins/${sup.id}/permissions`, owner.cookie, { permissions: { pagos: "manage", consultas: "manage" } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ customPermissions: true, permissions: { pagos: "manage", consultas: "manage" } });
    expect((await env.call("GET", "/admin/payments", sup.cookie)).statusCode).toBe(200); // misma sesión
    expect((await env.call("GET", "/admin/users", sup.cookie)).statusCode).toBe(403); // lo que no se tildó se pierde
    const audit = await lastAudit(conn, "admin.permissions");
    expect(audit.after).toMatchObject({ role: "support", permissions: { pagos: "manage" } });
    expect(audit.before).toMatchObject({ role: "support" });
  });

  it("si los permisos coinciden con la plantilla no se guarda nada a medida (y puede cambiar de plantilla)", async () => {
    const owner = await env.admin("o@test.com", "owner");
    const sup = await env.admin("s@test.com", "support");
    await env.call("PUT", `/admin/admins/${sup.id}/permissions`, owner.cookie, { permissions: { pagos: "view" } });
    expect((await conn.pool.query("select permissions from users where id = $1", [sup.id])).rows[0].permissions).toEqual({ pagos: "view" });
    const all = Object.fromEntries(["negocios", "usuarios", "pagos", "planes", "leads", "consultas", "denuncias", "emails", "contenido", "rubros", "sistema", "auditoria"].map((k) => [k, "manage"]));
    const res = await env.call("PUT", `/admin/admins/${sup.id}/permissions`, owner.cookie, { role: "admin", permissions: all });
    expect(res.json()).toMatchObject({ customPermissions: false });
    const row = (await conn.pool.query("select role, permissions from users where id = $1", [sup.id])).rows[0];
    expect(row).toEqual({ role: "admin", permissions: null });
  });

  it("nadie más que el Owner los cambia, ni el Owner a sí mismo ni a otro Owner", async () => {
    const owner = await env.admin("o@test.com", "owner");
    const other = await env.admin("o2@test.com", "owner");
    const adm = await env.admin("a@test.com", "admin");
    const sup = await env.admin("s@test.com", "support");
    expect((await env.call("PUT", `/admin/admins/${sup.id}/permissions`, adm.cookie, { permissions: { pagos: "manage" } })).statusCode).toBe(403);
    expect((await env.call("PUT", `/admin/admins/${sup.id}/permissions`, sup.cookie, { permissions: { pagos: "manage" } })).statusCode).toBe(403);
    expect((await env.call("PUT", `/admin/admins/${owner.id}/permissions`, owner.cookie, { permissions: {} })).json().error).toBe("cannot_target_self");
    expect((await env.call("PUT", `/admin/admins/${other.id}/permissions`, owner.cookie, { permissions: {} })).json().error).toBe("is_owner");
    expect((await env.call("PUT", `/admin/admins/${randomUUID()}/permissions`, owner.cookie, { permissions: {} })).statusCode).toBe(404);
    expect((await conn.pool.query("select permissions from users where id = $1", [sup.id])).rows[0].permissions).toBeNull();
  });

  it("rechaza áreas o niveles inventados", async () => {
    const owner = await env.admin("o@test.com", "owner");
    const sup = await env.admin("s@test.com", "support");
    for (const permissions of [{ equipo: "manage" }, { pagos: "root" }, { pagos: true }, [], "todo"]) {
      expect((await env.call("PUT", `/admin/admins/${sup.id}/permissions`, owner.cookie, { permissions })).statusCode, JSON.stringify(permissions)).toBe(400);
    }
  });

  it("invitar con permisos a medida los guarda; sin permisos usa la plantilla", async () => {
    const owner = await env.admin("o@test.com", "owner");
    const a = await env.call("POST", "/admin/admins/invite", owner.cookie, { email: "nuevo@test.com", name: "Nuevo", role: "support", permissions: { pagos: "view", consultas: "manage" } });
    expect(a.statusCode).toBe(201);
    expect((await conn.pool.query("select permissions from users where email = 'nuevo@test.com'")).rows[0].permissions).toEqual({ pagos: "view", consultas: "manage" });
    const b = await env.call("POST", "/admin/admins/invite", owner.cookie, { email: "otra@test.com", name: "Otra", role: "support" });
    expect(b.statusCode).toBe(201);
    expect((await conn.pool.query("select permissions from users where email = 'otra@test.com'")).rows[0].permissions).toBeNull();
    expect((await lastAudit(conn, "admin.invite")).after).toMatchObject({ role: "support" });
  });

  it("dar acceso a una cuenta existente también acepta permisos, y quitar el acceso los borra", async () => {
    const owner = await env.admin("o@test.com", "owner");
    const u = await env.account("persona@test.com");
    expect((await env.call("POST", "/admin/admins", owner.cookie, { email: "persona@test.com", role: "support", permissions: { leads: "manage" } })).statusCode).toBe(201);
    expect((await conn.pool.query("select permissions from users where id = $1", [u.id])).rows[0].permissions).toEqual({ leads: "manage" });
    expect((await env.call("DELETE", `/admin/admins/${u.id}`, owner.cookie)).statusCode).toBe(200);
    const row = (await conn.pool.query("select role, permissions from users where id = $1", [u.id])).rows[0];
    expect(row).toEqual({ role: "user", permissions: null });
  });

  it("un permiso guardado roto no abre nada: se ignora y rige la plantilla", async () => {
    const sup = await env.admin("s@test.com", "support");
    await setPerms(sup.id, { pagos: "todo", equipo: "manage" });
    expect((await env.call("GET", "/admin/payments", sup.cookie)).statusCode).toBe(403);
    expect((await env.call("GET", "/admin/users", sup.cookie)).statusCode).toBe(200);
  });
});
