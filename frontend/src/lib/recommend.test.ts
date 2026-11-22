import { describe, expect, it } from "vitest";
import { createDraftFromTemplate, type Draft, type TemplateInput } from "./draft";
import { addProduct } from "./draftOps";
import { recommendLayout } from "./recommend";

const base = (id: string, n = 3, options = false): Draft => {
  const tpl: TemplateInput = {
    id, businessName: "x", tagline: "", description: "", deliveryZone: "", eventDate: false, layout: "vidriera", theme: "blanco", fontPair: "moderna",
    categories: [{ name: "A", products: Array.from({ length: n }, (_, i) => ({ name: `P${i}`, description: "", price: 1, options: options ? [{ label: "M" }] : undefined })) }],
  };
  return createDraftFromTemplate(tpl);
};

describe("recommendLayout", () => {
  it("servicios para rubros de servicios", () => {
    for (const id of ["gimnasio", "oficios", "belleza", "salud", "otro-servicios"]) expect(recommendLayout(base(id))).toBe("servicios");
  });
  it("grilla para ropa o catálogos con variantes", () => {
    expect(recommendLayout(base("ropa"))).toBe("grilla");
    expect(recommendLayout(base("otro-productos", 6, true))).toBe("grilla");
  });
  it("vidriera con pocos productos, mostrador con muchos", () => {
    expect(recommendLayout(base("muebles", 4))).toBe("vidriera");
    expect(recommendLayout(base("muebles", 15))).toBe("mostrador");
    let d = base("muebles", 20);
    d = addProduct(d).draft;
    expect(recommendLayout(d)).toBe("mostrador");
  });
});
