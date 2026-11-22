// Argentina no tiene horario de verano: es UTC-3 todo el año. Toda la lógica de turnos trabaja en esa hora local.
const OFFSET_MS = 3 * 3600_000;

export interface DayHours { open: boolean; from: string; to: string }
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isTime = (t: string) => TIME.test(t);
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Fecha local "YYYY-MM-DD" de hoy en Argentina. */
export const todayAR = (now = new Date()) => new Date(now.getTime() - OFFSET_MS).toISOString().slice(0, 10);

/** Instante UTC de una fecha y hora locales de Argentina. */
export const toInstant = (date: string, time: string) => new Date(`${date}T${time}:00-03:00`);

export const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(toInstant(d, "12:00").getTime()) && toInstant(d, "12:00").toISOString().slice(0, 10) === d;

/** Lunes = 0 ... domingo = 6 (igual que los horarios del negocio). */
export const weekdayIndex = (date: string) => (new Date(`${date}T12:00:00-03:00`).getUTCDay() + 6) % 7;

export const addDays = (date: string, n: number) => new Date(toInstant(date, "12:00").getTime() + n * 86_400_000 - 0).toISOString().slice(0, 10);

/** Franjas ("HH:MM") de un día: desde la apertura, cada `slotMinutes`, mientras la franja termine antes del cierre. */
export function daySlots(date: string, hours: unknown, slotMinutes: number): string[] {
  if (!Array.isArray(hours) || hours.length !== 7) return [];
  const h = hours[weekdayIndex(date)] as DayHours | undefined;
  if (!h || !h.open || !isTime(h.from) || !isTime(h.to)) return [];
  const from = toMin(h.from), to = toMin(h.to);
  if (to <= from) return []; // cierre pasada la medianoche: no se ofrecen turnos
  const out: string[] = [];
  for (let m = from; m + slotMinutes <= to; m += slotMinutes) out.push(fmt(m));
  return out;
}
