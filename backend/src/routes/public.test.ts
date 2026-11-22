import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { setupTestDb } from "../db/testdb.js";
import { tenantScope } from "../db/tenant.js";
import * as s from "../db/schema.js";

let conn: Awaited<ReturnType<typeof setupTestDb>>;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  conn = await setupTestDb("mishowo_test_public");
  const { db } = conn;
  const [u] = await db.insert(s.users).values({ email: "p@test.com" }).returning();
  const mk = (slug: string, status: string, extra: Partial<typeof s.businesses.$inferInsert> = {}) =>
    db.insert(s.businesses).values({ slug, ownerId: u!.id, name: slug, status, ...extra }).returning().then((r) => r[0]!);
  const pub = await mk("lupe-empanadas", "published", { whatsapp: "+5491100000000" });
  await mk("borrador-x", "draft");
  await mk("suspendido-x", "suspended");
  await mk("borrado-x", "published", { deletedAt: new Date() });
  const t = tenantScope(db, pub.id);
  const p = await t.products.create({ name: "Empanada de carne", price: "1800", stock: 0 });
  await t.products.create({ name: "Empanada de JyQ", price: "1800" });
  await t.options.create(p.id, { label: "Docena", price: "18000" });
  app = buildApp(loadConfig({ NODE_ENV: "test" }), conn.check, db);
});
afterAll(async () => { await conn.pool.end(); });

const get = (slug: string) => app.inject({ method: "GET", url: `/public/sites/${slug}` });

describe("GET /public/sites/:slug", () => {
  it("devuelve un negocio publicado con productos", async () => {
    const res = await get("lupe-empanadas");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("published");
    expect(body.products).toHaveLength(2);
    expect(res.headers["cache-control"]).toContain("max-age");
  });

  it("marca como no disponible un producto sin stock", async () => {
    const body = (await get("lupe-empanadas")).json();
    const carne = body.products.find((p: { name: string }) => p.name === "Empanada de carne");
    expect(carne.available).toBe(false);
    expect(carne.options).toHaveLength(1);
  });

  it("no expone datos privados", async () => {
    const body = (await get("lupe-empanadas")).json();
    expect(JSON.stringify(body)).not.toMatch(/ownerId|owner_id|planExpiresAt|deletedAt|p@test\.com/);
  });

  it("404 para borrador, borrado, inexistente o slug inválido", async () => {
    for (const slug of ["borrador-x", "borrado-x", "no-existe", "Mal_Slug"])
      expect((await get(slug)).statusCode).toBe(404);
  });

  it("negocio suspendido avisa sin mostrar contenido", async () => {
    const res = await get("suspendido-x");
    expect(res.json()).toEqual({ status: "suspended", name: "suspendido-x" });
  });
});
