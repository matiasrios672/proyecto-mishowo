import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb } from "../db/testdb.js";
import { RESET, count, lastAudit, makeEnv, type Conn } from "../admin/test-helpers.js";
import { addMonths } from "../billing/activate.js";
import { expirePlans, remindExpiring } from "../jobs/plans.js";
import * as s from "../db/schema.js";

let conn: Conn;
let env: ReturnType<typeof makeEnv>;
const DAY = 86_400_000;
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]);

beforeAll(async () => { conn = await setupTestDb("mishowo_test_adminbill"); env = makeEnv(conn); });
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query(RESET);
  await conn.db.insert(s.plans).values([
    { id: "gratis", name: "Gratis", priceMonthly: "0", limits: { products: 3 } },
    { id: "emprende", name: "Emprende", priceMonthly: "9900" },
    { id: "pro", name: "Pro", priceMonthly: "19900" },
  ]);
  env.mailer.outbox.length = 0; env.notified.length = 0; env.files.clear();
});

async function scenario(over: Partial<typeof s.businesses.$inferInsert> = {}) {
  const adm = await env.admin("admin@test.com", "admin");
  const owner = await env.account("dueno@test.com");
  const [b] = await conn.db.insert(s.businesses).values({ slug: "lupe", ownerId: owner.id, name: "Lupe", status: "published", ...over }).returning();
  return { adm, owner, biz: b! };
}
const pending = async (businessId: string, over: Partial<typeof s.payments.$inferInsert> = {}) =>
  (await conn.db.insert(s.payments).values({ businessId, planId: "emprende", amount: "29700", months: 3, ...over }).returning())[0]!;
const bizRow = async (id: string) => (await conn.pool.query("select plan_id, plan_expires_at from businesses where id = $1", [id])).rows[0];
const monthsFromNow = (n: number) => addMonths(new Date(), n).getTime();

describe("addMonths", () => {
  it("suma meses de calendario sin desbordar (31/1 + 1 mes = 28/2)", () => {
    expect(addMonths(new Date("2026-01-31T12:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(addMonths(new Date("2028-01-31T12:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2028-02-29"); // bisiesto
    expect(addMonths(new Date("2026-11-30T12:00:00Z"), 3).toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(addMonths(new Date("2026-12-15T12:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2027-01-15");
    expect(addMonths(new Date("2026-05-10T12:00:00Z"), 12).toISOString().slice(0, 10)).toBe("2027-05-10");
  });
});

describe("bandeja de pagos", () => {
  it("lista los pendientes del más viejo al más nuevo con negocio y dueño, y filtra por estado", async () => {
    const { adm, biz } = await scenario();
    const p1 = await pending(biz.id, { createdAt: new Date(Date.now() - 2 * DAY), note: "primero" });
    await pending(biz.id, { createdAt: new Date(Date.now() - 1 * DAY), note: "segundo" });
    await pending(biz.id, { status: "confirmado" });
    const r = (await env.call("GET", "/admin/payments", adm.cookie)).json();
    expect(r.payments.map((p: { note: string }) => p.note)).toEqual(["primero", "segundo"]);
    expect(r.payments[0]).toMatchObject({ id: p1.id, businessName: "Lupe", slug: "lupe", ownerEmail: "dueno@test.com", amount: 29700, hasReceipt: false });
    expect((await env.call("GET", "/admin/payments?status=confirmado", adm.cookie)).json().payments).toHaveLength(1);
    expect((await env.call("GET", "/admin/payments?status=raro", adm.cookie)).statusCode).toBe(400);
  });
  it("el comprobante se descarga con cabeceras seguras; sin archivo es 404", async () => {
    const { adm, biz } = await scenario();
    const p = await pending(biz.id, { receiptPath: "receipts/x.png" });
    env.files.set("receipts/x.png", PNG);
    const ok = await env.call("GET", `/admin/payments/${p.id}/receipt`, adm.cookie);
    expect(ok.statusCode).toBe(200);
    expect(ok.headers["content-type"]).toBe("image/png");
    expect(ok.headers["x-content-type-options"]).toBe("nosniff");
    expect(ok.headers["content-security-policy"]).toContain("sandbox");
    const none = await pending(biz.id);
    expect((await env.call("GET", `/admin/payments/${none.id}/receipt`, adm.cookie)).statusCode).toBe(404);
  });
});

describe("confirmar un pago", () => {
  it("activa el plan con su vencimiento, registra la suscripción, avisa al dueño y actualiza la página", async () => {
    const { adm, owner, biz } = await scenario();
    const p = await pending(biz.id, { months: 3 });
    const res = await env.call("POST", `/admin/payments/${p.id}/confirm`, adm.cookie, {});
    expect(res.statusCode).toBe(200);
    const row = await bizRow(biz.id);
    expect(row.plan_id).toBe("emprende");
    expect(Math.abs(new Date(row.plan_expires_at).getTime() - monthsFromNow(3))).toBeLessThan(60_000);
    const pay = (await conn.pool.query("select status, resolved_by, resolved_at from payments where id = $1", [p.id])).rows[0];
    expect(pay).toMatchObject({ status: "confirmado", resolved_by: adm.id });
    expect(pay.resolved_at).not.toBeNull();
    expect(await count(conn, "subscriptions", `business_id = '${biz.id}' and plan_id = 'emprende'`)).toBe(1);
    const mail = env.mailer.outbox.find((m) => m.subject === "¡Tu plan Emprende está activo!")!;
    expect(mail.to).toBe(owner.email);
    expect(mail.text).toMatch(/activo hasta el \d/);
    expect(env.notified).toContain("lupe");
    const a = await lastAudit(conn, "payment.confirm");
    expect(a).toMatchObject({ actor_id: adm.id, entity_id: p.id });
    expect(a.before).toMatchObject({ status: "pendiente", plan: "gratis" });
    expect(a.after).toMatchObject({ status: "confirmado", plan: "emprende", months: 3 });
  });
  it("renovar el mismo plan vigente suma los meses al vencimiento actual (no se pierde lo ya pagado)", async () => {
    const expiry = new Date(Date.now() + 10 * DAY);
    const { adm, biz } = await scenario({ planId: "emprende", planExpiresAt: expiry });
    const p = await pending(biz.id, { months: 1 });
    await env.call("POST", `/admin/payments/${p.id}/confirm`, adm.cookie, {});
    expect(Math.abs(new Date((await bizRow(biz.id)).plan_expires_at).getTime() - addMonths(expiry, 1).getTime())).toBeLessThan(1000);
  });
  it("cambiar a otro plan o renovar uno vencido cuenta desde hoy", async () => {
    const { adm, biz } = await scenario({ planId: "emprende", planExpiresAt: new Date(Date.now() + 10 * DAY) });
    const up = await pending(biz.id, { planId: "pro", months: 1 });
    await env.call("POST", `/admin/payments/${up.id}/confirm`, adm.cookie, {});
    expect(Math.abs(new Date((await bizRow(biz.id)).plan_expires_at).getTime() - monthsFromNow(1))).toBeLessThan(60_000);
    await conn.pool.query("update businesses set plan_id = 'pro', plan_expires_at = now() - interval '5 days' where id = $1", [biz.id]);
    const renew = await pending(biz.id, { planId: "pro", months: 1 });
    await env.call("POST", `/admin/payments/${renew.id}/confirm`, adm.cookie, {});
    expect(Math.abs(new Date((await bizRow(biz.id)).plan_expires_at).getTime() - monthsFromNow(1))).toBeLessThan(60_000);
  });
  it("confirmar dos veces el mismo pago a la vez activa una sola vez", async () => {
    const { adm, biz } = await scenario();
    const p = await pending(biz.id, { months: 1 });
    const res = await Promise.all([env.call("POST", `/admin/payments/${p.id}/confirm`, adm.cookie, {}), env.call("POST", `/admin/payments/${p.id}/confirm`, adm.cookie, {})]);
    expect(res.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(await count(conn, "subscriptions")).toBe(1);
    expect(Math.abs(new Date((await bizRow(biz.id)).plan_expires_at).getTime() - monthsFromNow(1))).toBeLessThan(60_000);
  });
  it("dos pagos distintos del mismo negocio confirmados a la vez suman ambos períodos (ninguna renovación pisa a la otra)", async () => {
    const { adm, biz } = await scenario();
    const a = await pending(biz.id, { months: 1 }), b = await pending(biz.id, { months: 1 });
    const res = await Promise.all([env.call("POST", `/admin/payments/${a.id}/confirm`, adm.cookie, {}), env.call("POST", `/admin/payments/${b.id}/confirm`, adm.cookie, {})]);
    expect(res.every((r) => r.statusCode === 200)).toBe(true);
    expect(Math.abs(new Date((await bizRow(biz.id)).plan_expires_at).getTime() - monthsFromNow(2))).toBeLessThan(5000);
  });
  it("un pago ya resuelto, inexistente o con id inválido no se puede confirmar", async () => {
    const { adm, biz } = await scenario();
    const p = await pending(biz.id, { status: "rechazado" });
    expect((await env.call("POST", `/admin/payments/${p.id}/confirm`, adm.cookie, {})).json().error).toBe("not_pending");
    expect((await env.call("POST", "/admin/payments/00000000-0000-4000-8000-000000000000/confirm", adm.cookie, {})).statusCode).toBe(409);
    expect((await env.call("POST", "/admin/payments/no-es-uuid/confirm", adm.cookie, {})).statusCode).toBe(404);
    expect((await bizRow(biz.id)).plan_id).toBe("gratis");
  });
});

describe("rechazar un pago", () => {
  it("exige un motivo, lo guarda, se lo cuenta al usuario y no activa nada", async () => {
    const { adm, biz } = await scenario();
    const p = await pending(biz.id);
    expect((await env.call("POST", `/admin/payments/${p.id}/reject`, adm.cookie, {})).statusCode).toBe(400);
    expect((await env.call("POST", `/admin/payments/${p.id}/reject`, adm.cookie, { reason: "no" })).statusCode).toBe(400);
    expect((await env.call("POST", `/admin/payments/${p.id}/reject`, adm.cookie, { reason: "El monto no coincide con el plan" })).statusCode).toBe(200);
    expect((await conn.pool.query("select status, reject_reason from payments where id = $1", [p.id])).rows[0]).toEqual({ status: "rechazado", reject_reason: "El monto no coincide con el plan" });
    expect(env.mailer.outbox.find((m) => m.subject === "No pudimos confirmar tu pago")!.text).toContain("El monto no coincide con el plan");
    expect((await bizRow(biz.id)).plan_id).toBe("gratis");
    expect((await lastAudit(conn, "payment.reject")).after).toMatchObject({ reason: "El monto no coincide con el plan" });
    expect((await env.call("POST", `/admin/payments/${p.id}/reject`, adm.cookie, { reason: "otra vez" })).statusCode).toBe(409);
    expect((await env.call("POST", `/admin/payments/${p.id}/confirm`, adm.cookie, {})).statusCode).toBe(409); // ya rechazado: no se puede confirmar después
  });
});

describe("registrar un pago manual", () => {
  it("crea el pago ya confirmado y activa el plan; el monto por defecto sale del precio vigente", async () => {
    const { adm, biz } = await scenario();
    const res = await env.call("POST", "/admin/payments/manual", adm.cookie, { businessId: biz.id, planId: "pro", months: 2, method: "efectivo" });
    expect(res.statusCode).toBe(201);
    const pay = (await conn.pool.query("select status, amount, method, note from payments")).rows[0];
    expect(pay).toMatchObject({ status: "confirmado", method: "efectivo", note: "Registrado por el equipo" });
    expect(Number(pay.amount)).toBe(39800);
    expect((await bizRow(biz.id)).plan_id).toBe("pro");
  });
  it("acepta un monto distinto (descuento) y rechaza planes, negocios y datos inválidos", async () => {
    const { adm, biz } = await scenario();
    await env.call("POST", "/admin/payments/manual", adm.cookie, { businessId: biz.id, planId: "emprende", months: 1, method: "transferencia", amount: 5000, note: "Promo" });
    expect(Number((await conn.pool.query("select amount from payments")).rows[0].amount)).toBe(5000);
    const bad = (body: object) => env.call("POST", "/admin/payments/manual", adm.cookie, { businessId: biz.id, planId: "emprende", months: 1, method: "efectivo", ...body });
    expect((await bad({ planId: "gratis" })).statusCode).toBe(422);
    expect((await bad({ planId: "inventado" })).statusCode).toBe(422);
    expect((await bad({ businessId: "00000000-0000-4000-8000-000000000000" })).statusCode).toBe(404);
    for (const body of [{ months: 0 }, { months: 25 }, { method: "bitcoin" }, { amount: -1 }]) expect((await bad(body)).statusCode, JSON.stringify(body)).toBe(400);
  });
});

describe("editor de planes", () => {
  const plan = (over: object = {}) => ({ name: "Emprende", priceMonthly: 12000, limits: { products: null, photosPerProduct: 4, whatsappNumbers: 1, uploadMb: 10 }, features: ["Panel de pedidos", "Cupones"], active: true, ...over });

  it("cambiar un precio se refleja al instante en la landing y en los avisos de pago, y queda auditado con antes y después", async () => {
    const { adm } = await scenario();
    expect((await env.call("PUT", "/admin/plans/emprende", adm.cookie, plan())).statusCode).toBe(200);
    const pub = (await env.app.inject({ method: "GET", url: "/public/plans" })).json();
    expect(pub.find((p: { id: string }) => p.id === "emprende")).toMatchObject({ priceMonthly: 12000, features: ["Panel de pedidos", "Cupones"] });
    const a = await lastAudit(conn, "plan.update");
    expect(a.before).toMatchObject({ priceMonthly: 9900 });
    expect(a.after).toMatchObject({ priceMonthly: 12000 });
  });
  it("crea un plan nuevo, y uno desactivado deja de mostrarse y de poder contratarse", async () => {
    const { adm, owner, biz } = await scenario();
    expect((await env.call("PUT", "/admin/plans/anual-pro", adm.cookie, plan({ name: "Anual Pro", priceMonthly: 15000 }))).statusCode).toBe(200);
    expect((await lastAudit(conn, "plan.create")).entity_id).toBe("anual-pro");
    await env.call("PUT", "/admin/plans/anual-pro", adm.cookie, plan({ name: "Anual Pro", priceMonthly: 15000, active: false }));
    expect((await env.app.inject({ method: "GET", url: "/public/plans" })).json().map((p: { id: string }) => p.id)).not.toContain("anual-pro");
    const pay = await env.call("POST", "/me/payments", owner.cookie, { planId: "anual-pro", months: 1 });
    expect(pay.statusCode).toBe(422);
    void biz;
  });
  it("el plan gratis tiene que seguir siendo gratis y activo (es donde caen las cuentas que no renuevan)", async () => {
    const { adm } = await scenario();
    expect((await env.call("PUT", "/admin/plans/gratis", adm.cookie, plan({ name: "Gratis", priceMonthly: 100 }))).json().error).toBe("gratis_must_stay_free");
    expect((await env.call("PUT", "/admin/plans/gratis", adm.cookie, plan({ name: "Gratis", priceMonthly: 0, active: false }))).statusCode).toBe(422);
    expect((await env.call("PUT", "/admin/plans/gratis", adm.cookie, plan({ name: "Gratis", priceMonthly: 0, limits: { products: 20, photosPerProduct: 2, whatsappNumbers: 1, uploadMb: 5 } }))).statusCode).toBe(200);
  });
  it("valida precios, límites, textos e identificadores", async () => {
    const { adm } = await scenario();
    for (const body of [plan({ priceMonthly: -1 }), plan({ priceMonthly: 1e9 }), plan({ name: "x" }), plan({ features: Array(13).fill("a") }), plan({ limits: { products: 0, photosPerProduct: 1, whatsappNumbers: 1, uploadMb: 1 } }), plan({ limits: { products: 5 } }), plan({ active: "si" })])
      expect((await env.call("PUT", "/admin/plans/emprende", adm.cookie, body)).statusCode).toBe(400);
    for (const id of ["Mayus", "a", "con espacio", "x".repeat(31)]) expect((await env.call("PUT", `/admin/plans/${encodeURIComponent(id)}`, adm.cookie, plan())).statusCode, id).toBe(400);
  });
  it("el límite de productos que se edita acá es el que se aplica al guardar el negocio", async () => {
    const { adm, owner } = await scenario();
    expect((await env.call("GET", "/admin/plans", adm.cookie)).json().plans.find((p: { id: string }) => p.id === "gratis").limits.products).toBe(3);
    await env.call("PUT", "/admin/plans/gratis", adm.cookie, plan({ name: "Gratis", priceMonthly: 0, limits: { products: 1, photosPerProduct: 2, whatsappNumbers: 1, uploadMb: 5 } }));
    const doc = (n: number) => ({ industryId: "x", name: "L", nameIsExample: false, tagline: "", description: "", textsAreExample: false, whatsapp: "", instagram: "", address: "", deliveryZone: "", extraWhatsapps: [], hours: Array.from({ length: 7 }, () => ({ open: false, from: "09:00", to: "18:00" })), announcement: "", whatsappGreeting: "", showQuantities: true, askEventDate: false, design: { layout: "vidriera", theme: "blanco", fontPair: "moderna", brandColor: null, buttonShape: "recto" }, categories: [{ id: "c", name: "C", products: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, description: "", price: 1, comparePrice: null, available: true, stock: null, isExample: false, options: [] })) }] });
    const res = await env.call("PUT", "/me/business", owner.cookie, { baseVersion: null, content: doc(2) });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: "plan_limit", limit: 1, count: 2 });
  });
});

describe("datos para transferir (solo Owner)", () => {
  it("el owner los edita y se le muestran a los usuarios en sus planes; se valida el CBU", async () => {
    const owner = await env.admin("o@test.com", "owner");
    const u = await env.account("u@test.com");
    await conn.db.insert(s.businesses).values({ slug: "neg", ownerId: u.id, name: "N" });
    expect((await env.call("PUT", "/admin/settings/payment", owner.cookie, { holder: "MiShowo SRL", alias: "mishowo.pagos", cbu: "0000003100000000000001", bank: "Banco X", instructions: "Mandá el comprobante" })).statusCode).toBe(200);
    expect((await env.call("GET", "/me/plan", u.cookie)).json().paymentInfo).toMatchObject({ alias: "mishowo.pagos", holder: "MiShowo SRL" });
    expect((await lastAudit(conn, "settings.payment")).after).toMatchObject({ alias: "mishowo.pagos" });
    for (const body of [{ cbu: "abc" }, { cbu: "1".repeat(23) }, { alias: "x".repeat(61) }, { instructions: "x".repeat(501) }]) expect((await env.call("PUT", "/admin/settings/payment", owner.cookie, body)).statusCode, JSON.stringify(body)).toBe(400);
  });
});

describe("vencimiento automático de planes", () => {
  const offsets = async () => {
    const owner = await env.account("dueno@test.com");
    const mk = (slug: string, over: Partial<typeof s.businesses.$inferInsert>) => conn.db.insert(s.businesses).values({ slug, ownerId: owner.id, name: slug, status: "published", ...over }).returning().then((r) => r[0]!);
    return {
      owner,
      vencido: await mk("vencido", { planId: "emprende", planExpiresAt: new Date(Date.now() - DAY) }),
      vigente: await mk("vigente", { planId: "emprende", planExpiresAt: new Date(Date.now() + 30 * DAY) }),
      gratis: await mk("gratis-neg", {}),
      borrado: await mk("borrado", { planId: "pro", planExpiresAt: new Date(Date.now() - DAY), deletedAt: new Date() }),
    };
  };

  it("pasa a gratis solo lo vencido; no toca lo vigente, lo gratuito ni lo borrado; avisa y audita", async () => {
    const t = await offsets();
    expect(await expirePlans(conn.db, env.mailer, (s) => void env.notified.push(s))).toBe(1);
    expect((await bizRow(t.vencido.id))).toMatchObject({ plan_id: "gratis", plan_expires_at: null });
    expect((await bizRow(t.vigente.id)).plan_id).toBe("emprende");
    expect((await bizRow(t.gratis.id)).plan_id).toBe("gratis");
    expect((await bizRow(t.borrado.id)).plan_id).toBe("pro");
    expect(env.mailer.outbox.find((m) => m.subject === "Tu plan de MiShowo venció")!.to).toBe("dueno@test.com");
    expect(env.notified).toEqual(["vencido"]);
    const a = await lastAudit(conn, "plan.expired");
    expect(a).toMatchObject({ actor_id: null, entity_id: t.vencido.id });
  });
  it("es idempotente y los productos que superan el límite gratuito no se borran", async () => {
    const t = await offsets();
    for (let i = 0; i < 5; i++) await conn.db.insert(s.products).values({ businessId: t.vencido.id, name: `P${i}` });
    const noop = () => {};
    expect(await expirePlans(conn.db, env.mailer, noop)).toBe(1);
    expect(await expirePlans(conn.db, env.mailer, noop)).toBe(0);
    expect(await count(conn, "audit_log", "action = 'plan.expired'")).toBe(1);
    expect(env.mailer.outbox.filter((m) => m.subject === "Tu plan de MiShowo venció")).toHaveLength(1);
    expect(await count(conn, "products", `business_id = '${t.vencido.id}'`)).toBe(5);
  });
  it("dos corridas simultáneas no degradan ni avisan dos veces", async () => {
    await offsets();
    const noop = () => {};
    const [a, b] = await Promise.all([expirePlans(conn.db, env.mailer, noop), expirePlans(conn.db, env.mailer, noop)]);
    expect(a + b).toBe(1);
    expect(env.mailer.outbox.filter((m) => m.subject === "Tu plan de MiShowo venció")).toHaveLength(1);
  });
  it("si falla el email el plan igual se degrada (no queda en un estado a medias)", async () => {
    const t = await offsets();
    const broken = { send: async () => { throw new Error("SMTP caído"); } };
    expect(await expirePlans(conn.db, broken, () => {})).toBe(1);
    expect((await bizRow(t.vencido.id)).plan_id).toBe("gratis");
  });

  it("recuerda una sola vez antes del vencimiento, y de nuevo cuando el vencimiento cambia (renovación)", async () => {
    const owner = await env.account("dueno@test.com");
    const [b] = await conn.db.insert(s.businesses).values({ slug: "por-vencer", ownerId: owner.id, name: "N", planId: "emprende", planExpiresAt: new Date(Date.now() + 3 * DAY) }).returning();
    await conn.db.insert(s.businesses).values({ slug: "lejos", ownerId: owner.id, name: "L", planId: "emprende", planExpiresAt: new Date(Date.now() + 30 * DAY) });
    expect(await remindExpiring(conn.db, env.mailer)).toBe(1);
    expect(await remindExpiring(conn.db, env.mailer)).toBe(0); // no insiste
    const mail = env.mailer.outbox.find((m) => m.subject === "Tu plan de MiShowo está por vencer")!;
    expect(mail.to).toBe("dueno@test.com");
    expect(mail.text).toMatch(/vence el \d/);
    await conn.pool.query("update businesses set plan_expires_at = now() + interval '5 days' where id = $1", [b!.id]); // renovó y vuelve a estar por vencer
    expect(await remindExpiring(conn.db, env.mailer)).toBe(1);
  });
  it("no recuerda a quien ya venció, es gratis o está borrado, y no duplica con corridas simultáneas", async () => {
    const owner = await env.account("dueno@test.com");
    const mk = (slug: string, over: Partial<typeof s.businesses.$inferInsert>) => conn.db.insert(s.businesses).values({ slug, ownerId: owner.id, name: slug, ...over });
    await mk("vencido", { planId: "emprende", planExpiresAt: new Date(Date.now() - DAY) });
    await mk("borrado", { planId: "emprende", planExpiresAt: new Date(Date.now() + 2 * DAY), deletedAt: new Date() });
    await mk("gratis", { planExpiresAt: new Date(Date.now() + 2 * DAY) });
    await mk("ok", { planId: "emprende", planExpiresAt: new Date(Date.now() + 2 * DAY) });
    const [a, b] = await Promise.all([remindExpiring(conn.db, env.mailer), remindExpiring(conn.db, env.mailer)]);
    expect(a + b).toBe(1);
    expect(env.mailer.outbox.filter((m) => m.subject === "Tu plan de MiShowo está por vencer")).toHaveLength(1);
  });
});
