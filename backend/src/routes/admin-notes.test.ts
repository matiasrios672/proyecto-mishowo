import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb } from "../db/testdb.js";
import { ORIGIN, RESET, lastAudit, makeEnv, type Conn } from "../admin/test-helpers.js";
import * as s from "../db/schema.js";

let conn: Conn;
let env: ReturnType<typeof makeEnv>;
beforeAll(async () => { conn = await setupTestDb("mishowo_test_adminnotes"); env = makeEnv(conn); });
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query(RESET);
  await conn.db.insert(s.plans).values([{ id: "gratis", name: "Gratis", priceMonthly: "0", limits: {} }]);
});

const patch = (url: string, cookie: string, payload: object) => env.app.inject({ method: "PATCH", url, payload, headers: { cookie, origin: ORIGIN } });
const del = (url: string, cookie: string) => env.app.inject({ method: "DELETE", url, headers: { cookie, origin: ORIGIN } });

async function setup() {
  const owner = await env.admin("owner@test.com", "owner");
  const sup = await env.admin("soporte@test.com", "support");
  const client = await env.account("cliente@test.com");
  const [b] = await conn.db.insert(s.businesses).values({ slug: "lupe", ownerId: client.id, name: "Lupe", status: "published", publishedAt: new Date() }).returning();
  return { owner, sup, biz: b! };
}

describe("notas internas del negocio", () => {
  it("cada nota guarda quién la dejó; Soporte puede dejar notas y se ven en la ficha con su autor", async () => {
    const { sup, owner, biz } = await setup();
    expect((await env.call("POST", `/admin/businesses/${biz.id}/notes`, sup.cookie, { body: "" })).statusCode).toBe(400);
    const res = await env.call("POST", `/admin/businesses/${biz.id}/notes`, sup.cookie, { body: "Pidió pasar a Pro" });
    expect(res.statusCode).toBe(201);
    await env.call("POST", `/admin/businesses/${biz.id}/notes`, owner.cookie, { body: "Le escribí por WhatsApp" });

    const detail = (await env.call("GET", `/admin/businesses/${biz.id}`, owner.cookie)).json();
    expect(detail.notes).toHaveLength(2);
    const mine = detail.notes.find((n: { body: string }) => n.body === "Pidió pasar a Pro");
    expect(mine.author).toMatchObject({ id: sup.id, email: "soporte@test.com" });
    expect((await lastAudit(conn, "business.note_add")).actor_id).toBe(owner.id);
    expect(detail.history.some((h: { action: string; actorEmail: string }) => h.action === "business.note_add" && h.actorEmail === "owner@test.com")).toBe(true);
    expect(detail.owner).toMatchObject({ email: "cliente@test.com", lastName: "Persona" });
  });

  it("se pueden fijar; solo la autora o el Owner las borra, y el borrado queda en Auditoría", async () => {
    const { sup, owner, biz } = await setup();
    const sup2 = await env.admin("otra@test.com", "support");
    const id = (await env.call("POST", `/admin/businesses/${biz.id}/notes`, sup.cookie, { body: "Nota de Soporte" })).json().id as string;
    expect((await patch(`/admin/businesses/${biz.id}/notes/${id}`, sup2.cookie, { pinned: true })).statusCode).toBe(200);
    expect((await env.call("GET", `/admin/businesses/${biz.id}`, owner.cookie)).json().notes[0].pinned).toBe(true);

    expect((await del(`/admin/businesses/${biz.id}/notes/${id}`, sup2.cookie)).statusCode).toBe(403); // otra persona de Soporte
    expect((await del(`/admin/businesses/${biz.id}/notes/${id}`, owner.cookie)).statusCode).toBe(200); // el Owner sí
    expect((await lastAudit(conn, "business.note_delete")).before).toMatchObject({ body: "Nota de Soporte", authorId: sup.id });

    const own = (await env.call("POST", `/admin/businesses/${biz.id}/notes`, sup.cookie, { body: "Otra" })).json().id as string;
    expect((await del(`/admin/businesses/${biz.id}/notes/${own}`, sup.cookie)).statusCode).toBe(200); // la autora borra la suya
  });
});
