import { z } from "zod";
import { randomBytes } from "node:crypto";

export interface Service { name: string; minutes: number | null; price: number | null }
export interface Staff { id: string; name: string }

/** Los servicios viejos eran solo el nombre ("Corte"); los nuevos traen duración y precio. Se aceptan los dos. */
export function normServices(raw: unknown): Service[] {
  return (Array.isArray(raw) ? raw : []).flatMap((x): Service[] => {
    if (typeof x === "string") return x.trim() ? [{ name: x.trim(), minutes: null, price: null }] : [];
    if (x && typeof x === "object" && typeof (x as Service).name === "string") {
      const o = x as Partial<Service>;
      return [{ name: o.name!, minutes: typeof o.minutes === "number" ? o.minutes : null, price: typeof o.price === "number" ? o.price : null }];
    }
    return [];
  });
}
export function normStaff(raw: unknown): Staff[] {
  return (Array.isArray(raw) ? raw : []).flatMap((x): Staff[] => (x && typeof x === "object" && typeof (x as Staff).id === "string" && typeof (x as Staff).name === "string" ? [{ id: (x as Staff).id, name: (x as Staff).name }] : []));
}

export const serviceSchema = z.union([
  z.string().trim().min(1).max(60).transform((name): Service => ({ name, minutes: null, price: null })),
  z.object({
    name: z.string().trim().min(1).max(60),
    minutes: z.number().int().min(5).max(480).nullable().default(null),
    price: z.number().min(0).max(10_000_000).nullable().default(null),
  }),
]);
export const staffSchema = z.object({ id: z.string().regex(/^[a-z0-9]{4,12}$/).optional(), name: z.string().trim().min(1).max(60) })
  .transform((s): Staff => ({ id: s.id ?? randomBytes(4).toString("hex"), name: s.name }));

/** ¿El intervalo [a0, a1) se pisa con [b0, b1)? */
export const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

export interface Busy { startsAt: Date; endsAt: Date; staffId: string | null }

/**
 * Cupos libres de un intervalo. Con profesionales: cuántos están libres (y cuáles). Sin profesionales: los cupos por franja que quedan.
 * Un turno viejo sin profesional asignado ocupa un cupo general pero no bloquea a nadie en particular.
 */
export function freeFor(start: number, end: number, busy: Busy[], staff: Staff[], capacity: number): { left: number; staffIds: string[] } {
  const clash = busy.filter((b) => overlaps(start, end, b.startsAt.getTime(), b.endsAt.getTime()));
  if (staff.length === 0) return { left: Math.max(0, capacity - clash.length), staffIds: [] };
  const free = staff.filter((p) => !clash.some((b) => b.staffId === p.id));
  return { left: free.length, staffIds: free.map((p) => p.id) };
}
