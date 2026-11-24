"use client";

import { useSyncExternalStore } from "react";

export type ToastKind = "success" | "error" | "info";
export interface ToastItem { id: number; kind: ToastKind; text: string }

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Duración en pantalla: los errores se quedan más para poder leerlos. */
const LIFETIME: Record<ToastKind, number> = { success: 4500, info: 5000, error: 9000 };

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

/** Muestra un aviso arriba a la derecha. Avisos idénticos seguidos no se apilan. */
export function showToast(kind: ToastKind, text: string) {
  if (items.some((t) => t.kind === kind && t.text === text)) return;
  const id = nextId++;
  items = [...items.slice(-3), { id, kind, text }]; // como mucho 4 a la vez
  emit();
  if (typeof window !== "undefined") window.setTimeout(() => dismissToast(id), LIFETIME[kind]);
}

export const toast = {
  success: (text: string) => showToast("success", text),
  error: (text: string) => showToast("error", text),
  info: (text: string) => showToast("info", text),
};

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const EMPTY: ToastItem[] = [];
export const useToasts = () => useSyncExternalStore(subscribe, () => items, () => EMPTY);
