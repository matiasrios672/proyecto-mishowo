"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand/Wordmark";
import { SiteView } from "@/components/site/SiteView";
import { draftToSite } from "@/lib/site";
import { quality, type EditorTab } from "@/lib/score";
import type { Draft } from "@/lib/draft";
import { saveLabel, useEditor } from "./useEditor";
import { NegocioTab } from "./tabs/NegocioTab";
import { TextosTab } from "./tabs/TextosTab";
import { FotosTab } from "./tabs/FotosTab";
import { ProductosTab } from "./tabs/ProductosTab";
import { PedidosTab } from "./tabs/PedidosTab";
import { DisenoTab } from "./tabs/DisenoTab";
import { SeoTab } from "./tabs/SeoTab";
import { PublicarTab } from "./tabs/PublicarTab";

const TABS: { id: EditorTab; label: string }[] = [
  { id: "negocio", label: "Negocio" },
  { id: "textos", label: "Textos" },
  { id: "fotos", label: "Fotos" },
  { id: "productos", label: "Productos" },
  { id: "pedidos", label: "Pedidos" },
  { id: "diseno", label: "Diseño" },
  { id: "seo", label: "SEO y compartir" },
  { id: "publicar", label: "Publicar" },
];

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

export function Editor({ initial }: { initial: Draft }) {
  const { draft, update, undo, redo, canUndo, canRedo, save, now } = useEditor(initial);
  const [tab, setTab] = useState<EditorTab>("negocio");
  const [device, setDevice] = useState<"celular" | "computadora">("celular");
  const [mobileView, setMobileView] = useState<"editar" | "ver">("editar");
  const [fullscreen, setFullscreen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const q = quality(draft);
  const site = draftToSite(draft);

  // Deshacer/rehacer con teclado, salvo dentro de un campo de texto (ahí manda el navegador).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFullscreen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  function goTab(t: EditorTab) {
    setTab(t);
    setMobileView("editar");
    panelRef.current?.scrollTo({ top: 0 });
  }

  const props = { draft, update, goTab };
  const preview = (
    <div className={`mx-auto bg-background ${device === "celular" ? "w-[390px] max-w-full rounded-[2rem] border-8 border-foreground/80" : "w-full max-w-2xl rounded-lg border"} overflow-hidden`} data-testid="preview-frame" data-device={device}>
      <SiteView site={site} preview />
    </div>
  );

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2">
        <Wordmark />
        <span className="min-w-0 flex-1 truncate text-sm font-medium" data-testid="header-name">{draft.name}</span>
        <span className="text-xs text-muted-foreground" role="status" aria-live="polite" data-testid="save-status">{saveLabel(save, now)}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo} aria-label="Deshacer">↶ Deshacer</Button>
          <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo} aria-label="Rehacer">↷ Rehacer</Button>
        </div>
        <button type="button" onClick={() => goTab("publicar")} className="rounded-full border px-3 py-1 text-xs font-medium" aria-label={`Calidad de tu página: ${q.score} por ciento. Ver pendientes`}>
          {q.score}% listo
        </button>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,30rem)_1fr]">
        <div className={`flex min-h-0 min-w-0 flex-col ${mobileView === "ver" ? "hidden lg:flex" : "flex"}`}>
          <div role="tablist" aria-label="Secciones del editor" className="flex gap-1 overflow-x-auto border-b px-2 py-2">
            {TABS.map((t) => (
              <button key={t.id} id={`tab-${t.id}`} role="tab" type="button" aria-selected={tab === t.id} aria-controls="panel"
                onClick={() => setTab(t.id)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${tab === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div id="panel" role="tabpanel" aria-labelledby={`tab-${tab}`} ref={panelRef} className="min-h-0 flex-1 overflow-y-auto p-4 pb-28 lg:pb-8">
            {tab === "negocio" && <NegocioTab {...props} />}
            {tab === "textos" && <TextosTab {...props} />}
            {tab === "fotos" && <FotosTab />}
            {tab === "productos" && <ProductosTab {...props} />}
            {tab === "pedidos" && <PedidosTab {...props} />}
            {tab === "diseno" && <DisenoTab {...props} />}
            {tab === "seo" && <SeoTab {...props} />}
            {tab === "publicar" && <PublicarTab {...props} />}
          </div>
        </div>

        <aside aria-label="Vista previa" className={`min-h-0 min-w-0 flex-col border-l bg-muted/40 ${mobileView === "ver" ? "flex" : "hidden lg:flex"}`}>
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <div role="group" aria-label="Dispositivo" className="flex gap-1">
              {(["celular", "computadora"] as const).map((d) => (
                <Button key={d} size="sm" variant={device === d ? "default" : "outline"} aria-pressed={device === d} onClick={() => setDevice(d)}>
                  {d === "celular" ? "Celular" : "Computadora"}
                </Button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={() => setFullscreen(true)}>Pantalla completa</Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-28 lg:pb-4">{preview}</div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center lg:hidden">
        <Button size="lg" className="shadow-lg" onClick={() => setMobileView((v) => (v === "editar" ? "ver" : "editar"))} data-testid="toggle-view">
          {mobileView === "editar" ? "Ver cómo queda" : "Seguir editando"}
        </Button>
      </div>

      {fullscreen && (
        <div role="dialog" aria-modal="true" aria-label="Vista previa en pantalla completa" className="fixed inset-0 z-50 overflow-y-auto bg-background">
          <div className="sticky top-0 z-10 flex justify-end border-b bg-background p-2">
            <Button onClick={() => setFullscreen(false)} autoFocus>Cerrar vista previa</Button>
          </div>
          <div className="mx-auto max-w-2xl"><SiteView site={site} preview /></div>
        </div>
      )}
    </div>
  );
}
