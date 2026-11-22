import { describe, expect, it } from "vitest";
import { siteHost, siteUrl, suggestSlug } from "./siteUrl";

describe("suggestSlug", () => {
  it("convierte nombres reales en links", () => {
    expect(suggestSlug("Rotisería Doña Marta")).toBe("rotiseria-dona-marta");
    expect(suggestSlug("  Panadería del Sol!! ")).toBe("panaderia-del-sol");
    expect(suggestSlug("Lic. Sofía Benítez · Nutrición")).toBe("lic-sofia-benitez-nutricion");
  });
  it("corta a 30 caracteres sin dejar un guion al final", () => {
    const s = suggestSlug("Empanadas caseras de la abuela Lupe de Villa Crespo");
    expect(s.length).toBeLessThanOrEqual(30);
    expect(s.endsWith("-")).toBe(false);
  });
  it("sin letras ni números queda vacío", () => {
    expect(suggestSlug("¿¿??")).toBe("");
  });
});

describe("siteUrl", () => {
  it("arma la URL pública y el host sin puerto", () => {
    expect(siteUrl("lupe")).toMatch(/^https?:\/\/lupe\./);
    expect(siteHost("lupe")).toMatch(/^lupe\.[a-z.]+$/);
  });
});
