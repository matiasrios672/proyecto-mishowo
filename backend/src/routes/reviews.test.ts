import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb } from "../db/testdb.js";
import { ORIGIN, RESET, makeEnv, type Conn } from "../admin/test-helpers.js";
import * as s from "../db/schema.js";

let conn: Conn;
let env: ReturnType<typeof makeEnv>;
beforeAll(async () => { conn = await setupTestDb("mishowo_test_reviews"); env = makeEnv(conn, { REPORTS_PER_MINUTE: "10000" }); });
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query(RESET);
  await conn.db.insert(s.plans).values([{ id: "gratis", name: "Gratis", priceMonthly: "0", limits: {} }, { id: "sinres", name: "Sin reseñas", priceMonthly: "1", limits: { modules: { reviews: false } } }]);
  env.mailer.outbox.length = 0;
});

async function setup(slug = "lupe", email = "dueno@test.com", planId = "gratis") {
  const owner = await env.account(email);
  const [biz] = await conn.db.insert(s.businesses).values({ slug, ownerId: owner.id, name: "Lupe", status: "published", planId }).returning();
  return { owner, biz: biz! };
}
const post = (slug: string, payload: object, ip = "10.0.0.1") => env.app.inject({ method: "POST", url: `/public/sites/${slug}/reviews`, payload, remoteAddress: ip });
const list = async (slug: string) => (await env.app.inject({ method: "GET", url: `/public/sites/${slug}/reviews` })).json();
const patch = (url: string, cookie: string, payload: object) => env.app.inject({ method: "PATCH", url, payload, headers: { cookie, origin: ORIGIN } });

describe("reseñas moderadas", () => {
  it("una reseña nueva queda pendiente: no se ve hasta que el dueño la aprueba, y entonces entra al promedio", async () => {
    const { owner } = await setup();
    const res = await post("lupe", { name: "Ana", rating: 5, comment: "Las mejores empanadas" });
    expect(res.statusCode).toBe(201);
    expect(await list("lupe")).toMatchObject({ count: 0, average: null, items: [] });
    await new Promise((r) => setTimeout(r, 100));
    expect(env.mailer.outbox.find((m) => m.subject.startsWith("Nueva reseña"))!.text).toContain("/panel/resenas");

    const pending = (await env.call("GET", "/me/reviews", owner.cookie)).json();
    expect(pending.counts).toEqual({ pendiente: 1, aprobada: 0, rechazada: 0 });
    const id = pending.items[0].id;
    expect((await patch(`/me/reviews/${id}`, owner.cookie, { status: "aprobada" })).statusCode).toBe(200);
    await post("lupe", { name: "Beto", rating: 4 }, "10.0.0.2");
    const second = (await env.call("GET", "/me/reviews", owner.cookie)).json().items[0].id;
    await patch(`/me/reviews/${second}`, owner.cookie, { status: "aprobada" });
    const pub = await list("lupe");
    expect(pub).toMatchObject({ count: 2, average: 4.5 });
    expect(pub.items.map((i: { name: string }) => i.name).sort()).toEqual(["Ana", "Beto"]);
    expect(JSON.stringify(pub)).not.toMatch(/ipHash|ip_hash|status|pendiente/); // nada interno sale al público
  });

  it("rechazar la saca; el dueño puede responder y la respuesta es pública", async () => {
    const { owner } = await setup();
    await post("lupe", { name: "Ana", rating: 1, comment: "Mal" });
    const id = (await env.call("GET", "/me/reviews", owner.cookie)).json().items[0].id;
    await patch(`/me/reviews/${id}`, owner.cookie, { status: "aprobada" });
    expect((await list("lupe")).count).toBe(1);
    await patch(`/me/reviews/${id}`, owner.cookie, { status: "rechazada" });
    expect((await list("lupe")).count).toBe(0);
    await patch(`/me/reviews/${id}`, owner.cookie, { status: "aprobada", reply: "Gracias, lo vamos a mejorar" });
    expect((await list("lupe")).items[0].reply).toBe("Gracias, lo vamos a mejorar");
    expect((await patch(`/me/reviews/${id}`, owner.cookie, {})).statusCode).toBe(400);
  });

  it("valida los datos, frena a los robots (campo trampa) y no deja repetir desde la misma conexión el mismo día", async () => {
    await setup();
    for (const bad of [{ name: "A", rating: 5 }, { name: "Ana", rating: 6 }, { name: "Ana", rating: 0 }, { name: "Ana", rating: 4.5 }, { name: "Ana", rating: 5, comment: "x".repeat(501) }])
      expect((await post("lupe", bad)).statusCode, JSON.stringify(bad)).toBe(400);
    expect((await post("lupe", { name: "Robot", rating: 5, website: "http://spam.com" }, "10.0.0.9")).statusCode).toBe(201); // se "acepta" sin guardar
    expect((await conn.pool.query("select count(*)::int as n from reviews")).rows[0].n).toBe(0);
    expect((await post("lupe", { name: "Ana", rating: 5 }, "10.0.0.5")).statusCode).toBe(201);
    expect((await post("lupe", { name: "Ana otra vez", rating: 5 }, "10.0.0.5")).json().error).toBe("already_reviewed");
    expect((await post("lupe", { name: "Otra persona", rating: 4 }, "10.0.0.6")).statusCode).toBe(201);
  });

  it("aislamiento: un negocio no ve ni toca las reseñas de otro", async () => {
    const a = await setup("uno", "a@test.com");
    const b = await setup("dos", "b@test.com");
    await post("uno", { name: "Ana", rating: 5 });
    const id = (await env.call("GET", "/me/reviews", a.owner.cookie)).json().items[0].id;
    expect((await env.call("GET", "/me/reviews?status=todas", b.owner.cookie)).json().items).toHaveLength(0);
    expect((await patch(`/me/reviews/${id}`, b.owner.cookie, { status: "aprobada" })).statusCode).toBe(404);
    expect((await env.call("GET", "/me/reviews", undefined as unknown as string)).statusCode).toBe(401);
    expect((await list("uno")).count).toBe(0); // y B no pudo aprobar la de A
  });

  it("sin el módulo del plan, la página no ofrece ni muestra reseñas; un negocio sin publicar tampoco", async () => {
    await setup("sinmodulo", "m@test.com", "sinres");
    expect((await post("sinmodulo", { name: "Ana", rating: 5 })).statusCode).toBe(404);
    expect((await env.app.inject({ method: "GET", url: "/public/sites/sinmodulo/reviews" })).statusCode).toBe(404);
    const owner = await env.account("d@test.com");
    await conn.db.insert(s.businesses).values({ slug: "borrador", ownerId: owner.id, name: "B", status: "draft" });
    expect((await post("borrador", { name: "Ana", rating: 5 })).statusCode).toBe(404);
  });
});
