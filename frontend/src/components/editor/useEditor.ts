"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveDraft, type Draft } from "@/lib/draft";
import { canRedo, canUndo, commit, createHistory, redo as redoH, undo as undoH, type History } from "@/lib/history";
import { pushDraft, setSyncMarker } from "@/lib/serverSync";
import { createSyncEngine, type SyncEngine, type SyncState } from "@/lib/syncEngine";

export type SaveState = { kind: "saved"; at: number } | { kind: "saving" } | { kind: "error" };
export interface SyncConfig { userId: string; initialVersion: number | null }

const SAVE_DELAY = 500;

/**
 * Estado del editor: historial (deshacer/rehacer) + autoguardado en este dispositivo y, si hay sesión,
 * sincronización con la cuenta (con detección de ediciones simultáneas desde otro dispositivo).
 */
export function useEditor(initial: Draft, sync?: SyncConfig) {
  const [history, setHistory] = useState<History<Draft>>(() => createHistory(initial));
  const [save, setSave] = useState<SaveState>(() => ({ kind: "saved", at: Date.now() }));
  const [syncState, setSyncState] = useState<SyncState>({ kind: "idle" });
  const [now, setNow] = useState(() => Date.now());
  const first = useRef(true);
  const locked = useRef(false); // al cerrar sesión se frena todo guardado local para no dejar datos en la compu
  const engineRef = useRef<SyncEngine<Draft> | null>(null);
  const draft = history.present;
  const draftRef = useRef(draft);
  const initialRef = useRef({ draft: initial, version: sync?.initialVersion ?? null });

  useEffect(() => { draftRef.current = draft; }, [draft]);

  // Motor de sincronización con la cuenta (solo con sesión).
  const syncUser = sync?.userId;
  useEffect(() => {
    if (!syncUser) return;
    const engine = createSyncEngine<Draft>(
      { push: pushDraft, onState: setSyncState, onSynced: (version) => setSyncMarker({ userId: syncUser, version }) },
      initialRef.current.version,
    );
    engineRef.current = engine;
    // Primera vez con cuenta: el borrador local se migra al servidor de inmediato.
    if (initialRef.current.version === null) void engine.flushNow(initialRef.current.draft);
    return () => { engine.dispose(); engineRef.current = null; };
  }, [syncUser]);

  // Cada cambio: guardado local con retardo + guardado en la cuenta (el motor junta las ráfagas).
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    engineRef.current?.schedule(draft);
    const t = setTimeout(() => {
      if (locked.current) return;
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

  /** Reemplaza todo el contenido (ej. al elegir la versión de la cuenta ante un conflicto). */
  const replaceDraft = useCallback((d: Draft) => {
    setHistory(createHistory(d));
    saveDraft(d);
    setSave({ kind: "saved", at: Date.now() });
  }, []);

  return {
    draft, update, undo, redo, replaceDraft,
    canUndo: canUndo(history), canRedo: canRedo(history), save, now, syncState,
    syncEnabled: !!syncUser,
    /** Conflicto: la persona eligió quedarse con lo de este dispositivo. */
    keepMine: (serverVersion: number) => void engineRef.current?.resolve(draftRef.current, serverVersion),
    /** Conflicto: la persona eligió la versión de la cuenta. */
    adoptServer: (d: Draft, version: number) => {
      replaceDraft(d);
      engineRef.current?.adopt(version);
      if (syncUser) setSyncMarker({ userId: syncUser, version });
    },
    resumeSync: () => void engineRef.current?.resume(),
    /** Espera a que lo pendiente llegue al servidor (antes de publicar). */
    settleNow: async () => { await engineRef.current?.settle(5000); },
    /** Antes de cerrar sesión: sube lo pendiente y frena cualquier guardado local posterior. */
    async prepareSignOut() {
      locked.current = true; // primero se frena el guardado local: nada nuevo se escribe en esta compu
      await engineRef.current?.settle(3000); // y solo se espera si hay cambios sin subir
    },
  };
}

export function saveLabel(s: SaveState, now: number, sync: SyncState, syncEnabled: boolean): string {
  if (syncEnabled) {
    switch (sync.kind) {
      case "syncing": return "Guardando en tu cuenta…";
      case "offline": return "Sin conexión: guardado en este dispositivo, se sube cuando vuelva";
      case "unauthorized": return "Tu sesión venció: ingresá de nuevo para guardar en tu cuenta";
      case "conflict": return "Guardado pausado: hay una versión más nueva en tu cuenta";
      case "rejected": return "No se pudo guardar en tu cuenta: revisá los datos";
      case "synced": if (s.kind === "saved") return "Guardado en tu cuenta"; break;
    }
  }
  if (s.kind === "saving") return "Guardando…";
  if (s.kind === "error") return "No se pudo guardar en este dispositivo";
  const sec = Math.max(0, Math.round((now - s.at) / 1000));
  if (sec < 5) return "Guardado";
  if (sec < 60) return `Guardado hace ${sec} s`;
  return `Guardado hace ${Math.floor(sec / 60)} min`;
}
