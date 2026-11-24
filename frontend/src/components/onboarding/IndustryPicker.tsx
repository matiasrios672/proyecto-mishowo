"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createDraftFromTemplate, saveDraft, type TemplateInput } from "@/lib/draft";
import type { TemplateSummary } from "@/lib/api";
import { NEW_PAGE, switchPage } from "@/lib/activePage";
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
  /** Rubro ya elegido: falta contestar si recibe pedidos por la página. */
  const [picked, setPicked] = useState<{ tpl: TemplateInput; summary: TemplateSummary } | null>(null);

  async function choose(id: string) {
    setLoading(id);
    setError(null);
    try {
      const res = await fetch(`${PUBLIC_API}/public/templates/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("No pudimos cargar el rubro");
      const tpl = (await res.json()) as TemplateInput;
      setPicked({ tpl, summary: templates.find((t) => t.id === id)! });
      setLoading(null);
    } catch {
      setError("No pudimos cargar ese rubro. Revisá tu conexión e intentá de nuevo.");
      setLoading(null);
    }
  }

  function finish(orders: boolean) {
    if (!picked) return;
    setLoading("finish");
    // «Agregar otra página» llega con ?nueva=1: el próximo guardado crea una página nueva en vez de pisar la abierta.
    if (new URLSearchParams(window.location.search).get("nueva") === "1") switchPage(NEW_PAGE);
    saveDraft({ ...createDraftFromTemplate(picked.tpl), ordersEnabled: orders });
    router.push("/editor");
  }

  if (picked) {
    const services = picked.summary.mode === "servicios";
    const options = [
      { orders: true, title: services ? "Sí, que me escriban para reservar o pedir" : "Sí, que armen el pedido en la página", body: services ? "Cada servicio tiene su botón y el mensaje te llega por WhatsApp ya armado." : "Carrito con total y mensaje de WhatsApp ya armado. Los pedidos quedan anotados en tu panel." },
      { orders: false, title: services ? "No, solo mostrar mis servicios y precios" : "No, solo mostrar mi carta o catálogo", body: "Sin carrito: cada producto tiene un botón «Consultar» que abre WhatsApp. Ideal si atendés en el local, por teléfono o por Instagram." },
    ];
    return (
      <div className="site-rise max-w-3xl" data-testid="orders-question">
        <button type="button" onClick={() => setPicked(null)} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-[#C73E00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C73E00]">← Cambiar de rubro ({picked.summary.name})</button>
        <h2 className="mk-display text-3xl font-extrabold leading-tight text-[#0E1B2C] sm:text-4xl">¿Tus clientes te hacen pedidos por la página?</h2>
        <p className="mt-2 text-[#0E1B2C]/70">Elegí lo que mejor te quede hoy. Lo podés cambiar cuando quieras desde «Pedidos».</p>
        <div role="group" aria-label="Pedidos por la página" className="mt-6 grid gap-4 sm:grid-cols-2">
          {options.map((o) => (
            <button key={String(o.orders)} type="button" disabled={loading !== null} onClick={() => finish(o.orders)} data-testid={o.orders ? "orders-yes" : "orders-no"}
              className="flex flex-col items-start gap-2 rounded-2xl border border-[#0E1B2C]/10 bg-white p-5 text-left shadow-[0_24px_50px_-36px_rgba(252,85,2,0.55)] transition hover:-translate-y-1 hover:border-[#C73E00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C73E00] disabled:opacity-60">
              <span className="text-lg font-extrabold leading-snug text-[#0E1B2C]">{o.title}</span>
              <span className="text-sm text-[#0E1B2C]/70">{o.body}</span>
              <span className="mt-1 text-sm font-bold text-[#C73E00]">{loading === "finish" ? "Preparando tu página…" : "Elegir →"}</span>
            </button>
          ))}
        </div>
      </div>
    );
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
                className="group relative flex h-full w-full items-center gap-4 overflow-hidden rounded-2xl border border-[#0E1B2C]/10 bg-white p-4 text-left shadow-[0_1px_0_rgba(14,27,44,0.04),0_24px_50px_-36px_rgba(252,85,2,0.55)] transition duration-200 hover:-translate-y-1 hover:border-[#C73E00] hover:shadow-[0_30px_60px_-34px_rgba(252,85,2,0.8)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C73E00] disabled:opacity-60 sm:p-5"
              >
                <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-xl" style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.primary }}>
                  <Icon className="size-7" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-extrabold leading-tight text-[#0E1B2C]">{t.name}</span>
                  <span className="mt-0.5 block text-sm text-[#0E1B2C]/65">{busy ? "Preparando tu página…" : t.blurb}</span>
                </span>
                <span aria-hidden className="shrink-0 text-xl font-bold text-[#C73E00] transition-transform duration-200 group-hover:translate-x-1">{busy ? "…" : "→"}</span>
                {busy && <span aria-hidden className="mk-steps-bar absolute inset-x-0 bottom-0 h-1 origin-left bg-[#FC5502]" style={{ animationDuration: "1.8s" }} />}
              </button>
            </li>
          );
        })}
        <li className="site-rise" style={{ "--d": `${280 + templates.length * 55}ms` } as CSSProperties}>
          <div aria-disabled="true" className="flex h-full w-full items-center gap-4 rounded-2xl border-2 border-dashed border-[#0E1B2C]/20 bg-white/50 p-4 sm:p-5">
            <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-xl bg-[#FFEFE6] text-[#C73E00]"><IconSparkle className="size-7" /></span>
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
