import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb } from "../db/testdb.js";
import { ORIGIN, RESET, lastAudit, makeEnv, type Conn } from "../admin/test-helpers.js";
import { nudgeLeads } from "../jobs/leads.js";
import * as s from "../db/schema.js";

let conn: Conn;
let env: ReturnType<typeof makeEnv>;
beforeAll(async () => { conn = await setupTestDb("mishowo_test_leads"); env = makeEnv(conn); });
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query(RESET);
  await conn.db.insert(s.plans).values([{ id: "gratis", name: "Gratis", priceMonthly: "0", limits: {} }]);
  env.mailer.outbox.length = 0;
});

const verify = (id: string) => conn.pool.query("update users set email_verified_at = now() where id = $1", [id]);
const age = (id: string, days: number) => conn.pool.query("update users set created_at = now() - make_interval(days => $2) where id = $1", [id, days]);

async function seed() {
  const none = await env.account("sinverificar@test.com");
  const bare = await env.account("sinpagina@test.com"); await verify(bare.id);
  const draft = await env.account("borrador@test.com"); await verify(draft.id);
  const live = await env.account("publicado@test.com"); await verify(live.id);
  await conn.db.insert(s.businesses).values([
    { slug: "borrador", ownerId: draft.id, name: "Panadería Sol", industry: "rotiseria", status: "draft" },
    { slug: "publicado", ownerId: live.id, name: "Luna", industry: "ropa", status: "published" },
  ]);
  return { none, bare, draft, live };
}

describe("leads: registro con origen y etapas", () => {
  it("guarda de dónde llegó la persona y rechaza orígenes raros", async () => {
    const ok = await env.app.inject({ method: "POST", url: "/auth/register", headers: { origin: ORIGIN }, payload: { email: "ig@test.com", password: "claveSegura123", name: "Test", lastName: "Persona", phone: "11 5555-0000", source: "Instagram" } });
    expect(ok.statusCode).toBe(201);
    expect((await conn.pool.query("select signup_source from users where email = 'ig@test.com'")).rows[0].signup_source).toBe("instagram");
    const bad = await env.app.inject({ method: "POST", url: "/auth/register", headers: { origin: ORIGIN }, payload: { email: "x@test.com", password: "claveSegura123", name: "Test", lastName: "Persona", phone: "11 5555-0000", source: "<script>alert(1)</script>" } });
    expect(bad.statusCode).toBe(400);
  });

  it("clasifica cada cuenta por etapa, filtra, busca y no mezcla al equipo", async () => {
    const adm = await env.admin("admin@test.com", "admin");
    await seed();
    const all = (await env.call("GET", "/admin/leads", adm.cookie)).json();
    expect(all.total).toBe(4); // el admin no cuenta como lead
    expect(all.counts).toEqual({ sin_verificar: 1, sin_pagina: 1, borrador: 1, publicado: 1 });
    const byEmail = Object.fromEntries(all.items.map((i: { email: string; stage: string }) => [i.email, i.stage]));
    expect(byEmail).toMatchObject({ "sinverificar@test.com": "sin_verificar", "sinpagina@test.com": "sin_pagina", "borrador@test.com": "borrador", "publicado@test.com": "publicado" });
    const draft = all.items.find((i: { email: string }) => i.email === "borrador@test.com");
    expect(draft).toMatchObject({ businessName: "Panadería Sol", industry: "rotiseria", verified: true });
    expect((await env.call("GET", "/admin/leads?stage=borrador", adm.cookie)).json().items).toHaveLength(1);
    expect((await env.call("GET", "/admin/leads?q=sol", adm.cookie)).json().items.map((i: { email: string }) => i.email)).toEqual(["borrador@test.com"]);
    expect((await env.call("GET", "/admin/leads?q=%25", adm.cookie)).json().total).toBe(0); // "%" es literal
    expect((await env.call("GET", "/admin/leads?stage=inventada", adm.cookie)).statusCode).toBe(400);
    const u = await env.account("comun@test.com");
    expect((await env.call("GET", "/admin/leads", u.cookie)).statusCode).toBe(403);
  });

  it("soporte ve la lista pero no exporta ni manda avisos", async () => {
    const sup = await env.admin("soporte@test.com", "support");
    const { bare } = await seed();
    expect((await env.call("GET", "/admin/leads", sup.cookie)).statusCode).toBe(200);
    expect((await env.call("GET", "/admin/leads.csv", sup.cookie)).statusCode).toBe(403);
    expect((await env.call("POST", `/admin/leads/${bare.id}/nudge`, sup.cookie, {})).statusCode).toBe(403);
  });

  it("el CSV sale con BOM, respeta el filtro, protege contra fórmulas y queda auditado", async () => {
    const adm = await env.admin("admin@test.com", "admin");
    await seed();
    await conn.pool.query("update users set name = $1 where email = 'sinpagina@test.com'", ['=HYPERLINK("http://x.com","clic")']);
    const res = await env.call("GET", "/admin/leads.csv?stage=sin_pagina", adm.cookie);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.body.charCodeAt(0)).toBe(0xfeff);
    const lines = res.body.trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"\'=HYPERLINK(');
    expect(lines[1]).not.toContain("borrador@test.com");
    expect((await lastAudit(conn, "leads.export")).after).toMatchObject({ rows: 1, stage: "sin_pagina" });
  });
});

describe("volver a escribirles", () => {
  it("manda el aviso a mano una vez, no insiste antes de 3 días y no escribe a quien ya publicó o se dio de baja", async () => {
    const adm = await env.admin("admin@test.com", "admin");
    const { bare, live, draft } = await seed();
    await env.call("PUT", "/admin/emails/templates/lead_nudge", adm.cookie, { subject: "¿Seguimos, {{name}}?", body: "Hola {{name}}, retomá tu página: {{link}}", enabled: true });
    env.mailer.outbox.length = 0;
    expect((await env.call("POST", `/admin/leads/${bare.id}/nudge`, adm.cookie, {})).statusCode).toBe(200);
    expect(env.mailer.outbox).toHaveLength(1);
    expect(env.mailer.outbox[0]).toMatchObject({ to: "sinpagina@test.com", subject: "¿Seguimos, Test?" });
    expect(env.mailer.outbox[0]!.text).toContain("/panel");
    expect((await lastAudit(conn, "lead.nudge")).entity_id).toBe(bare.id);
    const again = await env.call("POST", `/admin/leads/${bare.id}/nudge`, adm.cookie, {});
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toBe("too_soon");
    expect(env.mailer.outbox).toHaveLength(1);
    expect((await env.call("POST", `/admin/leads/${live.id}/nudge`, adm.cookie, {})).json().error).toBe("already_published");
    await conn.pool.query("update users set newsletter_optout_at = now() where id = $1", [draft.id]);
    expect((await env.call("POST", `/admin/leads/${draft.id}/nudge`, adm.cookie, {})).json().error).toBe("opted_out");
  });

  it("dos clics seguidos mandan un solo mail", async () => {
    const adm = await env.admin("admin@test.com", "admin");
    const { bare } = await seed();
    await env.call("PUT", "/admin/emails/templates/lead_nudge", adm.cookie, { subject: "¿Seguimos?", body: "Hola {{name}}, retomá: {{link}}", enabled: true });
    env.mailer.outbox.length = 0;
    const [a, b] = await Promise.all([env.call("POST", `/admin/leads/${bare.id}/nudge`, adm.cookie, {}), env.call("POST", `/admin/leads/${bare.id}/nudge`, adm.cookie, {})]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    expect(env.mailer.outbox).toHaveLength(1);
  });

  it("con el mail apagado (viene así de fábrica) no sale nada y la persona no queda marcada como avisada", async () => {
    const adm = await env.admin("admin@test.com", "admin");
    const { bare } = await seed();
    env.mailer.outbox.length = 0;
    const res = await env.call("POST", `/admin/leads/${bare.id}/nudge`, adm.cookie, {});
    expect(res.statusCode).toBe(502);
    expect(env.mailer.outbox).toHaveLength(0);
    expect((await conn.pool.query("select last_nudge_at from users where id = $1", [bare.id])).rows[0].last_nudge_at).toBeNull();
  });

  it("el aviso automático viene apagado; prendido, sale una sola vez a quien confirmó, lleva más de 2 días y no publicó", async () => {
    const adm = await env.admin("admin@test.com", "admin");
    const { none, bare, draft, live } = await seed();
    for (const u of [none, bare, draft, live]) await age(u.id, 5);
    const young = await env.account("nuevo@test.com"); await verify(young.id); // registrado hoy
    env.mailer.outbox.length = 0;
    expect(await nudgeLeads(conn.db, env.mailer, "http://app")).toBe(0); // apagado
    expect(env.mailer.outbox).toHaveLength(0);

    await env.call("PUT", "/admin/emails/templates/lead_nudge", adm.cookie, { subject: "¿Seguimos, {{name}}?", body: "Hola {{name}}, retomá: {{link}}", enabled: true });
    env.mailer.outbox.length = 0;
    const [r1, r2] = await Promise.all([nudgeLeads(conn.db, env.mailer, "http://app"), nudgeLeads(conn.db, env.mailer, "http://app")]);
    expect(r1 + r2).toBe(2);
    expect(env.mailer.outbox.map((m) => m.to).sort()).toEqual(["borrador@test.com", "sinpagina@test.com"]); // ni sin confirmar, ni publicado, ni el de hoy
    expect(await nudgeLeads(conn.db, env.mailer, "http://app")).toBe(0); // una sola vez por persona
    expect(young.id).toBeTruthy();
  });
});
