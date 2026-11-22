import { describe, expect, it } from "vitest";
import { INDUSTRIES } from "./industries.js";
import { THEME_IDS, LAYOUT_IDS, FONT_PAIR_IDS } from "../lib/design.js";

describe("plantillas por rubro", () => {
  it("cubre los rubros del spec y los dos de otro rubro", () => {
    const ids = INDUSTRIES.map((i) => i.id);
    for (const id of ["rotiseria", "ropa", "muebles", "eventos", "gimnasio", "oficios", "belleza", "salud", "otro-productos", "otro-servicios"])
      expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("usa temas, layouts y tipografías que existen", () => {
    for (const i of INDUSTRIES) {
      expect(THEME_IDS).toContain(i.theme);
      expect(LAYOUT_IDS).toContain(i.layout);
      expect(FONT_PAIR_IDS).toContain(i.fontPair);
    }
  });
  it("tiene contenido real: sin lorem ipsum y con productos con precio", () => {
    for (const i of INDUSTRIES) {
      expect(JSON.stringify(i).toLowerCase()).not.toContain("lorem");
      const prods = i.categories.flatMap((c) => c.products);
      expect(prods.length).toBeGreaterThanOrEqual(2);
      for (const p of prods) {
        expect(p.name.length).toBeGreaterThan(2);
        expect(p.price).toBeGreaterThanOrEqual(0);
      }
      expect(i.description.length).toBeLessThanOrEqual(300);
      expect(i.tagline.length).toBeLessThanOrEqual(200);
    }
  });
  it("solo eventos pide fecha del evento", () => {
    expect(INDUSTRIES.filter((i) => i.eventDate).map((i) => i.id)).toEqual(["eventos"]);
  });
});
