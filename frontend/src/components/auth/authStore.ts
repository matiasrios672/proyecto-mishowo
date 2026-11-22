"use client";

import { useSyncExternalStore } from "react";
import { api, type PublicUser } from "@/lib/authClient";

// Estado de sesión compartido. `undefined` = todavía no sabemos; `null` = no hay sesión.
let user: PublicUser | null | undefined;
let started = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setUser(u: PublicUser | null) {
  user = u;
  emit();
}

export async function refreshUser() {
  const r = await api<{ user: PublicUser | null }>("/auth/me");
  // Si la API no responde, no se asume que cerró la sesión: se deja como "desconocido -> sin sesión".
  setUser(r.ok ? (r.data.user ?? null) : null);
}

export async function logout() {
  // keepalive: si la persona cierra o recarga la pestaña enseguida, el navegador igual completa el pedido
  // (si no, la sesión quedaría abierta en el servidor).
  await api("/auth/logout", { method: "POST", body: {}, keepalive: true });
  setUser(null);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!started) {
    started = true;
    void refreshUser();
  }
  return () => listeners.delete(cb);
}

/** `undefined` mientras carga, `null` sin sesión, o el usuario. */
export function useUser(): PublicUser | null | undefined {
  return useSyncExternalStore(subscribe, () => user, () => undefined);
}
