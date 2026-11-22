import { describe, expect, it } from "vitest";
import { formatPrice, normalizeSearch, priceLabel, timeAgo } from "./format";

const NOW = new Date("2026-11-22T15:00:00Z").getTime();

describe("timeAgo", () => {
  it("usa unidades legibles", () => {
    expect(timeAgo(NOW - 10_000, NOW)).toBe("recién");
    expect(timeAgo(NOW - 5 * 60_000, NOW)).toBe("hace 5 minutos");
    expect(timeAgo(NOW - 3 * 3600_000, NOW)).toBe("hace 3 horas");
    expect(timeAgo(NOW - 86400_000, NOW)).toBe("ayer");
    expect(timeAgo(NOW - 5 * 86400_000, NOW)).toBe("hace 5 días");
  });
  it("pasado el mes muestra la fecha", () => {
    expect(timeAgo(NOW - 90 * 86400_000, NOW)).toMatch(/\d/);
  });
});

describe("format", () => {
  it("precios en pesos argentinos", () => {
    expect(formatPrice(1800)).toBe("$ 1.800");
    expect(formatPrice(null)).toBe("");
  });
  it("precio 'desde' cuando las opciones difieren", () => {
    expect(priceLabel(1800, [{ price: null }, { price: 10200 }])).toBe("Desde $ 1.800");
    expect(priceLabel(1800, [])).toBe("$ 1.800");
  });
  it("búsqueda sin tildes ni mayúsculas", () => {
    expect(normalizeSearch("  Jamón Y Queso ")).toBe("jamon y queso");
  });
});
