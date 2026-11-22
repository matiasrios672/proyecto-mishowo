// Carrito del cliente final. Solo guarda ids y cantidades que se mandan al servidor;
// los precios acá son únicamente para mostrar: el total real lo calcula el backend.

export interface CartItem {
  key: string;            // productId + optionId
  productId: string;
  optionId: string | null;
  name: string;
  optionLabel: string | null;
  unitPrice: number | null;
  quantity: number;
}
export interface Cart { items: CartItem[] }

export const MAX_QTY = 99;
export const emptyCart = (): Cart => ({ items: [] });
export const itemKey = (productId: string, optionId: string | null) => `${productId}:${optionId ?? ""}`;

export function addItem(cart: Cart, item: Omit<CartItem, "key" | "quantity">, qty = 1): Cart {
  const key = itemKey(item.productId, item.optionId);
  const found = cart.items.find((i) => i.key === key);
  if (found) return setQuantity(cart, key, found.quantity + qty);
  return { items: [...cart.items, { ...item, key, quantity: Math.min(MAX_QTY, Math.max(1, qty)) }] };
}

/** Cantidad 0 o menos elimina el ítem. */
export function setQuantity(cart: Cart, key: string, qty: number): Cart {
  if (qty <= 0) return removeItem(cart, key);
  return { items: cart.items.map((i) => (i.key === key ? { ...i, quantity: Math.min(MAX_QTY, Math.floor(qty)) } : i)) };
}

export const removeItem = (cart: Cart, key: string): Cart => ({ items: cart.items.filter((i) => i.key !== key) });

export function totals(cart: Cart): { count: number; total: number; hasUnpriced: boolean } {
  return {
    count: cart.items.reduce((n, i) => n + i.quantity, 0),
    total: Math.round(cart.items.reduce((s, i) => s + (i.unitPrice ?? 0) * i.quantity * 100, 0)) / 100,
    hasUnpriced: cart.items.some((i) => i.unitPrice === null),
  };
}

export const quantityOf = (cart: Cart, productId: string, optionId: string | null) =>
  cart.items.find((i) => i.key === itemKey(productId, optionId))?.quantity ?? 0;

/** Valida lo que viene de localStorage: si algo no cierra, se descarta el carrito entero. */
export function parseCart(raw: string | null): Cart {
  if (!raw) return emptyCart();
  try {
    const d = JSON.parse(raw) as Cart;
    if (!d || !Array.isArray(d.items)) return emptyCart();
    const ok = d.items.every(
      (i) => typeof i.productId === "string" && typeof i.name === "string" && Number.isInteger(i.quantity) && i.quantity >= 1 && i.quantity <= MAX_QTY,
    );
    return ok ? { items: d.items.map((i) => ({ ...i, key: itemKey(i.productId, i.optionId ?? null), optionId: i.optionId ?? null })) } : emptyCart();
  } catch {
    return emptyCart();
  }
}
