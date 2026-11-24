"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/authClient";

export interface CommandItem { href: string; label: string; group: string; keywords?: string }
interface Hit { id: string; label: string; hint: string; href: string }
type Row = Hit & { kind: "page" | "negocio" };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Buscador del admin: abrí con el botón o con Ctrl/⌘+K, escribí y saltá a cualquier pantalla o negocio.
 * Las pantallas se filtran al instante (nombre y palabras clave); los negocios se buscan por nombre, link o email.
 */
export function AdminCommand({ items, canBusinesses }: { items: CommandItem[]; canBusinesses: boolean }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button ref={opener} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K"
        className="flex h-10 w-full max-w-sm items-center gap-2.5 rounded-xl border border-[#E5E8EF] bg-white/90 px-3 text-left text-sm text-[#5B6577] shadow-sm transition hover:border-[#C9CED9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <svg viewBox="0 0 20 20" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><circle cx="9" cy="9" r="5.5" /><path d="m13.5 13.5 3.5 3.5" /></svg>
        <span className="flex-1 truncate">Buscar pantallas o negocios</span>
        <kbd className="hidden rounded-md border border-[#E5E8EF] bg-[#F6F7FA] px-1.5 py-0.5 text-[11px] font-semibold text-[#5B6577] sm:block">Ctrl K</kbd>
      </button>
      {open && <Palette items={items} canBusinesses={canBusinesses} onClose={() => { setOpen(false); opener.current?.focus(); }} />}
    </>
  );
}

/** Se monta al abrir: así cada apertura arranca limpia, sin reiniciar nada a mano. */
function Palette({ items, canBusinesses, onClose }: { items: CommandItem[]; canBusinesses: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [selRaw, setSel] = useState(0);
  const [found, setFound] = useState<{ q: string; hits: Hit[] }>({ q: "", hits: [] });

  const term = q.trim();
  const pages = useMemo<Hit[]>(() => {
    const t = norm(term);
    const all = items.map((i) => ({ id: i.href, label: i.label, hint: i.group, href: i.href, hay: norm(`${i.label} ${i.group} ${i.keywords ?? ""}`) }));
    return (t ? all.filter((i) => t.split(/\s+/).every((w) => i.hay.includes(w))) : all).slice(0, 8);
  }, [items, term]);

  useEffect(() => {
    if (!canBusinesses || term.length < 2) return;
    let alive = true;
    const h = setTimeout(() => {
      api<{ businesses: { id: string; name: string; slug: string; ownerEmail: string }[] }>(`/admin/businesses?page=1&q=${encodeURIComponent(term)}`).then((r) => {
        if (alive && r.ok) setFound({ q: term, hits: r.data.businesses.slice(0, 5).map((b) => ({ id: b.id, label: b.name || b.slug, hint: `${b.slug} · ${b.ownerEmail}`, href: `/admin/negocios/${b.id}` })) });
      });
    }, 250);
    return () => { alive = false; clearTimeout(h); };
  }, [term, canBusinesses]);

  const biz = found.q === term && term.length >= 2 ? found.hits : [];
  const rows: Row[] = [...pages.map((p) => ({ ...p, kind: "page" as const })), ...biz.map((b) => ({ ...b, kind: "negocio" as const }))];
  const sel = Math.min(selRaw, Math.max(0, rows.length - 1));
  const go = (h: Hit) => { onClose(); router.push(h.href); };

  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-items-center bg-[#0E1B2C]/45 px-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Buscar en la administración" className="w-full max-w-xl overflow-hidden rounded-3xl border border-[#E5E8EF] bg-white shadow-[0_40px_80px_-30px_rgba(14,27,44,0.6)]"
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); onClose(); }
          else if (e.key === "ArrowDown") { e.preventDefault(); setSel(Math.min(rows.length - 1, sel + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setSel(Math.max(0, sel - 1)); }
          else if (e.key === "Enter" && rows[sel]) { e.preventDefault(); go(rows[sel]!); }
        }}>
        <div className="flex items-center gap-3 border-b border-[#EEF0F4] px-5">
          <svg viewBox="0 0 20 20" className="size-5 shrink-0 text-[#5B6577]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><circle cx="9" cy="9" r="5.5" /><path d="m13.5 13.5 3.5 3.5" /></svg>
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} placeholder={canBusinesses ? "Pagos, planes, un negocio por nombre o email…" : "¿A qué pantalla querés ir?"} aria-label="Buscar" role="combobox" aria-expanded aria-controls="admin-cmd-list" aria-activedescendant={rows[sel] ? `cmd-${sel}` : undefined}
            className="h-14 flex-1 border-0 bg-transparent text-base text-[#0E1B2C] shadow-none outline-none placeholder:text-[#6B7587] focus-visible:shadow-none" />
        </div>
        <ul id="admin-cmd-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {rows.length === 0 && <li className="px-4 py-8 text-center text-sm text-[#5B6577]">No encontramos nada con «{q}».</li>}
          {rows.map((r, i) => (
            <li key={`${r.kind}-${r.id}`} id={`cmd-${i}`} role="option" aria-selected={i === sel}>
              {(i === 0 || rows[i - 1]!.kind !== r.kind) && <p className="px-3 pb-1 pt-3 text-xs font-semibold text-[#5B6577]">{r.kind === "page" ? "Pantallas" : "Negocios"}</p>}
              <button type="button" onMouseMove={() => setSel(i)} onClick={() => go(r)} className={`flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left ${i === sel ? "bg-[#FFF1E8]" : ""}`}>
                <span className="font-semibold text-[#0E1B2C]">{r.label}</span>
                <span className="truncate text-sm text-[#5B6577]">{r.hint}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="flex gap-4 border-t border-[#EEF0F4] bg-[#FAFBFD] px-5 py-2.5 text-xs text-[#5B6577]"><span>↑ ↓ para moverte</span><span>Enter para abrir</span><span>Esc para cerrar</span></p>
      </div>
    </div>
  );
}
