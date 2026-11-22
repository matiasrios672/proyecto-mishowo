import { describe, expect, it } from "vitest";
import { THEMES, contrast, themeStyle, readableOn } from "./themes";

describe("temas de color", () => {
  it("hay al menos 9 temas con ids únicos", () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(9);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
  });

  for (const t of THEMES) {
    it(`${t.name}: contraste AA (>=4.5) en texto, botón y texto secundario`, () => {
      expect(contrast(t.fg, t.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.primaryFg, t.primary)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.mutedFg, t.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.mutedFg, t.muted)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("el color de marca reemplaza el primario y elige texto legible", () => {
    const s = themeStyle("blanco", "#FFD60A") as Record<string, string>;
    expect(s["--primary"]).toBe("#FFD60A");
    expect(contrast(s["--primary-foreground"]!, "#FFD60A")).toBeGreaterThanOrEqual(4.5);
    expect(readableOn("#000000")).toBe("#FFFFFF");
  });

  it("ignora un color de marca inválido", () => {
    const s = themeStyle("blanco", "rojo") as Record<string, string>;
    expect(s["--primary"]).toBe("#171717");
  });
});
