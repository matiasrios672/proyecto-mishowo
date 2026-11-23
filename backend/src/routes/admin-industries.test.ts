import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb } from "../db/testdb.js";
import { RESET, lastAudit, makeEnv, type Conn } from "../admin/test-helpers.js";

let conn: Conn;
let env: ReturnType<typeof makeEnv>;
beforeAll(async () => { conn = await setupTestDb("mishowo_test_industries"); env = makeEnv(conn); });
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => { await conn.pool.query(RESET); });

const listPublic = async () => (await env.app.inject({ method: "GET", url: "/public/templates" })).json() as { id: string; name: string; theme: string; layout: string }[];

describe("catálogo de rubros editable", () => {
  it("el equipo cambia nombre, tema y diseño de un rubro y se ve enseguida en el onboarding; volver a vacío lo restaura", async () => {
    const adm = await env.admin("admin@test.com", "admin");
    const before = (await listPublic()).find((t) => t.id === "bar")!;
    const res = await env.call("PUT", "/admin/industries/bar", adm.cookie, { name: "Bares y restaurantes", theme: "nogal", layout: "mostrador", blurb: "Tu carta digital con QR" });
    expect(res.statusCode).toBe(200);
    const after = (await listPublic()).find((t) => t.id === "bar")!;
    expect(after).toMatchObject({ name: "Bares y restaurantes", theme: "nogal", layout: "mostrador" });
    expect(before.name).not.toBe(after.name);
    const one = (await env.app.inject({ method: "GET", url: "/public/templates/bar" })).json();
    expect(one).toMatchObject({ theme: "nogal", name: "Bares y restaurantes" });
    expect(one.categories.length).toBeGreaterThan(2); // el contenido de ejemplo no se toca
    expect((await lastAudit(conn, "industry.update")).entity_id).toBe("bar");

    await env.call("PUT", "/admin/industries/bar", adm.cookie, { name: "", theme: "" });
    expect((await listPublic()).find((t) => t.id === "bar")!.name).toBe(before.name);
  });

  it("un rubro oculto no se ofrece ni se puede abrir, pero «Otro rubro» nunca se puede ocultar", async () => {
    const adm = await env.admin("admin@test.com", "admin");
    expect((await env.call("PUT", "/admin/industries/gimnasio", adm.cookie, { hidden: true })).statusCode).toBe(200);
    expect((await listPublic()).some((t) => t.id === "gimnasio")).toBe(false);
    expect((await env.app.inject({ method: "GET", url: "/public/templates/gimnasio" })).statusCode).toBe(404);
    const locked = await env.call("PUT", "/admin/industries/otro-productos", adm.cookie, { hidden: true });
    expect(locked.statusCode).toBe(422);
    expect(locked.json().error).toBe("always_visible");
    expect((await listPublic()).some((t) => t.id === "otro-productos")).toBe(true);
  });

  it("rechaza valores fuera del catálogo y campos inventados; soporte lo ve pero no lo cambia", async () => {
    const adm = await env.admin("admin@test.com", "admin");
    for (const bad of [{ theme: "fucsia" }, { layout: "cuadrada" }, { fontPair: "comic" }, { name: "x" }, { hackeo: "algo" }, { hidden: "si" }])
      expect((await env.call("PUT", "/admin/industries/bar", adm.cookie, bad)).statusCode, JSON.stringify(bad)).toBe(400);
    expect((await env.call("PUT", "/admin/industries/noexiste", adm.cookie, { name: "Algo" })).statusCode).toBe(404);
    const sup = await env.admin("soporte@test.com", "support");
    const list = (await env.call("GET", "/admin/industries", sup.cookie)).json();
    expect(list.industries.find((i: { id: string }) => i.id === "bar").defaults.name).toBeTruthy();
    expect(list.options.themes).toContain("nogal");
    expect((await env.call("PUT", "/admin/industries/bar", sup.cookie, { name: "Otro nombre" })).statusCode).toBe(403);
  });
});
