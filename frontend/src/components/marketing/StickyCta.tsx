"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** Botón fijo que aparece al pasar el hero y se esconde cuando ya está a la vista el cierre de la página. */
export function StickyCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const final = document.getElementById("final-title");
      const nearEnd = final ? final.getBoundingClientRect().top < window.innerHeight : false;
      // No tapa la animación: se esconde mientras la sección del explicador está a la vista.
      const exp = document.getElementById("como-funciona")?.getBoundingClientRect();
      const onExplainer = !!exp && exp.top < window.innerHeight * 0.85 && exp.bottom > window.innerHeight * 0.15;
      setShow(window.scrollY > 820 && !nearEnd && !onExplainer);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div aria-hidden={!show} className={`pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 transition-all duration-300 ${show ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>
      <Link href="/crear" tabIndex={show ? 0 : -1} className="pointer-events-auto inline-flex min-h-12 items-center gap-2 rounded-full bg-[#0E1B2C] px-6 font-bold text-white shadow-[0_20px_40px_-12px_rgba(14,27,44,0.6)] ring-1 ring-white/20 transition hover:bg-[#1A2B42] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        Creá tu página gratis
        <span aria-hidden className="grid size-6 place-items-center rounded-full bg-[#FC5502] text-sm text-[#0E1B2C]">→</span>
      </Link>
    </div>
  );
}
