import { api } from "./authClient";
import { draftToContent, type Draft, type DraftContent } from "./draft";
import type { PushResult } from "./syncEngine";

// Si dos creaciones salen a la vez (ej. React en modo estricto monta dos veces en desarrollo), comparten
// el mismo pedido en vez de que el segundo choque con el negocio que el primero acaba de crear.
let creating: Promise<PushResult> | null = null;

/** Guarda el borrador en el servidor. Traduce cada respuesta a lo que el motor de sincronización entiende. */
export function pushDraft(draft: Draft, baseVersion: number | null): Promise<PushResult> {
  if (baseVersion !== null) return doPush(draft, baseVersion);
  creating ??= doPush(draft, null).finally(() => { creating = null; });
  return creating;
}

async function doPush(draft: Draft, baseVersion: number | null): Promise<PushResult> {
  const r = await api<{ version: number }>("/me/business", { method: "PUT", body: { baseVersion, content: draftToContent(draft) } });
  if (r.ok) return { ok: true, version: r.data.version };
  if (r.status === 409) return { ok: false, reason: "conflict", version: r.data.version ?? 0 };
  if (r.status === 401) return { ok: false, reason: "unauthorized" };
  if (r.status === 400 || r.status === 403 || r.status === 429) return { ok: false, reason: "invalid" };
  return { ok: false, reason: "network" }; // sin conexión o error del servidor: se reintenta
}

export interface ServerBusiness { id: string; slug: string; status: string; planId: string; version: number }
export type ServerState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ok"; business: ServerBusiness | null; content: DraftContent | null };

export async function fetchServerBusiness(): Promise<ServerState> {
  const r = await api<{ business: ServerBusiness | null; content: DraftContent | null }>("/me/business");
  if (!r.ok) return { kind: "error" };
  return { kind: "ok", business: r.data.business, content: r.data.content };
}

// ---- Marca de "lo último que se sincronizó" para saber si el borrador local está al día ----
const SYNC_KEY = "mishowo:sync:v1";
export interface SyncMarker { userId: string; version: number }

export function getSyncMarker(): SyncMarker | null {
  try {
    const m = JSON.parse(window.localStorage.getItem(SYNC_KEY) ?? "null") as SyncMarker | null;
    return m && typeof m.userId === "string" && Number.isInteger(m.version) ? m : null;
  } catch { return null; }
}
export function setSyncMarker(m: SyncMarker) {
  try { window.localStorage.setItem(SYNC_KEY, JSON.stringify(m)); } catch { /* sin storage */ }
}
export function clearSyncMarker() {
  try { window.localStorage.removeItem(SYNC_KEY); } catch { /* sin storage */ }
}
