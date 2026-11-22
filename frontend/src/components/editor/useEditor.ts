"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveDraft, type Draft } from "@/lib/draft";
import { canRedo, canUndo, commit, createHistory, redo as redoH, undo as undoH, type History } from "@/lib/history";

export type SaveState = { kind: "saved"; at: number } | { kind: "saving" } | { kind: "error" };

const SAVE_DELAY = 500;

/** Estado del editor: historial (deshacer/rehacer) + autoguardado en localStorage con indicador. */
export function useEditor(initial: Draft) {
  const [history, setHistory] = useState<History<Draft>>(() => createHistory(initial));
  const [save, setSave] = useState<SaveState>(() => ({ kind: "saved", at: Date.now() }));
  const [now, setNow] = useState(() => Date.now());
  const first = useRef(true);
  const draft = history.present;

  // Autoguardado con retardo: agrupa ráfagas de cambios en un solo guardado.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => {
      setSave(saveDraft(draft) ? { kind: "saved", at: Date.now() } : { kind: "error" });
    }, SAVE_DELAY);
    return () => clearTimeout(t);
  }, [draft]);

  // Reloj para "Guardado hace X s".
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const update = useCallback((fn: (d: Draft) => Draft, key: string | null = null) => {
    setSave((s) => (s.kind === "saving" ? s : { kind: "saving" }));
    setHistory((h) => commit(h, fn(h.present), key));
  }, []);
  const undo = useCallback(() => { setSave({ kind: "saving" }); setHistory(undoH); }, []);
  const redo = useCallback(() => { setSave({ kind: "saving" }); setHistory(redoH); }, []);

  return { draft, update, undo, redo, canUndo: canUndo(history), canRedo: canRedo(history), save, now };
}

export function saveLabel(s: SaveState, now: number): string {
  if (s.kind === "saving") return "Guardando…";
  if (s.kind === "error") return "No se pudo guardar en este dispositivo";
  const sec = Math.max(0, Math.round((now - s.at) / 1000));
  if (sec < 5) return "Guardado";
  if (sec < 60) return `Guardado hace ${sec} s`;
  return `Guardado hace ${Math.floor(sec / 60)} min`;
}
