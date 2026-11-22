import { describe, expect, it } from "vitest";
import { defaultHours, openStatus, summarizeHours, dayIndex, type Hours } from "./hours";

// 2026-11-23 es lunes
const at = (day: number, hh: number, mm = 0) => new Date(2026, 10, 23 + day, hh, mm);

describe("openStatus", () => {
  const h = defaultHours(); // lunes a sábado 09-18, domingo cerrado

  it("el lunes 23/11/2026 es índice 0", () => {
    expect(dayIndex(at(0, 12))).toBe(0);
    expect(dayIndex(at(6, 12))).toBe(6);
  });
  it("abierto dentro del horario", () => {
    expect(openStatus(h, at(0, 10))).toEqual({ open: true, label: "Abierto ahora · cierra 18:00" });
  });
  it("cerrado fuera de horario: abre hoy o mañana", () => {
    expect(openStatus(h, at(0, 7))?.label).toBe("Cerrado · abre hoy 09:00");
    expect(openStatus(h, at(0, 19))?.label).toBe("Cerrado · abre mañana 09:00");
  });
  it("sábado a la noche, abre el lunes (domingo cerrado)", () => {
    expect(openStatus(h, at(5, 20))?.label).toBe("Cerrado · abre lunes 09:00");
  });
  it("el límite de cierre ya está cerrado y el de apertura abierto", () => {
    expect(openStatus(h, at(0, 18, 0))?.open).toBe(false);
    expect(openStatus(h, at(0, 9, 0))?.open).toBe(true);
  });
  it("cierre pasada la medianoche", () => {
    const night: Hours = defaultHours().map(() => ({ open: true, from: "20:00", to: "02:00" }));
    expect(openStatus(night, at(0, 23))?.open).toBe(true);
    expect(openStatus(night, at(1, 1))?.open).toBe(true); // martes 01:00 viene del lunes
    expect(openStatus(night, at(1, 3))?.open).toBe(false);
  });
  it("sin horarios cargados no muestra nada", () => {
    expect(openStatus(defaultHours().map(() => ({ open: false, from: "09:00", to: "18:00" })), at(0, 10))).toBeNull();
    expect(openStatus(null)).toBeNull();
  });
});

describe("summarizeHours", () => {
  it("agrupa días consecutivos iguales", () => {
    expect(summarizeHours(defaultHours())).toEqual(["Lunes a Sábado: 09:00 a 18:00", "Domingo: cerrado"]);
  });
});
