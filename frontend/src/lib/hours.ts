// Horarios estructurados por día. Índice 0 = lunes ... 6 = domingo.
export interface DayHours { open: boolean; from: string; to: string }
export type Hours = DayHours[];

export const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

export function defaultHours(): Hours {
  return DAY_NAMES.map((_, i) => ({ open: i < 6, from: "09:00", to: "18:00" }));
}

export const isValidTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Lunes=0 ... domingo=6 a partir de un Date en hora local. */
export const dayIndex = (d: Date) => (d.getDay() + 6) % 7;

export interface OpenStatus { open: boolean; label: string }

/**
 * "Abierto ahora / Cerrado". Soporta cierre pasada la medianoche (ej. 20:00 a 02:00),
 * mirando también el día anterior.
 */
export function openStatus(hours: Hours | null | undefined, now: Date = new Date()): OpenStatus | null {
  if (!hours || hours.length !== 7 || hours.every((h) => !h.open)) return null;
  const idx = dayIndex(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const today = hours[idx]!;
  const yesterday = hours[(idx + 6) % 7]!;

  if (today.open && isValidTime(today.from) && isValidTime(today.to)) {
    const from = toMin(today.from), to = toMin(today.to);
    if (from < to && minutes >= from && minutes < to) return { open: true, label: `Abierto ahora · cierra ${today.to}` };
    if (from > to && minutes >= from) return { open: true, label: `Abierto ahora · cierra ${today.to}` };
  }
  if (yesterday.open && isValidTime(yesterday.from) && isValidTime(yesterday.to)) {
    const from = toMin(yesterday.from), to = toMin(yesterday.to);
    if (from > to && minutes < to) return { open: true, label: `Abierto ahora · cierra ${yesterday.to}` };
  }

  // Próxima apertura
  for (let i = 0; i < 7; i++) {
    const d = hours[(idx + i) % 7]!;
    if (!d.open || !isValidTime(d.from)) continue;
    if (i === 0 && toMin(d.from) <= minutes) continue;
    const when = i === 0 ? "hoy" : i === 1 ? "mañana" : DAY_NAMES[(idx + i) % 7]!.toLowerCase();
    return { open: false, label: `Cerrado · abre ${when} ${d.from}` };
  }
  return { open: false, label: "Cerrado" };
}

/** Resumen compacto: agrupa días consecutivos con el mismo horario. */
export function summarizeHours(hours: Hours): string[] {
  const lines: string[] = [];
  let i = 0;
  while (i < 7) {
    const h = hours[i]!;
    let j = i;
    while (j + 1 < 7 && hours[j + 1]!.open === h.open && (!h.open || (hours[j + 1]!.from === h.from && hours[j + 1]!.to === h.to))) j++;
    const days = i === j ? DAY_NAMES[i]! : `${DAY_NAMES[i]} a ${DAY_NAMES[j]}`;
    lines.push(`${days}: ${h.open ? `${h.from} a ${h.to}` : "cerrado"}`);
    i = j + 1;
  }
  return lines;
}
