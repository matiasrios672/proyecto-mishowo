"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/authClient";
import { NEW_PAGE, getActivePage, setActivePage, switchPage } from "@/lib/activePage";

interface PageRow { id: string; name: string; slug: string; status: string; planId: string }

/**
 * Selector de página del panel: una cuenta puede tener varias y cada una tiene su plan y su vencimiento.
 * Con una sola página muestra su nombre y el acceso para sumar otra.
 */
export function PageSwitcher() {
  const router = useRouter();
  const [pages, setPages] = useState<PageRow[] | null>(null);
  const [max, setMax] = useState(10);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ pages: PageRow[]; max: number }>("/me/pages").then((r) => {
      if (!alive || !r.ok) return;
      const stored = getActivePage();
      // Una página que ya no es de esta cuenta (o «new» sin terminar de crear) no puede quedar elegida.
      const valid = r.data.pages.find((p) => p.id === stored)?.id ?? (stored === NEW_PAGE ? stored : null);
      if (stored && !valid) setActivePage(null);
      setActive(valid ?? r.data.pages[0]?.id ?? null);
      setPages(r.data.pages);
      setMax(r.data.max);
    });
    return () => { alive = false; };
  }, []);

  if (!pages || pages.length === 0) return null;
  const canAdd = pages.length < max;

  function choose(id: string) {
    if (id === active) return;
    switchPage(id);
    window.location.href = "/panel/inicio"; // recarga completa: cada módulo vuelve a pedir los datos de la página elegida
  }
  function addPage() {
    router.push("/crear?nueva=1");
  }

  return (
    <div className="mb-3 space-y-1.5 rounded-2xl border border-[#E5E8EF] bg-gradient-to-b from-white to-[#F7F8FB] p-3" data-testid="page-switcher">
      <label htmlFor="page-select" className="block px-1 text-xs font-semibold text-[#7A8497]">Página activa</label>
      {pages.length > 1 ? (
        <select id="page-select" value={active ?? ""} onChange={(e) => choose(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-[#D1D5DB] bg-white px-3 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {pages.map((p) => <option key={p.id} value={p.id}>{p.name || p.slug}{p.status === "published" ? "" : " (borrador)"}</option>)}
        </select>
      ) : (
        <p className="truncate px-1 text-[15px] font-bold text-[#151B2B]" title={pages[0]!.name}>{pages[0]!.name || pages[0]!.slug}</p>
      )}
      {canAdd && (
        <button type="button" onClick={addPage} data-testid="add-page"
          className="min-h-9 w-full rounded-xl border border-dashed border-[#D5D9E2] px-3 text-[13px] font-semibold text-[#C73E00] hover:border-[#FC5502] hover:bg-[#FFF4EC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">+ Agregar otra página</button>
      )}
    </div>
  );
}
