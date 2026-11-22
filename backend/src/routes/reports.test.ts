import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { setupTestDb } from "../db/testdb.js";
import * as s from "../db/schema.js";

let conn: Awaited<ReturnType<typeof setupTestDb>>;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  conn = await setupTestDb("mishowo_test_reports");
  await conn.pool.query("truncate table reports cascade");
  const [u] = await conn.db.insert(s.users).values({ email: "r@test.com" }).returning();
  await conn.db.insert(s.businesses).values({ slug: "denunciado", ownerId: u!.id, name: "D", status: "published" });
  app = buildApp(loadConfig({ NODE_ENV: "test", REPORTS_PER_MINUTE: "1000" }), conn.check, conn.db);
});
afterAll(async () => { await conn.pool.end(); });

const report = (payload: object) => app.inject({ method: "POST", url: "/public/reports", payload });

describe("POST /public/reports", () => {
  it("registra la denuncia", async () => {
    const res = await report({ slug: "denunciado", reason: "estafa", detail: "Pide transferencia y no entrega" });
    expect(res.statusCode).toBe(201);
    const rows = (await conn.pool.query("select reason, detail, status from reports")).rows;
    expect(rows).toEqual([{ reason: "estafa", detail: "Pide transferencia y no entrega", status: "nuevo" }]);
  });
  it("valida motivo, largo y negocio", async () => {
    expect((await report({ slug: "denunciado", reason: "inventado" })).statusCode).toBe(400);
    expect((await report({ slug: "denunciado", reason: "otro", detail: "x".repeat(501) })).statusCode).toBe(400);
    expect((await report({ slug: "no-existe", reason: "otro" })).statusCode).toBe(404);
  });
  it("tiene límite por IP", async () => {
    const limited = buildApp(loadConfig({ NODE_ENV: "test", REPORTS_PER_MINUTE: "2" }), conn.check, conn.db);
    const codes: number[] = [];
    for (let i = 0; i < 4; i++) codes.push((await limited.inject({ method: "POST", url: "/public/reports", payload: { slug: "denunciado", reason: "otro" } })).statusCode);
    expect(codes).toEqual([201, 201, 429, 429]);
  });
});
