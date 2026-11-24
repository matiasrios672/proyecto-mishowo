"use client";

import { useState } from "react";
import type { FaqItem } from "@/content/faq";

/** Preguntas en acordeón. Con `initial`, muestra las primeras y el resto se despliega acá mismo, sin cambiar de página. */
export function FaqItems({ items, initial }: { items: FaqItem[]; initial?: number }) {
  const [all, setAll] = useState(false);
  const limited = !!initial && items.length > initial;
  const shown = limited && !all ? items.slice(0, initial) : items;
  return (
    <>
      <div className="mt-10 max-w-3xl divide-y divide-border border-y border-border" data-fx="up">
        {shown.map((f) => (
          <details key={f.q} className="group py-5">
            <summary className="mk-display flex cursor-pointer list-none items-center justify-between gap-4 text-xl font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              {f.q}
              <span aria-hidden className="text-2xl font-normal transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 max-w-[60ch] leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
      {limited && (
        <button type="button" aria-expanded={all} onClick={() => setAll((v) => !v)}
          className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-[#0E1B2C]/15 bg-white px-5 font-bold text-[#0E1B2C] shadow-sm transition hover:border-[#0E1B2C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {all ? "Ver menos preguntas" : `Ver las ${items.length - initial!} preguntas restantes`}
        </button>
      )}
    </>
  );
}
