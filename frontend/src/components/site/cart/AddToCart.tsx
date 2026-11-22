"use client";

import { useState } from "react";
import { addItem, quantityOf, removeItem, setQuantity, itemKey } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import type { SiteProduct } from "@/lib/site";
import { useCart, writeCart } from "./cartStore";

const btn = "bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const ghost = "border border-primary px-3 py-1.5 text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const radius = { borderRadius: "var(--btn-radius)" } as const;

export function AddToCart({ slug, product, showQuantities }: { slug: string; product: SiteProduct; showQuantities: boolean }) {
  const cart = useCart(slug);
  const available = product.options.filter((o) => !o.soldOut);
  const [chosen, setChosen] = useState<string | null>(null);
  if (!product.available || (product.options.length > 0 && available.length === 0)) return null;

  const selected = available.find((o) => o.id === chosen) ?? available[0] ?? null;
  const optionId = selected?.id ?? null;
  const unitPrice = selected && selected.price !== null ? selected.price : product.price;
  const qty = quantityOf(cart, product.id, optionId);
  const key = itemKey(product.id, optionId);
  const label = selected ? `${product.name} (${selected.label})` : product.name;

  const add = () =>
    writeCart(slug, addItem(cart, { productId: product.id, optionId, name: product.name, optionLabel: selected?.label ?? null, unitPrice }));

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {product.options.length > 0 && (
        <select
          aria-label={`Opción de ${product.name}`} value={selected?.id ?? ""} onChange={(e) => setChosen(e.target.value)}
          className="max-w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        >
          {available.map((o) => (
            <option key={o.id} value={o.id}>{o.label}{o.price !== null ? ` · ${formatPrice(o.price)}` : ""}</option>
          ))}
        </select>
      )}
      {qty === 0 ? (
        <button type="button" onClick={add} className={btn} style={radius} aria-label={`Agregar ${label} al pedido`}>Agregar</button>
      ) : showQuantities ? (
        <div className="inline-flex items-center gap-1" role="group" aria-label={`Cantidad de ${label}`}>
          <button type="button" className={ghost} style={radius} aria-label={`Quitar una unidad de ${label}`}
            onClick={() => writeCart(slug, setQuantity(cart, key, qty - 1))}>−</button>
          <span className="min-w-8 text-center text-sm font-semibold" aria-live="polite" data-testid="qty">{qty}</span>
          <button type="button" className={ghost} style={radius} aria-label={`Agregar una unidad más de ${label}`}
            onClick={() => writeCart(slug, setQuantity(cart, key, qty + 1))}>+</button>
        </div>
      ) : (
        <button type="button" className={ghost} style={radius} onClick={() => writeCart(slug, removeItem(cart, key))} aria-label={`Quitar ${label} del pedido`}>Agregado ✓ · Quitar</button>
      )}
    </div>
  );
}
