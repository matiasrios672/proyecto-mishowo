// Deshacer / rehacer genérico. `commit` agrupa cambios seguidos del mismo `key` (ej. tipear en un campo)
// para que un solo "deshacer" revierta toda la escritura y no letra por letra.
export interface History<T> { past: T[]; present: T; future: T[]; lastKey: string | null; lastAt: number }

export const MAX_HISTORY = 100;
export const COALESCE_MS = 1000;

export const createHistory = <T,>(present: T): History<T> => ({ past: [], present, future: [], lastKey: null, lastAt: 0 });

export function commit<T>(h: History<T>, next: T, key: string | null = null, now = Date.now()): History<T> {
  if (Object.is(next, h.present)) return h;
  const coalesce = key !== null && key === h.lastKey && now - h.lastAt < COALESCE_MS && h.past.length > 0;
  const past = coalesce ? h.past : [...h.past, h.present].slice(-MAX_HISTORY);
  return { past, present: next, future: [], lastKey: key, lastAt: now };
}

export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h;
  const prev = h.past[h.past.length - 1]!;
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future], lastKey: null, lastAt: 0 };
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h;
  const [next, ...rest] = h.future as [T, ...T[]];
  return { past: [...h.past, h.present], present: next, future: rest, lastKey: null, lastAt: 0 };
}

export const canUndo = <T,>(h: History<T>) => h.past.length > 0;
export const canRedo = <T,>(h: History<T>) => h.future.length > 0;
