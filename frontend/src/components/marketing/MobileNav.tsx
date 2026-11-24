"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "./navLinks";

/** Menú del celular: botón con aria-expanded, se cierra con Escape, al navegar y al tocar afuera. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) { setLastPath(path); setOpen(false); }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: PointerEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [open]);

  return (
    <div ref={root} className="lg:hidden">
      <button type="button" aria-expanded={open} aria-controls="mk-mobile-menu" onClick={() => setOpen((v) => !v)}
        className="grid size-11 place-items-center rounded-xl border border-border bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <span className="sr-only">{open ? "Cerrar menú" : "Abrir menú"}</span>
        <svg viewBox="0 0 24 24" aria-hidden className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <nav id="mk-mobile-menu" aria-label="Menú" className="absolute inset-x-0 top-full border-b border-border bg-background px-5 pb-5 pt-2 shadow-[0_30px_40px_-30px_rgba(14,27,44,0.4)]">
          <ul>
            {NAV_LINKS.map(([label, href]) => (
              <li key={href}><Link href={href} className="flex min-h-12 items-center border-b border-border/60 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring">{label}</Link></li>
            ))}
            <li><Link href="/ingresar" className="flex min-h-12 items-center text-base font-semibold text-[#C73E00]">Ingresar</Link></li>
          </ul>
        </nav>
      )}
    </div>
  );
}
