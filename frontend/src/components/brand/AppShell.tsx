"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getNavGuard } from "@/lib/navGuard";
import { Isotipo, Wordmark } from "@/components/brand/Wordmark";
import { IconLogout, IconMenu, IconCross } from "@/components/marketing/Doodles";

export interface NavItem { href: string; label: string; Icon: (p: { className?: string }) => ReactNode; exact?: boolean; badge?: number }
export interface NavGroup { label: string; items: NavItem[] }

/**
 * Marco con barra lateral izquierda para el panel del cliente y el admin.
 * Accesible: enlace "Saltar al contenido", landmarks (aside/nav/main), `aria-current`, grupos con encabezado,
 * objetivos táctiles de 44 px, foco visible y, en celular, menú desplegable con `aria-expanded` que se cierra con Escape.
 */
export function AppShell({ groups, areaLabel, homeHref = "/", userLabel, onLogout, children, compact = false, fullBleed = false }: {
  groups: NavGroup[]; areaLabel: string; homeHref?: string; userLabel: string; onLogout: () => void; children: ReactNode;
  /** Barra lateral angosta (solo íconos) en pantallas anchas: deja lugar a pantallas de trabajo como el editor. */
  compact?: boolean;
  /** El contenido ocupa todo el alto y el ancho, sin la hoja blanca con márgenes. */
  fullBleed?: boolean;
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  const isActive = (i: NavItem) => (i.exact ? path === i.href : path === i.href || path.startsWith(`${i.href}/`));
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open) { setOpen(false); toggle.current?.focus(); } };

  return (
    <div className={`panel-flat bg-white lg:grid ${compact ? "lg:grid-cols-[4.75rem_minmax(0,1fr)]" : "lg:grid-cols-[17rem_minmax(0,1fr)]"} ${fullBleed ? "flex h-dvh flex-col" : "min-h-dvh"}`} onKeyDown={onKey}>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2.5 focus:font-semibold focus:shadow-lg focus:outline-2 focus:outline-ring">Saltar al contenido</a>

      <aside className={`relative z-20 shrink-0 border-b border-[#D6E4F2] bg-[#F7FAFD] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-b-0 lg:border-r ${fullBleed ? "max-h-dvh overflow-y-auto lg:overflow-visible" : ""}`}>
        <div className={`flex items-center justify-between px-4 py-3 ${compact ? "lg:justify-center lg:px-2 lg:py-5" : "lg:px-6 lg:py-6"}`}>
          <Link href={homeHref} aria-label="MiShowo, ir al inicio" className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{compact ? <><span className="lg:hidden"><Wordmark className="text-2xl" /></span><span aria-hidden className="hidden lg:block"><Isotipo className="size-10" /></span><span className="sr-only hidden lg:inline">MiShowo</span></> : <Wordmark className="text-2xl" />}</Link>
          <button ref={toggle} type="button" aria-expanded={open} aria-controls="menu-lateral" onClick={() => setOpen((v) => !v)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#D6E4F2] bg-white px-3.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:hidden">
            {open ? <IconCross className="size-5" /> : <IconMenu className="size-5" />}Menú
          </button>
        </div>

        <div id="menu-lateral" className={`${open ? "flex" : "hidden"} flex-col gap-1 px-3 pb-4 lg:flex lg:min-h-0 lg:flex-1 lg:overflow-y-auto ${compact ? "lg:px-2" : "lg:px-4"}`}>
          <nav aria-label={areaLabel} className="flex-1 divide-y divide-[#E1EAF3]">
            {groups.map((g, gi) => (
              <div key={g.label} className="py-3 first:pt-0">
                <h2 id={`nav-g-${gi}`} className={`px-3 pb-1.5 text-xs font-bold uppercase tracking-wider text-[#47566A] ${compact ? "lg:sr-only" : ""}`}>{g.label}</h2>
                <ul aria-labelledby={`nav-g-${gi}`} className="space-y-0.5">
                  {g.items.map((i) => {
                    const active = isActive(i);
                    return (
                      <li key={i.href}>
                        <Link href={i.href} aria-current={active ? "page" : undefined} onClick={(e) => {
                            setOpen(false);
                            const guard = getNavGuard();
                            if (!guard || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                            e.preventDefault(); // antes de salir, se termina de guardar lo último que se escribió
                            void guard().then(() => router.push(i.href));
                          }} title={compact ? i.label : undefined}
                          className={`flex min-h-11 [@media(max-height:820px)]:lg:min-h-10 items-center gap-3 rounded-xl px-3 ${compact ? "lg:justify-center lg:px-0" : ""} text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${active ? "bg-[#EAF4FC] text-[#0E1B2C] shadow-[inset_3px_0_0_#2F6FB0]" : "text-[#2B3A4D] hover:bg-[#EEF4FA]"}`}>
                          <i.Icon className="size-5 shrink-0 text-[#2F6FB0]" />
                          <span className={`flex-1 ${compact ? "lg:sr-only" : ""}`}>{i.label}</span>
                          {i.badge ? <span className="rounded-sm bg-[#2F6FB0] px-2 py-0.5 text-xs font-bold text-white"><span className="sr-only">Pendientes: </span>{i.badge}</span> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
          <div className="mt-4 space-y-2 border-t border-[#D6E4F2] pt-4">
            <p data-testid="account" className={`truncate px-3 text-sm text-[#47566A] ${compact ? "lg:sr-only" : ""}`} title={userLabel}>{userLabel}</p>
            <button type="button" onClick={onLogout}
              title={compact ? "Cerrar sesión" : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 ${compact ? "lg:justify-center lg:px-0" : ""} text-[15px] font-semibold text-[#0E1B2C] hover:bg-[#EAF4FC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}>
              <IconLogout className="size-5 text-[#2F6FB0]" /><span className={compact ? "lg:sr-only" : ""}>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </aside>

      <main id="contenido" tabIndex={-1} className={fullBleed ? "min-h-0 min-w-0 flex-1 overflow-hidden bg-white outline-none" : "min-w-0 px-4 py-5 outline-none sm:px-8 lg:px-10 lg:py-8"}>
        {fullBleed ? children : <div className="mx-auto max-w-5xl">{children}</div>}
      </main>
    </div>
  );
}
