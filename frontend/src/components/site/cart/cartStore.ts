"use client";

import { useSyncExternalStore } from "react";
import { emptyCart, parseCart, type Cart } from "@/lib/cart";

// Store mínimo por negocio. La memoria manda dentro de la sesión (así funciona aunque localStorage
// esté bloqueado, ej. modo privado) y localStorage da persistencia entre visitas y pestañas.
const KEY = (slug: string) => `mishowo:cart:${slug}`;
const memory = new Map<string, Cart>();
const listeners = new Set<() => void>();
const EMPTY = emptyCart();

function read(slug: string): Cart {
  const cached = memory.get(slug);
  if (cached) return cached;
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY(slug)); } catch { /* sin storage */ }
  const cart = parseCart(raw);
  memory.set(slug, cart);
  return cart;
}

export function writeCart(slug: string, cart: Cart) {
  memory.set(slug, cart);
  try {
    if (cart.items.length === 0) window.localStorage.removeItem(KEY(slug));
    else window.localStorage.setItem(KEY(slug), JSON.stringify(cart));
  } catch { /* sin storage: queda en memoria */ }
  listeners.forEach((l) => l());
}

export function readCartNow(slug: string): Cart {
  return read(slug);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith("mishowo:cart:")) {
      memory.delete(e.key.slice("mishowo:cart:".length)); // otra pestaña cambió el carrito: volver a leer
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart(slug: string): Cart {
  return useSyncExternalStore(subscribe, () => read(slug), () => EMPTY);
}
