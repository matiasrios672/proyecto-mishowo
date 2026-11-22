import { describe, expect, it } from "vitest";
import { addItem, emptyCart, parseCart, quantityOf, removeItem, setQuantity, totals, MAX_QTY } from "./cart";
import { buildOrderMessage, formatEventDate, orderErrorMessage } from "./orderMessage";

const emp = { productId: "p1", optionId: null, name: "Empanada", optionLabel: null, unitPrice: 1800 };
const doc = { productId: "p2", optionId: "o1", name: "Carne", optionLabel: "Docena", unitPrice: 19200 };

describe("carrito", () => {
  it("agrega, suma cantidades del mismo ítem y distingue opciones", () => {
    let c = addItem(emptyCart(), emp);
    c = addItem(c, emp, 2);
    c = addItem(c, doc);
    c = addItem(c, { ...doc, optionId: "o2", optionLabel: "Media" });
    expect(c.items).toHaveLength(3);
    expect(quantityOf(c, "p1", null)).toBe(3);
    expect(quantityOf(c, "p2", "o2")).toBe(1);
    expect(quantityOf(c, "zzz", null)).toBe(0);
  });
  it("cantidad 0 elimina y hay tope máximo", () => {
    let c = addItem(emptyCart(), emp, 2);
    const key = c.items[0]!.key;
    expect(setQuantity(c, key, 0).items).toHaveLength(0);
    expect(setQuantity(c, key, 500).items[0]!.quantity).toBe(MAX_QTY);
    c = addItem(c, emp, 500);
    expect(c.items[0]!.quantity).toBe(MAX_QTY);
    expect(removeItem(c, key).items).toHaveLength(0);
  });
  it("calcula totales sin errores de decimales y avisa si hay productos sin precio", () => {
    let c = addItem(emptyCart(), { ...emp, unitPrice: 0.1 }, 3);
    expect(totals(c).total).toBe(0.3);
    c = addItem(c, { ...doc, unitPrice: null });
    expect(totals(c)).toEqual({ count: 4, total: 0.3, hasUnpriced: true });
  });
  it("no se deja engañar por datos corruptos en localStorage", () => {
    expect(parseCart(null).items).toEqual([]);
    expect(parseCart("{roto").items).toEqual([]);
    expect(parseCart(JSON.stringify({ items: [{ productId: "a", name: "x", quantity: -1 }] })).items).toEqual([]);
    expect(parseCart(JSON.stringify({ items: [{ productId: "a", name: "x", quantity: 2, unitPrice: 5 }] })).items[0]!.quantity).toBe(2);
  });
});

describe("mensaje de WhatsApp", () => {
  const items = [
    { name: "Empanada de carne", optionLabel: "Docena", unitPrice: 19200, quantity: 2 },
    { name: "Tarta", optionLabel: null, unitPrice: 6200, quantity: 1 },
  ];
  it("arma el pedido completo", () => {
    const m = buildOrderMessage({ greeting: "Hola! Quiero hacer este pedido:", number: 12, items, total: 44600, customerName: "Ana", notes: "Sin cebolla", eventDate: "2026-12-25" });
    expect(m).toContain("Hola! Quiero hacer este pedido:");
    expect(m).toContain("*Pedido #12*");
    expect(m).toContain("• 2 x Empanada de carne (Docena)");
    expect(m).toContain("• 1 x Tarta —");
    expect(m).toContain("*Total:");
    expect(m).toContain("Fecha del evento: 25/12/2026");
    expect(m).toContain("Nombre: Ana");
    expect(m).toContain("Notas: Sin cebolla");
  });
  it("omite lo que no hay y usa el saludo por defecto", () => {
    const m = buildOrderMessage({ greeting: "  ", items: [items[1]!], total: 6200 });
    expect(m.startsWith("Hola! Quiero hacer este pedido:")).toBe(true);
    expect(m).not.toContain("Pedido #");
    expect(m).not.toContain("Nombre:");
    expect(m).not.toContain("Notas:");
  });
  it("marca los productos a consultar", () => {
    const m = buildOrderMessage({ greeting: "Hola", items: [{ name: "Torta", optionLabel: null, unitPrice: null, quantity: 1 }], total: 0, hasUnpriced: true });
    expect(m).toContain("a consultar");
    expect(m).toContain("más los productos a consultar");
  });
  it("formatea la fecha sin corrimientos de zona horaria", () => {
    expect(formatEventDate("2026-01-01")).toBe("01/01/2026");
    expect(formatEventDate("basura")).toBe("basura");
  });
  it("traduce los errores de la API a mensajes claros", () => {
    for (const code of ["out_of_stock", "unavailable", "option_required", "event_date_required", "unavailable_business", "x", undefined])
      expect(orderErrorMessage(code)).toMatch(/\S/);
    expect(orderErrorMessage("out_of_stock")).toMatch(/stock/);
  });
  it("el mensaje incluye el cupón y el descuento que calculó el servidor", () => {
    const m = buildOrderMessage({ greeting: "Hola", number: 3, items: [{ name: "Pan", optionLabel: null, unitPrice: 1000, quantity: 2 }], total: 1800, couponCode: "VERANO10", discount: 200 });
    expect(m).toContain("Cupón VERANO10: -");
    expect(m).toMatch(/Total: .*1.800/);
    expect(buildOrderMessage({ greeting: "Hola", items: [], total: 0, couponCode: "X", discount: 0 })).not.toContain("Cupón");
  });
  it("traduce los errores de cupón", () => {
    expect(orderErrorMessage("coupon_invalid")).toMatch(/cupón/);
    expect(orderErrorMessage("coupon_min_purchase")).toMatch(/mínimo/);
  });
});
