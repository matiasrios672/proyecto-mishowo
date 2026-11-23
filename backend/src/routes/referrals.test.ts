import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb } from "../db/testdb.js";
import { ORIGIN, RESET, makeEnv, type Conn } from "../admin/test-helpers.js";
import * as s from "../db/schema.js";

let conn: Conn;
let env: ReturnType<typeof makeEnv>;
beforeAll(async () => { conn = await setupTestDb("mishowo_test_referrals"); env = makeEnv(conn); });
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query(RESET);
  await conn.db.insert(s.plans).values([{ id: "gratis", name: "Gratis", priceMonthly: "0", limits: {} }, { id: "pro", name: "Pro", priceMonthly: "100", limits: {} }]);
});

const register = (email: string, extra: object = {}) => env.app.inject({ method: "POST", url: "/auth/register", headers: { origin: ORIGIN }, payload: { email, password: "claveSegura123", ...extra } });

describe("referidos", () => {
  it("cada persona recibe su código (el mismo siempre) y un link para invitar", async () => {
    const a = await env.account("ana@test.com");
    const first = (await env.call("GET", "/me/referral", a.cookie)).json();
    expect(first.code).toMatch(/^[a-z0-9]{8}$/);
    expect(first.link).toContain(`/?ref=${first.code}`);
    expect(first).toMatchObject({ invited: 0, withPage: 0, published: 0, paid: 0 });
    expect((await env.call("GET", "/me/referral", a.cookie)).json().code).toBe(first.code);
    expect((await env.call("GET", "/me/referral", undefined as unknown as string)).statusCode).toBe(401);
  });

  it("quien se registra con el código queda atribuido, y se cuenta cuántos publicaron y pagaron", async () => {
    const a = await env.account("ana@test.com");
    const { code } = (await env.call("GET", "/me/referral", a.cookie)).json();
    const b = await register("beto@test.com", { ref: code });
    const c = await register("carla@test.com", { ref: code.toUpperCase() });
    await register("dani@test.com"); // sin código
    expect(b.statusCode).toBe(201);
    expect(c.statusCode).toBe(201);
    const row = (await conn.pool.query("select signup_source, referred_by from users where email = 'beto@test.com'")).rows[0];
    expect(row.signup_source).toBe("referido");
    const [ana] = await conn.db.select().from(s.users).then((r) => r.filter((u) => u.email === "ana@test.com"));
    expect(row.referred_by).toBe(ana!.id);

    const beto = await conn.pool.query("select id from users where email = 'beto@test.com'");
    const carla = await conn.pool.query("select id from users where email = 'carla@test.com'");
    await conn.db.insert(s.businesses).values([
      { slug: "beto", ownerId: beto.rows[0].id, name: "Beto", status: "published", planId: "pro" },
      { slug: "carla", ownerId: carla.rows[0].id, name: "Carla", status: "draft" },
    ]);
    expect((await env.call("GET", "/me/referral", a.cookie)).json()).toMatchObject({ invited: 2, withPage: 2, published: 1, paid: 1 });
  });

  it("un código inventado o mal escrito no impide registrarse, y nadie se invita a sí mismo", async () => {
    expect((await register("uno@test.com", { ref: "zzzzzzzz" })).statusCode).toBe(201);
    expect((await register("dos@test.com", { ref: "no es un código" })).statusCode).toBe(400);
    expect((await conn.pool.query("select referred_by from users where email = 'uno@test.com'")).rows[0].referred_by).toBeNull();
    const a = await env.account("ana@test.com");
    const { code } = (await env.call("GET", "/me/referral", a.cookie)).json();
    expect((await register("ana@test.com", { ref: code })).statusCode).toBe(409); // ya existe: no se puede "reinvitar" una cuenta
  });

  it("el equipo ve quiénes invitan más; una persona común no", async () => {
    const adm = await env.admin("admin@test.com", "admin");
    const a = await env.account("ana@test.com");
    const { code } = (await env.call("GET", "/me/referral", a.cookie)).json();
    await register("beto@test.com", { ref: code });
    await register("carla@test.com", { ref: code });
    const res = (await env.call("GET", "/admin/referrals", adm.cookie)).json();
    expect(res.totalReferred).toBe(2);
    expect(res.top[0]).toMatchObject({ email: "ana@test.com", invited: 2 });
    expect((await env.call("GET", "/admin/referrals", a.cookie)).statusCode).toBe(403);
  });
});
