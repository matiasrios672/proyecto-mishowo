import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { setupTestDb } from "../db/testdb.js";
import { createMemoryMailer } from "../lib/mailer.js";

let conn: Awaited<ReturnType<typeof setupTestDb>>;
let app: ReturnType<typeof buildApp>;
const mailer = createMemoryMailer();

beforeAll(async () => {
  conn = await setupTestDb("mishowo_test_contact");
  app = buildApp(loadConfig({ NODE_ENV: "test", REPORTS_PER_MINUTE: "1000" }), conn.check, conn.db, { mailer });
});
afterAll(async () => { await conn.pool.end(); });

const send = (payload: object) => app.inject({ method: "POST", url: "/public/contact", payload });

describe("POST /public/contact", () => {
  it("registra el arrepentimiento y manda el acuse de recibo con un código", async () => {
    const res = await send({ kind: "arrepentimiento", name: "Ana Pérez", email: "Ana@Test.com", reference: "plan Emprende, pagado el 20/11", message: "Contraté por error" });
    expect(res.statusCode).toBe(201);
    const code = res.json().code as string;
    expect(code).toMatch(/^[0-9a-f]{8}$/);
    const row = (await conn.pool.query("select kind, name, email, status, reference from contact_requests")).rows[0];
    expect(row).toMatchObject({ kind: "arrepentimiento", name: "Ana Pérez", email: "ana@test.com", status: "nuevo" });
    expect(mailer.outbox.at(-1)).toMatchObject({ to: "ana@test.com" });
    expect(mailer.outbox.at(-1)!.text).toContain(code);
    expect(mailer.outbox.at(-1)!.text).toContain("10 días");
  });
  it("si el mail falla el pedido igual queda registrado", async () => {
    const broken = buildApp(loadConfig({ NODE_ENV: "test", REPORTS_PER_MINUTE: "1000" }), conn.check, conn.db, { mailer: { send: async () => { throw new Error("SMTP caído"); } } });
    const before = (await conn.pool.query("select count(*)::int as n from contact_requests")).rows[0].n;
    const res = await broken.inject({ method: "POST", url: "/public/contact", payload: { kind: "contacto", name: "Beto", email: "b@test.com" } });
    expect(res.statusCode).toBe(201);
    expect((await conn.pool.query("select count(*)::int as n from contact_requests")).rows[0].n).toBe(before + 1);
  });
  it("valida los datos", async () => {
    for (const bad of [{ kind: "otro", name: "Ana", email: "a@b.com" }, { kind: "contacto", name: "A", email: "a@b.com" }, { kind: "contacto", name: "Ana", email: "no-es-mail" }, { kind: "contacto", name: "Ana", email: "a@b.com", message: "x".repeat(1001) }])
      expect((await send(bad)).statusCode).toBe(400);
  });
  it("tiene límite por IP", async () => {
    const limited = buildApp(loadConfig({ NODE_ENV: "test", REPORTS_PER_MINUTE: "2" }), conn.check, conn.db, { mailer });
    const codes: number[] = [];
    for (let i = 0; i < 4; i++) codes.push((await limited.inject({ method: "POST", url: "/public/contact", payload: { kind: "contacto", name: "Ana", email: "a@b.com" } })).statusCode);
    expect(codes).toEqual([201, 201, 429, 429]);
  });
});
