"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createDraftFromTemplate, saveDraft, type TemplateInput } from "@/lib/draft";
import type { TemplateSummary } from "@/lib/api";
import { getTheme } from "@/lib/themes";
import { IconBolt, IconChair, IconCheck, IconDumbbell, IconFood, IconParty, IconShirt, IconSparkle, IconStore } from "@/components/marketing/Doodles";

const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const ICONS: Record<string, (p: { className?: string }) => ReactNode> = {
  rotiseria: IconFood, bar: IconFood, ropa: IconShirt, muebles: IconChair, eventos: IconParty, gimnasio: IconDumbbell,
  oficios: IconBolt, belleza: IconSparkle, salud: IconCheck,
};

/** Rubros como tarjetas con la identidad de MiShowo: ícono, color del estilo inicial y entrada escalonada. Al elegir, prepara el borrador y abre el editor. */
export function IndustryPicker({ templates }: { templates: TemplateSummary[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(id: string) {
    setLoading(id);
    setError(null);
    try {
      const res = await fetch(`${PUBLIC_API}/public/templates/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("No pudimos cargar el rubro");
      const tpl = (await res.json()) as TemplateInput;
      saveDraft(createDraftFromTemplate(tpl));
      router.push("/editor");
    } catch {
      setError("No pudimos cargar ese rubro. Revisá tu conexión e intentá de nuevo.");
      setLoading(null);
    }
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-4 border-l-4 border-destructive bg-white p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t, i) => {
          const theme = getTheme(t.theme);
          const Icon = ICONS[t.id] ?? IconStore;
          const busy = loading === t.id;
          return (
            <li key={t.id} className="site-rise" style={{ "--d": `${280 + i * 55}ms` } as CSSProperties}>
              <button
                type="button"
                onClick={() => choose(t.id)}
                disabled={loading !== null}
                aria-busy={busy}
                className="group relative flex h-full w-full items-center gap-4 overflow-hidden rounded-2xl border border-[#0E1B2C]/10 bg-white p-4 text-left shadow-[0_1px_0_rgba(14,27,44,0.04),0_24px_50px_-36px_rgba(47,111,176,0.55)] transition duration-200 hover:-translate-y-1 hover:border-[#2F6FB0] hover:shadow-[0_30px_60px_-34px_rgba(47,111,176,0.8)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F6FB0] disabled:opacity-60 sm:p-5"
              >
                <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-xl" style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.primary }}>
                  <Icon className="size-7" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-extrabold leading-tight text-[#0E1B2C]">{t.name}</span>
                  <span className="mt-0.5 block text-sm text-[#0E1B2C]/65">{busy ? "Preparando tu página…" : t.blurb}</span>
                </span>
                <span aria-hidden className="shrink-0 text-xl font-bold text-[#2F6FB0] transition-transform duration-200 group-hover:translate-x-1">{busy ? "…" : "→"}</span>
                {busy && <span aria-hidden className="mk-steps-bar absolute inset-x-0 bottom-0 h-1 origin-left bg-[#2F6FB0]" style={{ animationDuration: "1.8s" }} />}
              </button>
            </li>
          );
        })}
        <li className="site-rise" style={{ "--d": `${280 + templates.length * 55}ms` } as CSSProperties}>
          <div aria-disabled="true" className="flex h-full w-full items-center gap-4 rounded-2xl border-2 border-dashed border-[#0E1B2C]/20 bg-white/50 p-4 sm:p-5">
            <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-xl bg-[#EAF4FC] text-[#2F6FB0]"><IconSparkle className="size-7" /></span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2 text-lg font-extrabold leading-tight text-[#0E1B2C]/80">
                Contame tu idea
                <span className="rounded-full bg-[#0E1B2C] px-2.5 py-0.5 text-xs font-bold text-white">Próximamente</span>
              </span>
              <span className="mt-0.5 block text-sm text-[#0E1B2C]/60">Describí tu negocio y armamos los textos por vos</span>
            </span>
          </div>
        </li>
      </ul>
    </div>
  );
}
