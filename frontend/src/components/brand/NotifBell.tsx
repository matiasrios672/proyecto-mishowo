"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconBell } from "@/components/brand/IconBell";

export interface NotifItem { id: string; label: string; n: number; href: string; tone?: "alert" | "info" }

/**
 * Campana de avisos: cuántas cosas esperan atención y un menú para ir directo a cada una.
 * `load` devuelve solo lo pendiente; se vuelve a pedir cada minuto y al abrir el menú.
 */
export function NotifBell({ load, side = "below", empty = "Todo al día. No hay nada esperando." }: { load: () => Promise<NotifItem[]>; side?: "below" | "right" | "end"; empty?: string }) {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(() => { load().then((x) => setItems(x.filter((i) => i.n > 0))).catch(() => { /* sin red: se conserva lo último */ }); }, [load]);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const total = items.reduce((a, i) => a + i.n, 0);
  return (
    <div ref={box} className={side === "end" ? "relative" : ""} onKeyDown={(e) => { if (e.key === "Escape" && open) { setOpen(false); btn.current?.focus(); } }}>
      <button ref={btn} type="button" aria-expanded={open} aria-haspopup="true" aria-label={total > 0 ? `Avisos: ${total} pendientes` : "Avisos"} onClick={() => { setOpen((v) => !v); if (!open) refresh(); }}
        className="relative grid size-10 shrink-0 place-items-center rounded-xl text-[#5B6577] hover:bg-[#FFE9DC] hover:text-[#C73E00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <IconBell className="size-5" />
        {total > 0 && <span aria-hidden className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-[#FC5502] px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">{total > 99 ? "99+" : total}</span>}
      </button>
      {open && (
        <div role="region" aria-label="Avisos" className={`absolute z-40 rounded-2xl border border-[#E5E8EF] bg-white p-2 shadow-[0_24px_48px_-20px_rgba(21,27,43,0.35)] ${side === "right" ? "left-full top-0 ml-3 w-72" : side === "end" ? "right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)]" : "inset-x-0 top-full mt-2"}`}>
          <p className="px-3 pb-1 pt-2 text-sm font-bold text-[#151B2B]">Para atender</p>
          {items.length === 0 ? (
            <p className="px-3 pb-3 text-sm text-[#5B6577]">{empty}</p>
          ) : (
            <ul>
              {items.map((i) => (
                <li key={i.id}>
                  <Link href={i.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-[#F6F7FA] focus-visible:outline-2 focus-visible:outline-ring">
                    <span className={`grid min-w-8 place-items-center rounded-lg px-2 py-1 text-sm font-extrabold tabular-nums ${i.tone === "alert" ? "bg-red-50 text-red-700" : "bg-[#FFF1E8] text-[#C73E00]"}`}>{i.n}</span>
                    <span className="flex-1">{i.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
