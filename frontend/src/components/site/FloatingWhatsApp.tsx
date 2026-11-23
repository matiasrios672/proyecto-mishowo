"use client";

import { IconWhatsApp } from "./icons";
import { useCart } from "./cart/cartStore";
import { totals } from "@/lib/cart";

/**
 * Botón de WhatsApp siempre a mano en celular. Se sube cuando aparece la barra "Mi pedido" para no taparla,
 * y desaparece en pantallas anchas, donde el botón ya está en la barra superior.
 */
export function FloatingWhatsApp({ href, slug }: { href: string; slug?: string }) {
  const cart = useCart(slug ?? "");
  const hasCart = !!slug && totals(cart).count > 0;
  return (
    <a
      href={href} target="_blank" rel="noopener noreferrer" aria-label="Escribinos por WhatsApp" data-testid="floating-whatsapp"
      style={{ bottom: hasCart ? "5.5rem" : "1rem" }}
      className="fixed right-4 z-20 grid size-14 place-items-center rounded-full bg-[#15803D] text-white shadow-[0_10px_30px_-8px_rgba(0,0,0,0.5)] transition-[bottom,transform] duration-300 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring @2xl:hidden"
    >
      <IconWhatsApp className="size-7" />
    </a>
  );
}
