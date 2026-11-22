import { describe, expect, it } from "vitest";
import { parsePrice, parseCsv, parsePastedList, splitCsvLine } from "./bulk";

describe("parsePrice", () => {
  it("entiende el formato argentino", () => {
    expect(parsePrice("$ 1.800")).toBe(1800);
    expect(parsePrice("18.000")).toBe(18000);
    expect(parsePrice("1.234.567")).toBe(1234567);
    expect(parsePrice("1800,50")).toBe(1800.5);
    expect(parsePrice("1.800,50")).toBe(1800.5);
    expect(parsePrice("1800")).toBe(1800);
  });
  it("devuelve null si no hay número", () => {
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("consultar")).toBeNull();
  });
});

describe("splitCsvLine", () => {
  it("respeta comillas y comas internas", () => {
    expect(splitCsvLine('Empanada,"Carne, cebolla y huevo",1800', ",")).toEqual(["Empanada", "Carne, cebolla y huevo", "1800"]);
    expect(splitCsvLine('a;"b ""c"" d";3', ";")).toEqual(["a", 'b "c" d', "3"]);
  });
});

describe("parseCsv", () => {
  it("lee columnas por nombre, en cualquier orden, con coma o punto y coma", () => {
    const r = parseCsv("precio;nombre;categoría\n1.800;Empanada de carne;Empanadas\n2000;Tarta;Platos");
    expect(r.errors).toEqual([]);
    expect(r.items).toEqual([
      { name: "Empanada de carne", description: "", price: 1800, category: "Empanadas" },
      { name: "Tarta", description: "", price: 2000, category: "Platos" },
    ]);
  });
  it("avisa filas sin nombre y archivo sin columna nombre", () => {
    expect(parseCsv("nombre,precio\n,100\nOk,200").errors).toHaveLength(1);
    expect(parseCsv("foo,bar\n1,2").errors[0]).toMatch(/nombre/);
    expect(parseCsv("").errors[0]).toMatch(/vacío/);
  });
});

describe("parsePastedList", () => {
  it("acepta varios formatos y categorías", () => {
    const r = parsePastedList("Empanadas:\n- Carne - 1800\n- Jamón y queso $1.700\nPlatos:\nMilanesa, 9500");
    expect(r.errors).toEqual([]);
    expect(r.items.map((i) => [i.name, i.price, i.category])).toEqual([
      ["Carne", 1800, "Empanadas"],
      ["Jamón y queso", 1700, "Empanadas"],
      ["Milanesa", 9500, "Platos"],
    ]);
  });
  it("conserva productos sin precio y lo avisa", () => {
    const r = parsePastedList("Torta del día");
    expect(r.items[0]).toMatchObject({ name: "Torta del día", price: null });
    expect(r.errors).toHaveLength(1);
  });
});
