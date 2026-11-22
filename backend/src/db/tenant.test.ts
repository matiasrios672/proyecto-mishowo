import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDb } from "./testdb.js";
import { tenantScope } from "./tenant.js";
import * as s from "./schema.js";

let conn: Awaited<ReturnType<typeof setupTestDb>>;
let A: ReturnType<typeof tenantScope>;
let B: ReturnType<typeof tenantScope>;
let bizA: string, bizB: string;

beforeAll(async () => {
  conn = await setupTestDb();
  const { db } = conn;
  const [u] = await db.insert(s.users).values({ email: "dueno@test.com" }).returning();
  const [a] = await db.insert(s.businesses).values({ slug: "negocio-a", ownerId: u!.id, name: "Negocio A" }).returning();
  const [b] = await db.insert(s.businesses).values({ slug: "negocio-b", ownerId: u!.id, name: "Negocio B" }).returning();
  bizA = a!.id; bizB = b!.id;
  A = tenantScope(db, bizA);
  B = tenantScope(db, bizB);
});
afterAll(async () => { await conn.pool.end(); });

describe("aislamiento por tenant", () => {
  it("A no ve productos de B", async () => {
    await A.products.create({ name: "Empanada A" });
    const pb = await B.products.create({ name: "Remera B" });
    expect((await A.products.list()).map((p) => p.name)).toEqual(["Empanada A"]);
    expect(await A.products.get(pb.id)).toBeNull();
  });

  it("A no puede modificar ni borrar productos de B", async () => {
    const pb = (await B.products.list())[0]!;
    expect(await A.products.update(pb.id, { name: "hackeado" })).toBeNull();
    await A.products.remove(pb.id);
    expect((await B.products.get(pb.id))?.name).toBe("Remera B");
  });

  it("una escritura siempre queda en el negocio del scope", async () => {
    const p = await A.products.create({ name: "Otro A", businessId: bizB } as never);
    expect(p.businessId).toBe(bizA);
  });

  it("no se puede usar una categoría de otro negocio", async () => {
    const catB = await B.categories.create({ name: "Ropa" });
    await expect(A.products.create({ name: "X", categoryId: catB.id })).rejects.toThrow(/no pertenece/);
    const pa = (await A.products.list())[0]!;
    await expect(A.products.update(pa.id, { categoryId: catB.id })).rejects.toThrow(/no pertenece/);
  });

  it("no se pueden crear opciones sobre productos de otro negocio", async () => {
    const pb = (await B.products.list())[0]!;
    await expect(A.options.create(pb.id, { label: "XL" })).rejects.toThrow(/no pertenece/);
  });

  it("los pedidos están aislados", async () => {
    const { db } = conn;
    const [o] = await db.insert(s.orders).values({ businessId: bizB, number: 1, total: "100" }).returning();
    expect(await A.orders.list()).toHaveLength(0);
    expect(await A.orders.get(o!.id)).toBeNull();
    expect(await A.orders.setStatus(o!.id, "cancelado")).toBeNull();
    expect((await B.orders.get(o!.id))?.status).toBe("nuevo");
  });

  it("el slug es único", async () => {
    const { db } = conn;
    const [u] = await db.select().from(s.users);
    await expect(db.insert(s.businesses).values({ slug: "negocio-a", ownerId: u!.id, name: "Dup" })).rejects.toThrow();
  });
});
