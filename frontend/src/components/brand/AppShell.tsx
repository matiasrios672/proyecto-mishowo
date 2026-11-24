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
export function AppShell({ groups, areaLabel, homeHref = "/", userLabel, onLogout, children, compact = false, fullBleed = false, topSlot, bell, topLeft }: {
  groups: NavGroup[]; areaLabel: string; homeHref?: string; userLabel: string; onLogout: () => void; children: ReactNode;
  /** Barra lateral angosta (solo íconos) en pantallas anchas: deja lugar a pantallas de trabajo como el editor. */
  compact?: boolean;
  /** El contenido ocupa todo el alto y el ancho, sin la hoja blanca con márgenes. */
  fullBleed?: boolean;
  /** Algo arriba del menú (el selector de página del panel). Se oculta con la barra angosta. */
  topSlot?: ReactNode;
  /** Campana de avisos: va junto a la cuenta, en la esquina superior derecha. */
  bell?: (side: "below" | "right" | "end") => ReactNode;
  /** Algo a la izquierda de la barra superior (por ejemplo, un buscador). */
  topLeft?: ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  const isActive = (i: NavItem) => (i.exact ? path === i.href : path === i.href || path.startsWith(`${i.href}/`));
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open) { setOpen(false); toggle.current?.focus(); } };

  return (
    <div className={`panel-modern lg:grid ${compact ? "lg:grid-cols-[4.75rem_minmax(0,1fr)]" : "lg:grid-cols-[18rem_minmax(0,1fr)]"} ${fullBleed ? "flex h-dvh flex-col" : "min-h-dvh"}`} onKeyDown={onKey}>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2.5 focus:font-semibold focus:shadow-lg focus:outline-2 focus:outline-ring">Saltar al contenido</a>

      <aside className={`pm-side relative z-20 shrink-0 border-b border-[#E5E8EF] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-b-0 ${fullBleed ? "max-h-dvh overflow-y-auto lg:overflow-visible" : ""}`}>
        <div className={`flex items-center justify-between px-4 py-3 ${compact ? "lg:justify-center lg:px-2 lg:py-5" : "lg:px-6 lg:py-6"}`}>
          <Link href={homeHref} aria-label="MiShowo, ir al inicio" className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{compact ? <><span className="lg:hidden"><Wordmark className="text-2xl" /></span><span aria-hidden className="hidden lg:block"><Isotipo className="size-10" /></span><span className="sr-only hidden lg:inline">MiShowo</span></> : <Wordmark className="text-2xl" />}</Link>
          <button ref={toggle} type="button" aria-expanded={open} aria-controls="menu-lateral" onClick={() => setOpen((v) => !v)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E5E8EF] bg-white px-3.5 text-sm font-semibold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:hidden">
            {open ? <IconCross className="size-5" /> : <IconMenu className="size-5" />}Menú
          </button>
        </div>

        <div id="menu-lateral" className={`${open ? "flex" : "hidden"} flex-col gap-1 px-3 pb-4 lg:flex lg:min-h-0 lg:flex-1 ${compact ? "lg:px-2" : "lg:px-4"}`}>
          {fullBleed && <div className={`relative z-30 mb-3 flex shrink-0 items-center gap-2 rounded-2xl border border-[#E5E8EF] bg-white/90 p-2 pl-2.5 shadow-sm ${compact ? "lg:flex-col lg:px-1 lg:py-2" : ""}`}>
            <span aria-hidden className={`grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#1B2336] to-[#3A4560] text-sm font-bold text-white`}>{(userLabel.trim()[0] ?? "?").toUpperCase()}</span>
            <p data-testid="account" className={`min-w-0 flex-1 truncate text-[13px] font-semibold text-[#2B3547] ${compact ? "lg:sr-only" : ""}`} title={userLabel}>{userLabel}</p>
            {bell?.(compact ? "right" : "below")}
            <button type="button" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión" className="grid size-10 shrink-0 place-items-center rounded-xl text-[#5B6577] hover:bg-[#FFE9DC] hover:text-[#C73E00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <IconLogout className="size-5" /><span className="sr-only">Cerrar sesión</span>
            </button>
          </div>}
          <div className="pm-scroll flex min-h-0 flex-1 flex-col lg:overflow-y-auto">
          {topSlot && <div className={compact ? "lg:hidden" : ""}>{topSlot}</div>}
          <nav aria-label={areaLabel} className="flex-1 space-y-5 pt-1">
            {groups.map((g, gi) => (
              <div key={g.label}>
                <h2 id={`nav-g-${gi}`} className={`px-3 pb-1.5 text-[12px] font-semibold tracking-wide text-[#7A8497] ${compact ? "lg:sr-only" : ""}`}>{g.label}</h2>
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
                          className={`pm-navlink group flex min-h-11 [@media(max-height:820px)]:lg:min-h-10 items-center gap-3 rounded-2xl px-2 ${compact ? "lg:justify-center lg:px-0" : ""} text-[14.5px] font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${active ? "bg-white text-[#151B2B] shadow-[0_1px_2px_rgba(21,27,43,0.06),0_8px_20px_-10px_rgba(21,27,43,0.25)] ring-1 ring-[#E5E8EF]" : "text-[#3B465A] hover:bg-white/70 hover:text-[#151B2B]"}`}>
                          <span className={`grid size-8 shrink-0 place-items-center rounded-xl transition-colors ${active ? "bg-gradient-to-br from-[#FF8A3D] to-[#FC5502] text-white shadow-[0_6px_12px_-6px_rgba(252,85,2,0.8)]" : "bg-[#EEF0F5] text-[#5B6577] group-hover:bg-[#FFE9DC] group-hover:text-[#C73E00]"}`}><i.Icon className="size-[18px]" /></span>
                          <span className={`flex-1 ${compact ? "lg:sr-only" : ""}`}>{i.label}</span>
                          {i.badge ? <span className="rounded-full bg-[#FC5502] px-2 py-0.5 text-xs font-bold text-white"><span className="sr-only">Pendientes: </span>{i.badge}</span> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
          </div>
        </div>
      </aside>

      <main id="contenido" tabIndex={-1} className={fullBleed ? "min-h-0 min-w-0 flex-1 overflow-hidden bg-white outline-none" : "min-w-0 px-4 py-5 outline-none sm:px-8 lg:px-10 lg:py-8"}>
        {fullBleed ? children : (
          <>
            <div className="pm-topbar relative z-30 -mx-4 -mt-5 mb-6 flex items-center justify-end gap-1.5 px-4 py-2.5 sm:-mx-8 sm:px-8 lg:-mx-10 lg:-mt-8 lg:px-10">
              {topLeft && <div className="mr-auto min-w-0 flex-1">{topLeft}</div>}
              {bell?.("end")}
              <span className="mx-1 hidden h-6 w-px bg-[#E5E8EF] sm:block" aria-hidden />
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#1B2336] to-[#3A4560] text-sm font-bold text-white">{(userLabel.trim()[0] ?? "?").toUpperCase()}</span>
              <p data-testid="account" className="hidden max-w-[16rem] truncate px-1 text-[13px] font-semibold text-[#2B3547] sm:block" title={userLabel}>{userLabel}</p>
              <button type="button" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión" className="grid size-10 shrink-0 place-items-center rounded-xl text-[#5B6577] hover:bg-[#FFE9DC] hover:text-[#C73E00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                <IconLogout className="size-5" /><span className="sr-only">Cerrar sesión</span>
              </button>
            </div>
            <div key={path} className="panel-enter mx-auto max-w-5xl">{children}</div>
          </>
        )}
      </main>
    </div>
  );
}
