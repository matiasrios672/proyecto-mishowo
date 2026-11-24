import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb } from "../db/testdb.js";
import { ORIGIN, RESET, lastAudit, makeEnv, type Conn } from "../admin/test-helpers.js";
import { sendDueCampaigns, unsubscribeToken } from "../mail/service.js";
import { remindExpiring } from "../jobs/plans.js";
import { render } from "../mail/templates.js";
import * as s from "../db/schema.js";

let conn: Conn;
let env: ReturnType<typeof makeEnv>;
beforeAll(async () => { conn = await setupTestDb("mishowo_test_adminmail"); env = makeEnv(conn); });
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query(RESET);
  await conn.db.insert(s.plans).values([{ id: "gratis", name: "Gratis", priceMonthly: "0", limits: {} }, { id: "pro", name: "Pro", priceMonthly: "100", limits: {} }]);
  env.mailer.outbox.length = 0;
});

const patch = (url: string, cookie: string, payload: object) => env.app.inject({ method: "PATCH", url, payload, headers: { cookie, origin: ORIGIN } });
const verify = (id: string) => conn.pool.query("update users set email_verified_at = now() where id = $1", [id]);
const tpl = (over: object = {}) => ({ subject: "Hola {{name}}", body: "Te sumaron como {{role}}.\n\n{{link}}", enabled: true, ...over });
const tokenFrom = (text: string) => new URL(/https?:\/\/\S+/.exec(text)![0]).searchParams.get("token")!;

describe("plantillas de email", () => {
  it("sin edición se manda el texto de fábrica; al editar, el mail sale con el texto nuevo y queda auditado", async () => {
    const adm = await env.admin("admin@test.com", "admin");
    const list = (await env.call("GET", "/admin/emails/templates", adm.cookie)).json();
    expect(list.templates.map((t: { key: string }) => t.key)).toEqual(expect.arrayContaining(["verify", "reset", "plan_confirmed", "welcome"]));
    expect(list.templates.find((t: { key: string }) => t.key === "verify").customized).toBe(false);

    const put = await env.call("PUT", "/admin/emails/templates/plan_confirmed", adm.cookie, { subject: "¡Listo! {{plan}} activo", body: "Gracias por sumarte. Tu plan {{plan}} vence el {{until}}.", enabled: true });
    expect(put.statusCode).toBe(200);
    expect((await lastAudit(conn, "email_template.update")).entity_id).toBe("plan_confirmed");

    const owner = await env.account("dueno@test.com");
    const [biz] = await conn.db.insert(s.businesses).values({ slug: "lupe", ownerId: owner.id, name: "Lupe", status: "published" }).returning();
    const [pay] = await conn.db.insert(s.payments).values({ businessId: biz!.id, planId: "pro", amount: "100", months: 1 }).returning();
    env.mailer.outbox.length = 0;
    expect((await env.call("POST", `/admin/payments/${pay!.id}/confirm`, adm.cookie, {})).statusCode).toBe(200);
    const mail = env.mailer.outbox.find((m) => m.to === "dueno@test.com")!;
    expect(mail.subject).toBe("¡Listo! Pro activo");
    expect(mail.text).toContain("Gracias por sumarte. Tu plan Pro vence el");
    expect(mail.html).toContain("MiShowo");

    await env.call("DELETE", "/admin/emails/templates/plan_confirmed", adm.cookie);
    env.mailer.outbox.length = 0;
    const [pay2] = await conn.db.insert(s.payments).values({ businessId: biz!.id, planId: "pro", amount: "100", months: 1 }).returning();
    await env.call("POST", `/admin/payments/${pay2!.id}/confirm`, adm.cookie, {});
    expect(env.mailer.outbox.find((m) => m.to === "dueno@test.com")!.subject).toBe("¡Tu plan Pro está activo!");
  });

  it("rechaza variables inventadas, y no deja apagar ni vaciar de enlace los mails de acceso", async () => {
    const adm = await env.admin("admin@test.com", "admin");
    const bad = await env.call("PUT", "/admin/emails/templates/plan_confirmed", adm.cookie, tpl({ subject: "Plan {{plan}}", body: "Hola {{hackeo}} {{plan}} {{until}}" }));
    expect(bad.statusCode).toBe(422);
    expect(bad.json()).toMatchObject({ error: "unknown_variables", variables: ["hackeo"] });
    const noLink = await env.call("PUT", "/admin/emails/templates/reset", adm.cookie, { subject: "Reset", body: "Entrá a MiShowo y listo, sin enlace.", enabled: true });
    expect(noLink.json().error).toBe("link_required");
    const off = await env.call("PUT", "/admin/emails/templates/magic", adm.cookie, { subject: "Entrá", body: "Tu enlace: {{link}}", enabled: false });
    expect(off.json().error).toBe("template_locked");
    expect((await env.call("PUT", "/admin/emails/templates/noexiste", adm.cookie, tpl())).statusCode).toBe(404);
    expect((await env.call("PUT", "/admin/emails/templates/welcome", adm.cookie, { subject: "x", body: "corto", enabled: true })).statusCode).toBe(400);
  });

  it("apagar la bienvenida corta ese mail; el de confirmación sigue saliendo siempre", async () => {
    const adm = await env.admin("admin@test.com", "admin");
    await env.call("PUT", "/admin/emails/templates/welcome", adm.cookie, { subject: "Bienvenido", body: "Hola, ya podés publicar.", enabled: false });
    const register = (email: string) => env.app.inject({ method: "POST", url: "/auth/register", headers: { origin: ORIGIN }, payload: { email, password: "claveSegura123", name: "Test", lastName: "Persona", phone: "11 5555-0000" } });
    expect((await register("nueva@test.com")).statusCode).toBe(201);
    const verifyMail = env.mailer.outbox.find((m) => m.to === "nueva@test.com")!;
    expect(verifyMail.subject).toBe("Confirmá tu email en MiShowo");
    env.mailer.outbox.length = 0;
    expect((await env.app.inject({ method: "POST", url: "/auth/verify", headers: { origin: ORIGIN }, payload: { token: tokenFrom(verifyMail.text) } })).statusCode).toBe(200);
    expect(env.mailer.outbox).toHaveLength(0);

    await env.call("PUT", "/admin/emails/templates/welcome", adm.cookie, { subject: "Bienvenido", body: "Hola, ya podés publicar.", enabled: true });
    await register("otra@test.com");
    const t2 = tokenFrom(env.mailer.outbox.find((m) => m.to === "otra@test.com")!.text);
    env.mailer.outbox.length = 0;
    await env.app.inject({ method: "POST", url: "/auth/verify", headers: { origin: ORIGIN }, payload: { token: t2 } });
    expect(env.mailer.outbox.map((m) => m.subject)).toEqual(["Bienvenido"]);
  });

  it("la vista previa escapa el HTML de los datos y la prueba se manda solo a quien la pide", async () => {
    const sup = await env.admin("soporte@test.com", "support");
    const prev = (await env.call("POST", "/admin/emails/templates/contact_ack/preview", sup.cookie, { subject: "Hola", body: "Hola {{name}}, <script>alert(1)</script>" })).json();
    expect(prev.html).not.toContain("<script>");
    expect(prev.html).toContain("&lt;script&gt;");
    expect(render({ subject: "x {{name}}", body: "Hola {{name}}" }, { name: "<b>Ana</b>" }).html).not.toContain("<b>Ana</b>");
    env.mailer.outbox.length = 0;
    const test = await env.call("POST", "/admin/emails/templates/verify/test", sup.cookie, {});
    expect(test.json()).toMatchObject({ ok: true, to: "soporte@test.com" });
    expect(env.mailer.outbox).toHaveLength(1);
    expect(env.mailer.outbox[0]!.subject).toMatch(/^\[PRUEBA\]/);
    // Soporte mira y prueba, pero no edita
    expect((await env.call("PUT", "/admin/emails/templates/welcome", sup.cookie, tpl({ subject: "Hola", body: "Cuerpo de prueba largo" }))).statusCode).toBe(403);
  });

  it("los días del recordatorio de vencimiento se configuran desde el admin", async () => {
    const adm = await env.admin("admin@test.com", "admin");
    const owner = await env.account("dueno@test.com");
    await conn.db.insert(s.businesses).values({ slug: "lupe", ownerId: owner.id, name: "Lupe", status: "published", planId: "pro", planExpiresAt: new Date(Date.now() + 12 * 86_400_000) });
    env.mailer.outbox.length = 0;
    expect(await remindExpiring(conn.db, env.mailer)).toBe(0); // por defecto avisa a 7 días
    expect((await env.call("PUT", "/admin/emails/automation", adm.cookie, { remindDays: 15 })).statusCode).toBe(200);
    expect(await remindExpiring(conn.db, env.mailer)).toBe(1);
    expect(env.mailer.outbox[0]!.subject).toBe("Tu plan de MiShowo está por vencer");
    expect((await env.call("PUT", "/admin/emails/automation", adm.cookie, { remindDays: 0 })).statusCode).toBe(400);
  });
});

describe("comunicados", () => {
  async function seed() {
    const a = await env.account("gratis@test.com"); const b = await env.account("pago@test.com"); const c = await env.account("sinpagina@test.com"); const d = await env.account("baja@test.com");
    for (const u of [a, b, c, d]) await verify(u.id);
    await conn.db.insert(s.businesses).values([
      { slug: "uno", ownerId: a.id, name: "Uno", status: "published", planId: "gratis" },
      { slug: "dos", ownerId: b.id, name: "Dos", status: "published", planId: "pro", planExpiresAt: new Date(Date.now() + 20 * 86_400_000) },
      { slug: "tres", ownerId: d.id, name: "Tres", status: "published", planId: "gratis" },
    ]);
    await conn.pool.query("update users set newsletter_optout_at = now() where id = $1", [d.id]);
    return { a, b, c, d };
  }
  const create = (cookie: string, over: object = {}) => env.call("POST", "/admin/emails/campaigns", cookie, { subject: "Novedades de MiShowo", body: "Hola {{name}}, sumamos turnos.", kind: "novedades", segment: "gratis", ...over });

  it("manda solo al segmento, respeta las bajas en novedades (no en avisos de servicio) y registra cuántos salieron", async () => {
    const adm = await env.admin("admin@test.com", "admin");
    await seed();
    const c = (await create(adm.cookie)).json();
    env.mailer.outbox.length = 0;
    const sent = await env.call("POST", `/admin/emails/campaigns/${c.id}/send`, adm.cookie, {});
    expect(sent.json()).toMatchObject({ sent: 1, failed: 0 });
    expect(env.mailer.outbox.map((m) => m.to)).toEqual(["gratis@test.com"]); // el que se dio de baja no recibe novedades
    expect(env.mailer.outbox[0]!.text).toContain("/baja?token=");
    expect((await env.call("GET", "/admin/emails/campaigns", adm.cookie)).json().campaigns[0]).toMatchObject({ status: "enviado", recipients: 1 });
    expect((await env.call("POST", `/admin/emails/campaigns/${c.id}/send`, adm.cookie, {})).statusCode).toBe(409); // no se reenvía

    const svc = (await create(adm.cookie, { subject: "Aviso importante", kind: "servicio", segment: "gratis" })).json();
    env.mailer.outbox.length = 0;
    await env.call("POST", `/admin/emails/campaigns/${svc.id}/send`, adm.cookie, {});
    expect(env.mailer.outbox.map((m) => m.to).sort()).toEqual(["baja@test.com", "gratis@test.com"]);
    expect(env.mailer.outbox[0]!.text).not.toContain("/baja?token=");
  });

  it("segmentos: pago, sin página y conteos", async () => {
    const adm = await env.admin("admin@test.com", "admin");
    await seed();
    const seg = (await env.call("GET", "/admin/emails/segments", adm.cookie)).json().segments as { key: string; count: number }[];
    const n = (k: string) => seg.find((x) => x.key === k)!.count;
    expect(n("pago")).toBe(1);
    expect(n("sin_pagina")).toBe(1);
    expect(n("gratis")).toBe(2);
    expect(n("equipo")).toBe(1);
  });

  it("programado: sale cuando llega la hora, una sola vez, y se puede cancelar", async () => {
    const adm = await env.admin("admin@test.com", "admin");
    await seed();
    expect((await create(adm.cookie, { scheduledAt: new Date(Date.now() - 3600_000).toISOString() })).json().error).toBe("schedule_in_past");
    const when = new Date(Date.now() + 3600_000);
    const c = (await create(adm.cookie, { scheduledAt: when.toISOString() })).json();
    expect(c.status).toBe("programado");
    const ctx = { db: conn.db, mailer: env.mailer, appUrl: "http://x", secret: "s" };
    env.mailer.outbox.length = 0;
    expect(await sendDueCampaigns(ctx, new Date())).toBe(0);
    expect(env.mailer.outbox).toHaveLength(0);
    // dos corridas simultáneas después de la hora: se manda una sola vez
    const later = new Date(when.getTime() + 60_000);
    const [r1, r2] = await Promise.all([sendDueCampaigns(ctx, later), sendDueCampaigns(ctx, later)]);
    expect(r1 + r2).toBe(1);
    expect(env.mailer.outbox).toHaveLength(1);

    const c2 = (await create(adm.cookie, { scheduledAt: new Date(Date.now() + 7200_000).toISOString() })).json();
    expect((await env.call("POST", `/admin/emails/campaigns/${c2.id}/cancel`, adm.cookie, {})).statusCode).toBe(200);
    env.mailer.outbox.length = 0;
    expect(await sendDueCampaigns(ctx, new Date(Date.now() + 9 * 3600_000))).toBe(0);
    expect((await env.call("POST", `/admin/emails/campaigns/${c2.id}/send`, adm.cookie, {})).statusCode).toBe(409);
  });

  it("soporte no puede crear ni mandar comunicados", async () => {
    const sup = await env.admin("soporte@test.com", "support");
    expect((await create(sup.cookie)).statusCode).toBe(403);
    expect((await env.call("GET", "/admin/emails/campaigns", sup.cookie)).statusCode).toBe(200);
  });

  it("la baja con el enlace firmado funciona; un enlace adulterado no", async () => {
    const { a } = await seed();
    const good = unsubscribeToken(env.config.ADMIN_SECRET_KEY!, a.id);
    const tampered = `${good.slice(0, -1)}${good.endsWith("a") ? "b" : "a"}`;
    expect((await env.app.inject({ method: "POST", url: "/public/unsubscribe", payload: { token: tampered } })).statusCode).toBe(400);
    expect((await conn.pool.query("select newsletter_optout_at from users where id = $1", [a.id])).rows[0].newsletter_optout_at).toBeNull();
    expect((await env.app.inject({ method: "POST", url: "/public/unsubscribe", payload: { token: good } })).statusCode).toBe(200);
    expect((await conn.pool.query("select newsletter_optout_at from users where id = $1", [a.id])).rows[0].newsletter_optout_at).not.toBeNull();
  });
});

describe("bandeja de consultas y alta del equipo", () => {
  it("soporte ve las consultas, responde por email y la consulta queda resuelta con su registro", async () => {
    const sup = await env.admin("soporte@test.com", "support");
    const post = await env.app.inject({ method: "POST", url: "/public/contact", payload: { kind: "contacto", name: "Lupe", email: "lupe@test.com", message: "¿Cómo cambio mi plan?" } });
    expect(post.statusCode).toBe(201);
    const inbox = (await env.call("GET", "/admin/contact", sup.cookie)).json();
    expect(inbox.counts.nuevo).toBe(1);
    const item = inbox.items[0];
    expect(item).toMatchObject({ name: "Lupe", status: "nuevo" });
    env.mailer.outbox.length = 0;
    const rep = await env.call("POST", `/admin/contact/${item.id}/reply`, sup.cookie, { message: "Podés cambiarlo desde Plan y pagos." });
    expect(rep.statusCode).toBe(200);
    expect(env.mailer.outbox[0]).toMatchObject({ to: "lupe@test.com" });
    expect(env.mailer.outbox[0]!.text).toContain("Podés cambiarlo desde Plan y pagos.");
    const after = (await env.call("GET", "/admin/contact?status=resuelto", sup.cookie)).json();
    expect(after.items[0]).toMatchObject({ status: "resuelto" });
    expect(after.items[0].repliedAt).not.toBeNull();
    expect((await lastAudit(conn, "contact.reply")).entity_id).toBe(item.id);
    expect((await patch(`/admin/contact/${item.id}`, sup.cookie, { status: "nuevo", note: "reabrir" })).statusCode).toBe(200);
  });

  it("la bandeja pagina y busca por email, nombre o código; los comodines de SQL se toman literalmente", async () => {
    const sup = await env.admin("soporte@test.com", "support");
    for (let i = 0; i < 30; i++) await conn.db.insert(s.contactRequests).values({ kind: "contacto", name: `Persona ${i}`, email: `p${i}@test.com`, message: "hola" });
    const p1 = (await env.call("GET", "/admin/contact", sup.cookie)).json();
    const p2 = (await env.call("GET", "/admin/contact?page=2", sup.cookie)).json();
    expect(p1.total).toBe(30);
    expect(p1.items).toHaveLength(25);
    expect(p2.items).toHaveLength(5);
    expect(new Set([...p1.items, ...p2.items].map((x: { id: string }) => x.id)).size).toBe(30); // sin repetidos entre páginas
    const byEmail = (await env.call("GET", "/admin/contact?q=p17%40test", sup.cookie)).json();
    expect(byEmail.items.map((x: { email: string }) => x.email)).toEqual(["p17@test.com"]);
    const code = p1.items[3].code as string;
    expect((await env.call("GET", `/admin/contact?q=${code}`, sup.cookie)).json().items.map((x: { code: string }) => x.code)).toEqual([code]);
    expect((await env.call("GET", "/admin/contact?q=%25", sup.cookie)).json().total).toBe(0); // "%" no es comodín
    expect((await env.call("GET", "/admin/contact?page=0", sup.cookie)).statusCode).toBe(400);
  });

  it("los usuarios comunes no ven la bandeja", async () => {
    const u = await env.account("comun@test.com");
    expect((await env.call("GET", "/admin/contact", u.cookie)).statusCode).toBe(403);
  });

  it("el Owner da de alta a un integrante: crea la cuenta, manda la invitación, la persona elige contraseña y entra; nadie más puede invitar", async () => {
    const owner = await env.admin("owner@test.com", "owner");
    const adm = await env.admin("admin@test.com", "admin");
    expect((await env.call("POST", "/admin/admins/invite", adm.cookie, { email: "nuevo@test.com", name: "Sofi", role: "support" })).statusCode).toBe(403);
    env.mailer.outbox.length = 0;
    const res = await env.call("POST", "/admin/admins/invite", owner.cookie, { email: "Nuevo@Test.com", name: "Sofi", role: "support" });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ emailSent: true, existing: false });
    const mail = env.mailer.outbox.find((m) => m.to === "nuevo@test.com")!;
    expect(mail.text).toContain("Soporte");
    expect((await env.app.inject({ method: "POST", url: "/auth/reset", headers: { origin: ORIGIN }, payload: { token: tokenFrom(mail.text), password: "claveNuevaSegura1" } })).statusCode).toBe(200);
    const login = await env.app.inject({ method: "POST", url: "/auth/login", headers: { origin: ORIGIN }, payload: { email: "nuevo@test.com", password: "claveNuevaSegura1" } });
    expect(login.statusCode).toBe(200);
    expect(login.json().user.role).toBe("support");
    expect((await lastAudit(conn, "admin.invite")).after).toMatchObject({ role: "support" });
    expect((await env.call("POST", "/admin/admins/invite", owner.cookie, { email: "nuevo@test.com", name: "Sofi", role: "admin" })).json().error).toBe("already_member");
    expect((await env.call("POST", "/admin/admins/invite", owner.cookie, { email: "owner@test.com", name: "Yo", role: "admin" })).json().error).toBe("is_owner");
    expect((await env.call("POST", "/admin/admins/invite", owner.cookie, { email: "x@test.com", name: "X", role: "owner" })).statusCode).toBe(400);
  });

  it("el Owner escribe al equipo, reenvía invitaciones y reinicia el 2FA; nadie más puede", async () => {
    const owner = await env.admin("owner@test.com", "owner");
    const adm = await env.admin("admin@test.com", "admin");
    await env.call("POST", "/admin/admins/invite", owner.cookie, { email: "sofi@test.com", name: "Sofi", role: "support" });
    const [sofi] = (await conn.pool.query("select id from users where email = 'sofi@test.com'")).rows;
    env.mailer.outbox.length = 0;

    expect((await env.call("POST", `/admin/admins/${sofi.id}/email`, adm.cookie, { subject: "Hola", body: "Reunión mañana" })).statusCode).toBe(403);
    expect((await env.call("POST", `/admin/admins/${sofi.id}/email`, owner.cookie, { subject: "x", body: "" })).statusCode).toBe(400);
    expect((await env.call("POST", `/admin/admins/${sofi.id}/email`, owner.cookie, { subject: "Reunión", body: "Mañana a las 10" })).statusCode).toBe(200);
    expect(env.mailer.outbox.find((m) => m.to === "sofi@test.com")?.subject).toBe("Reunión");
    expect((await lastAudit(conn, "admin.email")).after).toMatchObject({ subject: "Reunión" });

    env.mailer.outbox.length = 0;
    const all = await env.call("POST", "/admin/admins/email", owner.cookie, { subject: "Aviso", body: "Cambia el horario" });
    expect(all.json()).toEqual({ sent: 3, failed: 0 });
    expect(env.mailer.outbox.map((m) => m.to).sort()).toEqual(["admin@test.com", "owner@test.com", "sofi@test.com"]);

    env.mailer.outbox.length = 0;
    const first = tokenFrom((await env.call("POST", `/admin/admins/${sofi.id}/resend-invite`, owner.cookie, {})).statusCode === 200 ? env.mailer.outbox[0]!.text : "");
    expect(first).toBeTruthy();
    expect((await env.call("POST", `/admin/admins/${sofi.id}/resend-invite`, adm.cookie, {})).statusCode).toBe(403);

    await conn.pool.query("update users set totp_secret = 'x', totp_enabled_at = now() where id = $1", [sofi.id]);
    expect((await env.call("POST", `/admin/admins/${sofi.id}/reset-2fa`, owner.cookie, {})).statusCode).toBe(200);
    const row = (await conn.pool.query("select totp_secret, totp_enabled_at from users where id = $1", [sofi.id])).rows[0];
    expect(row).toEqual({ totp_secret: null, totp_enabled_at: null });
    expect((await lastAudit(conn, "admin.reset_2fa")).entity_id ?? (await lastAudit(conn, "admin.reset_2fa")).entityId).toBe(sofi.id);
  });

  it("los mails salen con la identidad de MiShowo: logo, botón naranja con texto tinta, negritas, listas y firma", () => {
    const out = render({ subject: "Hola", body: "Mirá **esto**:\n\n- Uno\n- Dos\n\n{{link}}", cta: "Abrir" }, { link: "https://mishowo.com/x" });
    expect(out.html).toContain("/brand/logo-claro.png");
    expect(out.html).toContain("background:#FC5502");
    expect(out.html).toContain("<strong>esto</strong>");
    expect(out.html).toContain("<li");
    expect(out.html).toContain("Hecho por");
    expect(out.html).not.toContain("#2F6FB0");
    expect(out.text).not.toContain("**");
  });

  it("el equipo crea, edita y borra plantillas propias; solo con permiso de emails y con variables conocidas", async () => {
    const sup = await env.admin("soporte@test.com", "support");
    const adm = await env.admin("admin@test.com", "admin");
    const body = { name: "Promo de fin de mes", subject: "Hola {{name}}, mirá esto", body: "Tenemos una promo para vos, {{name}}.\n\nRespondé este mail." };
    expect((await env.call("POST", "/admin/emails/custom", sup.cookie, body)).statusCode).toBe(403);
    expect((await env.call("POST", "/admin/emails/custom", adm.cookie, { ...body, body: "Hola {{inventada}} esto es largo" })).json().error).toBe("unknown_variables");
    const created = await env.call("POST", "/admin/emails/custom", adm.cookie, body);
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;
    expect((await env.call("GET", "/admin/emails/custom", sup.cookie)).json().templates).toHaveLength(1);
    expect((await env.call("PUT", `/admin/emails/custom/${id}`, adm.cookie, { ...body, name: "Promo de enero" })).statusCode).toBe(200);
    expect((await env.call("GET", "/admin/emails/custom", adm.cookie)).json().templates[0].name).toBe("Promo de enero");
    expect((await lastAudit(conn, "email.custom_update")).after).toMatchObject({ name: "Promo de enero" });
    expect((await env.call("DELETE", `/admin/emails/custom/${id}`, adm.cookie)).statusCode).toBe(200);
    expect((await env.call("GET", "/admin/emails/custom", adm.cookie)).json().templates).toHaveLength(0);
  });
});
