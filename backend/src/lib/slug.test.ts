import { describe, expect, it } from "vitest";
import { checkSlug, normalizeSlug } from "./slug.js";

describe("checkSlug", () => {
  it("acepta slugs válidos", () => {
    expect(checkSlug("empanadas-lupe")).toEqual({ ok: true, slug: "empanadas-lupe" });
    expect(checkSlug("ab1")).toMatchObject({ ok: true });
  });
  it("rechaza reservados", () => {
    for (const s of ["admin", "www", "api", "mishowo"]) expect(checkSlug(s)).toEqual({ ok: false, reason: "reservado" });
  });
  it("rechaza formato inválido", () => {
    for (const s of ["a", "-hola", "hola-", "ho--la", "Hola Mundo", "ñandu", "x".repeat(31)])
      expect(checkSlug(s)).toMatchObject({ ok: false, reason: "formato" });
  });
  it("rechaza palabras prohibidas", () => {
    expect(checkSlug("mundo-porno")).toEqual({ ok: false, reason: "prohibido" });
  });
  it("acepta reservados extra desde el admin", () => {
    expect(checkSlug("marca-x", ["marca-x"])).toEqual({ ok: false, reason: "reservado" });
  });
});

describe("normalizeSlug", () => {
  it("convierte nombres a slug", () => {
    expect(normalizeSlug("Rotisería Doña Ñoña")).toBe("rotiseria-dona-nona");
    expect(normalizeSlug("  --Mi Negocio!!  ")).toBe("mi-negocio");
  });
});
