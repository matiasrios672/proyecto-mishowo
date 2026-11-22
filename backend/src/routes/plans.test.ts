import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { setupTestDb } from "../db/testdb.js";
import * as s from "../db/schema.js";

let conn: Awaited<ReturnType<typeof setupTestDb>>;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  conn = await setupTestDb("mishowo_test_plans");
  await conn.pool.query("truncate table plans cascade");
  await conn.db.insert(s.plans).values([
    { id: "pro", name: "Pro", priceMonthly: "30000" },
    { id: "gratis", name: "Gratis", priceMonthly: "0" },
    { id: "viejo", name: "Viejo", priceMonthly: "5", active: false },
  ]);
  app = buildApp(loadConfig({ NODE_ENV: "test" }), conn.check, conn.db);
});
afterAll(async () => { await conn.pool.end(); });

describe("GET /public/plans", () => {
  it("devuelve los precios de la DB, ordenados, sin planes inactivos", async () => {
    const res = await app.inject({ method: "GET", url: "/public/plans" });
    expect(res.json().map((p: { id: string }) => p.id)).toEqual(["gratis", "pro"]);
    expect(res.json()[1].priceMonthly).toBe(30000);
  });
  it("refleja un cambio de precio hecho en la DB", async () => {
    await conn.pool.query("update plans set price_monthly = 35000 where id = 'pro'");
    const res = await app.inject({ method: "GET", url: "/public/plans" });
    expect(res.json()[1].priceMonthly).toBe(35000);
  });
});
