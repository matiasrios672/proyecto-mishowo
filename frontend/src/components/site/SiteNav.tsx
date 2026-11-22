"use client";

import { useEffect, useRef, useState } from "react";
import { totals } from "@/lib/cart";
import { IconCart, IconWhatsApp } from "./icons";
import { useCart } from "./cart/cartStore";
import { Brand } from "./Brand";

export interface NavLink { id: string; label: string }

function CartButton({ slug }: { slug: string }) {
  const { count } = totals(useCart(slug));
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("mishowo:open-cart"))}
      aria-label={count > 0 ? `Ver mi pedido, ${count} ${count === 1 ? "producto" : "productos"}` : "Ver mi pedido"}
      className="hidden items-center gap-2 border border-primary px-3.5 py-2 text-sm font-medium text-primary transition-transform active:scale-95 @2xl:inline-flex"
      style={{ borderRadius: "var(--btn-radius)" }}
      data-testid="nav-cart"
    >
      <IconCart className="size-4" />
      Mi pedido
      {count > 0 && (
        // `key` reinicia la animación cada vez que cambia la cantidad: responde a lo que hizo la persona.
        <span key={count} className="site-bump grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Barra fija del sitio. Se condensa (fondo y borde) al scrollear y marca la sección que se está viendo.
 * Usa IntersectionObserver, no escucha el scroll.
 */
export function SiteNav({ name, links, orderableSlug, whatsappHref, logo, logoSet }: { name: string; links: NavLink[]; orderableSlug?: string; whatsappHref: string | null; logo?: string | null; logoSet?: string | null }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const site = rootRef.current?.closest<HTMLElement>("[data-site-layout]");
    const sentinel = sentinelRef.current;
    if (!site || !sentinel) return;
    const top = new IntersectionObserver(([e]) => setScrolled(!!e && !e.isIntersecting));
    top.observe(sentinel);
    const sections = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-30% 0px -60% 0px" },
    );
    site.querySelectorAll<HTMLElement>("[data-section]").forEach((s) => sections.observe(s));
    return () => { top.disconnect(); sections.disconnect(); };
  }, [links.length]);

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="pointer-events-none h-px" />
      <div ref={rootRef} className="sticky top-0 z-30">
        <nav
          aria-label="Secciones"
          className={`transition-[background-color,border-color,backdrop-filter,box-shadow] duration-300 ${scrolled ? "border-b border-border bg-background/80 shadow-[0_8px_30px_-18px_rgba(0,0,0,0.35)] backdrop-blur-xl" : "border-b border-transparent"}`}
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 @2xl:px-8">
            <a href="#top" className="flex max-w-[62%] items-center gap-2.5" aria-label={name || "Tu negocio"}>
              <Brand name={name} logo={logo} logoSet={logoSet} size="sm" />
              <span className={`truncate site-display text-lg font-bold leading-none ${logo ? "hidden @xl:inline" : ""}`}>{name || "Tu negocio"}</span>
            </a>

            {links.length > 1 && (
              <div className="order-last -mx-5 basis-full overflow-x-auto px-5 @4xl:order-none @4xl:mx-0 @4xl:ml-6 @4xl:basis-auto @4xl:px-0">
                <ul className="flex w-max gap-1.5">
                  {links.map((l) => (
                    <li key={l.id}>
                      <a
                        href={`#${l.id}`}
                        aria-current={active === l.id ? "true" : undefined}
                        className={`block whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors ${active === l.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              {whatsappHref && (
                <a
                  href={whatsappHref} target="_blank" rel="noopener noreferrer" aria-label="Escribinos por WhatsApp"
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground transition-transform active:scale-95 @2xl:border @2xl:border-border"
                  style={{ borderRadius: "var(--btn-radius)" }}
                >
                  <IconWhatsApp className="size-5" />
                  <span className="hidden @2xl:inline">WhatsApp</span>
                </a>
              )}
              {orderableSlug && <CartButton slug={orderableSlug} />}
            </div>
          </div>
        </nav>
      </div>
    </>
  );
}
