import { describe, expect, it } from "vitest";
import { installmentLine, installmentValue, normalizeInstallments, qualifies } from "./installments";
import { buildOrderMessage } from "./orderMessage";

const on = { enabled: true, count: 6, note: "", minAmount: 0 };

describe("cuotas sin interés", () => {
  it("calcula el valor de cada cuota con centavos", () => {
    expect(installmentValue(189900, 6)).toBe(31650);
    expect(installmentValue(64900, 6)).toBe(10816.67);
  });
  it("arma la línea del producto", () => {
    expect(installmentLine(189900, on)).toBe("6 cuotas sin interés de $ 31.650");
    expect(installmentLine(64900, on)).toBe("6 cuotas sin interés de $ 10.816,67");
  });
  it("no muestra nada si están apagadas, no hay precio o no llega al mínimo", () => {
    expect(installmentLine(1000, { ...on, enabled: false })).toBeNull();
    expect(installmentLine(null, on)).toBeNull();
    expect(installmentLine(0, on)).toBeNull();
    expect(installmentLine(1000, undefined)).toBeNull();
    expect(qualifies({ ...on, minAmount: 20000 }, 19999)).toBe(false);
    expect(qualifies({ ...on, minAmount: 20000 }, 20000)).toBe(true);
  });
  it("normaliza basura a valores seguros", () => {
    expect(normalizeInstallments(undefined)).toEqual({ enabled: false, count: 3, note: "", minAmount: 0 });
    expect(normalizeInstallments({ enabled: "sí", count: 99, note: 5, minAmount: -3 })).toEqual({ enabled: false, count: 3, note: "", minAmount: 0 });
    expect(normalizeInstallments({ enabled: true, count: 12, note: "x".repeat(200), minAmount: 5000.4 })).toMatchObject({ enabled: true, count: 12, minAmount: 5000 });
  });
  it("el mensaje de WhatsApp incluye las cuotas solo si el cliente las pidió", () => {
    const base = { greeting: "Hola!", items: [{ name: "Campera", optionLabel: null, unitPrice: 60000, quantity: 1 }], total: 60000 };
    expect(buildOrderMessage(base)).not.toContain("cuotas");
    expect(buildOrderMessage({ ...base, installments: { count: 3, amount: 20000 } })).toContain("Quiero pagar en 3 cuotas sin interés de $ 20.000");
  });
});
