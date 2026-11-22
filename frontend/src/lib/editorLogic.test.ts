import { describe, expect, it } from "vitest";
import { createDraftFromTemplate, normalizeDraft, type Draft, type TemplateInput } from "./draft";
import {
  addCategory, addProduct, buildVariants, discountPercent, duplicateProduct, filterProducts, findProduct, importItems,
  isAvailable, moveProduct, moveProductTo, moveProductToCategory, removeCategory, removeExamples, removeProduct, updateProduct,
} from "./draftOps";
import { createHistory, commit, undo, redo, canUndo, canRedo, MAX_HISTORY } from "./history";
import { quality, buildChecklist } from "./score";
import { normalizeWhatsapp, isValidWhatsapp, whatsappLink, formatWhatsapp } from "./whatsapp";
import { dominantColor } from "./color";

const tpl: TemplateInput = {
  id: "x", businessName: "Mi Negocio", tagline: "t", description: "Empanadas", deliveryZone: "Villa Crespo",
  eventDate: false, layout: "mostrador", theme: "blanco", fontPair: "moderna",
  categories: [
    { name: "A", products: [{ name: "Uno", description: "", price: 100 }, { name: "Dos", description: "", price: 200 }] },
    { name: "B", products: [{ name: "Tres", description: "", price: 300 }] },
  ],
};
const mk = (): Draft => createDraftFromTemplate(tpl);
const ids = (d: Draft) => d.categories.flatMap((c) => c.products.map((p) => p.name));

describe("operaciones de productos", () => {
  it("editar saca el producto de Ejemplo y no toca el resto", () => {
    const d = mk();
    const id = d.categories[0]!.products[0]!.id;
    const n = updateProduct(d, id, { price: 150 });
    expect(findProduct(n, id)!.product).toMatchObject({ price: 150, isExample: false });
    expect(n.categories[0]!.products[1]!.isExample).toBe(true);
    expect(d.categories[0]!.products[0]!.price).toBe(100); // inmutable
  });
  it("agregar crea un producto vacío en la categoría pedida (o crea una si no hay)", () => {
    const d = mk();
    const r = addProduct(d, d.categories[1]!.id);
    expect(findProduct(r.draft, r.id)!.category.name).toBe("B");
    const empty = addProduct({ ...d, categories: [] });
    expect(empty.draft.categories).toHaveLength(1);
  });
  it("duplicar inserta la copia justo después, con ids nuevos", () => {
    const d = mk();
    const orig = d.categories[0]!.products[0]!;
    const { draft, id } = duplicateProduct(d, orig.id);
    expect(ids(draft)).toEqual(["Uno", "Uno (copia)", "Dos", "Tres"]);
    expect(id).not.toBe(orig.id);
  });
  it("mover arriba/abajo respeta los bordes", () => {
    const d = mk();
    const [a, b] = d.categories[0]!.products;
    expect(ids(moveProduct(d, a!.id, 1))).toEqual(["Dos", "Uno", "Tres"]);
    expect(ids(moveProduct(d, a!.id, -1))).toEqual(["Uno", "Dos", "Tres"]);
    expect(ids(moveProduct(d, b!.id, 1))).toEqual(["Uno", "Dos", "Tres"]);
  });
  it("arrastrar a otra posición o a otra categoría", () => {
    const d = mk();
    const [a, b] = d.categories[0]!.products;
    const c = d.categories[1]!.products[0]!;
    expect(ids(moveProductTo(d, b!.id, a!.id))).toEqual(["Dos", "Uno", "Tres"]);
    const moved = moveProductTo(d, a!.id, c.id);
    expect(moved.categories[1]!.products.map((p) => p.name)).toEqual(["Uno", "Tres"]);
    const toCat = moveProductToCategory(d, a!.id, d.categories[1]!.id);
    expect(toCat.categories[1]!.products.map((p) => p.name)).toEqual(["Tres", "Uno"]);
    expect(moveProductTo(d, a!.id, a!.id)).toBe(d);
  });
  it("eliminar producto y categoría sin perder productos", () => {
    const d = mk();
    expect(ids(removeProduct(d, d.categories[0]!.products[0]!.id))).toEqual(["Dos", "Tres"]);
    const r = removeCategory(d, d.categories[1]!.id);
    expect(r.categories).toHaveLength(1);
    expect(ids(r)).toEqual(["Uno", "Dos", "Tres"]);
  });
  it("categorías: no duplica ni acepta vacías", () => {
    const d = mk();
    expect(addCategory(d, "  ")).toBe(d);
    expect(addCategory(d, "a")).toBe(d);
    expect(addCategory(d, "Nueva").categories).toHaveLength(3);
  });
  it("quitar ejemplos deja solo lo propio", () => {
    const d = mk();
    const edited = updateProduct(d, d.categories[0]!.products[0]!.id, { name: "Mío" });
    expect(ids(removeExamples(edited))).toEqual(["Mío"]);
  });
  it("búsqueda en nombre y descripción", () => {
    const d = mk();
    expect(filterProducts(d, "tre").map((p) => p.name)).toEqual(["Tres"]);
    expect(filterProducts(d, "").length).toBe(3);
  });
});

describe("variantes, stock y oferta", () => {
  it("2 ejes generan el producto cartesiano y conservan precios existentes", () => {
    const first = buildVariants(["M", "L"], ["Rojo", "Azul"]);
    expect(first.map((o) => o.label)).toEqual(["M / Rojo", "M / Azul", "L / Rojo", "L / Azul"]);
    const edited = first.map((o) => (o.label === "L / Rojo" ? { ...o, price: 999, soldOut: true } : o));
    const again = buildVariants(["M", "L", "XL"], ["Rojo", "Azul"], edited);
    expect(again).toHaveLength(6);
    expect(again.find((o) => o.label === "L / Rojo")).toMatchObject({ price: 999, soldOut: true });
  });
  it("un solo eje, o ninguno", () => {
    expect(buildVariants(["S", "M"], []).map((o) => o.label)).toEqual(["S", "M"]);
    expect(buildVariants([], [])).toEqual([]);
  });
  it("stock 0 deja agotado automáticamente", () => {
    expect(isAvailable({ available: true, stock: 0 })).toBe(false);
    expect(isAvailable({ available: true, stock: 3 })).toBe(true);
    expect(isAvailable({ available: true, stock: null })).toBe(true);
    expect(isAvailable({ available: false, stock: 10 })).toBe(false);
  });
  it("descuento solo si el tachado es mayor", () => {
    expect(discountPercent({ price: 800, comparePrice: 1000 })).toBe(20);
    expect(discountPercent({ price: 1000, comparePrice: 1000 })).toBeNull();
    expect(discountPercent({ price: null, comparePrice: 1000 })).toBeNull();
  });
});

describe("importación masiva", () => {
  it("crea categorías nuevas y reutiliza las existentes sin importar mayúsculas", () => {
    const d = importItems(mk(), [
      { name: "X", description: "", price: 1, category: "a" },
      { name: "Y", description: "", price: 2, category: "Nueva" },
      { name: "Z", description: "", price: null, category: "" },
    ]);
    expect(d.categories.map((c) => c.name)).toEqual(["A", "B", "Nueva", "Productos"]);
    expect(d.categories[0]!.products.at(-1)!.name).toBe("X");
  });
});

describe("historial", () => {
  it("deshacer y rehacer", () => {
    let h = createHistory(1);
    h = commit(h, 2); h = commit(h, 3);
    expect(canUndo(h)).toBe(true);
    h = undo(h); expect(h.present).toBe(2);
    h = undo(h); expect(h.present).toBe(1);
    expect(undo(h)).toBe(h);
    h = redo(h); expect(h.present).toBe(2);
    expect(canRedo(h)).toBe(true);
    h = commit(h, 9); // un cambio nuevo borra el futuro
    expect(canRedo(h)).toBe(false);
  });
  it("agrupa cambios rápidos de la misma clave en un solo paso", () => {
    let h = createHistory("");
    h = commit(h, "h", "name", 1000);
    h = commit(h, "ho", "name", 1200);
    h = commit(h, "hol", "name", 1400);
    expect(h.past).toEqual([""]);
    h = commit(h, "hola!", "name", 5000); // pasó el tiempo: paso nuevo
    expect(h.past).toEqual(["", "hol"]);
    h = commit(h, "otro", "tagline", 5100); // otra clave: paso nuevo
    expect(h.past).toHaveLength(3);
  });
  it("no guarda pasos si no hubo cambio y limita el tamaño", () => {
    const h = createHistory(1);
    expect(commit(h, 1)).toBe(h);
    let big = createHistory(0);
    for (let i = 1; i <= MAX_HISTORY + 50; i++) big = commit(big, i);
    expect(big.past.length).toBe(MAX_HISTORY);
  });
});

describe("WhatsApp argentino", () => {
  it("normaliza formatos comunes", () => {
    for (const s of ["11 5555-0000", "011 5555 0000", "+54 9 11 5555-0000", "54 11 5555 0000", "(011) 5555-0000"])
      expect(normalizeWhatsapp(s)).toBe("5491155550000");
    expect(normalizeWhatsapp("0351 4123456")).toBe("5493514123456");
  });
  it("rechaza números inválidos", () => {
    for (const s of ["", "abc", "1234", "11 5555", "1155550000123456"]) expect(isValidWhatsapp(s)).toBe(false);
  });
  it("arma el link con el texto codificado", () => {
    expect(whatsappLink("11 5555-0000", "Hola & chau")).toBe("https://wa.me/5491155550000?text=Hola%20%26%20chau");
    expect(whatsappLink("x", "hola")).toBeNull();
  });
  it("formatea para mostrar", () => {
    expect(formatWhatsapp("1155550000")).toBe("+54 9 11 5555-0000");
  });
});

describe("score y checklist", () => {
  it("un borrador recién creado no se puede publicar", () => {
    const q = quality(mk());
    expect(q.canPublish).toBe(false);
    expect(q.missingRequired.map((i) => i.id).sort()).toEqual(["name", "products", "whatsapp"]);
    expect(q.score).toBeLessThan(40);
    expect(q.tip).toBeTruthy();
  });
  it("se puede publicar con nombre, WhatsApp y un producto propio", () => {
    let d: Draft = { ...mk(), name: "Panadería Sol", nameIsExample: false, whatsapp: "11 5555-0000" };
    d = updateProduct(d, d.categories[0]!.products[0]!.id, { name: "Pan casero" });
    const q = quality(d);
    expect(q.canPublish).toBe(true);
    expect(q.score).toBeGreaterThan(50);
  });
  it("completar todo da 100", () => {
    let d: Draft = { ...mk(), name: "Panadería Sol", nameIsExample: false, whatsapp: "11 5555-0000", textsAreExample: false,
      description: "Pan casero y facturas todos los días, horneado en el barrio.", instagram: "@panaderiasol" };
    for (const p of d.categories.flatMap((c) => c.products)) d = updateProduct(d, p.id, { name: `Mío ${p.id}`, price: 10 });
    expect(quality(d).score).toBe(100);
    expect(quality(d).tip).toBeNull();
  });
  it("los pesos suman 100 y cada ítem lleva a una pestaña", () => {
    const items = buildChecklist(mk());
    expect(items.reduce((s, i) => s + i.weight, 0)).toBe(100);
    expect(items.every((i) => i.tab)).toBe(true);
  });
});

describe("compatibilidad de borradores viejos", () => {
  it("completa los campos nuevos", () => {
    const old = { ...mk() } as Partial<Draft>;
    delete old.hours; delete old.extraWhatsapps; delete old.announcement; delete old.showQuantities;
    const n = normalizeDraft(old as Draft);
    expect(n.hours).toHaveLength(7);
    expect(n.extraWhatsapps).toEqual([]);
    expect(n.showQuantities).toBe(true);
  });
});

describe("color de marca", () => {
  const px = (r: number, g: number, b: number, a = 255, n = 50) => Array.from({ length: n }).flatMap(() => [r, g, b, a]);
  it("elige el color más presente e ignora blanco, negro, gris y transparente", () => {
    const data = [...px(255, 255, 255, 255, 500), ...px(0, 0, 0, 255, 300), ...px(128, 128, 128, 255, 300), ...px(200, 30, 30, 0, 400), ...px(220, 40, 40), ...px(30, 60, 200, 255, 20)];
    expect(dominantColor(data)).toMatch(/^#D[0-9A-F]2[0-9A-F]2[0-9A-F]$/i);
  });
  it("devuelve null si solo hay fondo neutro", () => {
    expect(dominantColor([...px(255, 255, 255), ...px(10, 10, 10), ...px(120, 120, 120)])).toBeNull();
    expect(dominantColor([])).toBeNull();
  });
});
