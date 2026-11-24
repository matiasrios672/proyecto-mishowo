"use client";

import { useEffect } from "react";

/**
 * Movimiento al scrollear para la landing (se monta una sola vez):
 * - los bloques marcados con `data-fx` entran con un fundido y un desplazamiento cuando aparecen (`up`, `left`, `right`, `zoom`);
 * - los hijos de un `data-fx-stagger` entran escalonados;
 * - barra de progreso arriba, sombra de la cabecera al bajar y un leve parallax en el hero.
 * Lo que ya está a la vista al cargar no se anima, y con «reducir movimiento» no se hace nada: la página queda completa y quieta.
 */
export function ScrollFx() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;

    document.querySelectorAll<HTMLElement>("[data-fx-stagger]").forEach((box) => {
      [...box.children].forEach((child, i) => (child as HTMLElement).style.setProperty("--fx-d", `${i * 90}ms`));
    });

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        (e.target as HTMLElement).classList.add("fx-in");
        io.unobserve(e.target);
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    document.querySelectorAll<HTMLElement>("[data-fx]").forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return; // ya está a la vista
      el.classList.add("fx-pre");
      io.observe(el);
    });

    const header = document.querySelector<HTMLElement>(".mk-header");
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const max = Math.max(1, root.scrollHeight - window.innerHeight);
      root.style.setProperty("--mk-scroll", String(Math.min(1, y / max)));
      root.style.setProperty("--mk-y", `${Math.min(y, 900)}px`);
      if (header) header.dataset.scrolled = y > 8 ? "true" : "false";
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      root.style.removeProperty("--mk-scroll");
      root.style.removeProperty("--mk-y");
    };
  }, []);

  return <div aria-hidden className="mk-progress" />;
}
