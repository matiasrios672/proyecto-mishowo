"use client";

import { useId, useState } from "react";
import { normalizeSearch } from "@/lib/format";

/**
 * Buscador del catálogo. La página se renderiza en el servidor, así que en vez de re-renderizar
 * todo en el cliente se muestran/ocultan los productos ya dibujados (`data-search`). Poco JS.
 */
export function CatalogSearch({ rootId }: { rootId: string }) {
  const id = useId();
  const [visible, setVisible] = useState<number | null>(null);

  function filter(value: string) {
    const root = document.getElementById(rootId);
    if (!root) return;
    const q = normalizeSearch(value);
    let shown = 0;
    root.querySelectorAll<HTMLElement>("[data-search]").forEach((el) => {
      const match = !q || (el.dataset.search ?? "").includes(q);
      el.hidden = !match;
      if (match) shown++;
    });
    root.querySelectorAll<HTMLElement>("[data-section]").forEach((sec) => {
      sec.hidden = sec.querySelectorAll("[data-search]:not([hidden])").length === 0;
    });
    setVisible(q ? shown : null);
  }

  return (
    <div className="pb-2">
      <label htmlFor={id} className="sr-only">Buscar en el catálogo</label>
      <input id={id} type="search" placeholder="Buscar productos…" onChange={(e) => filter(e.target.value)}
        className="w-full rounded-full border border-input bg-card px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
      <p role="status" aria-live="polite" className="mt-1 text-xs text-muted-foreground">
        {visible === 0 ? "No encontramos productos con esa búsqueda." : ""}
      </p>
    </div>
  );
}
