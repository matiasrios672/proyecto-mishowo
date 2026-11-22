"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { IconBag, IconBolt, IconChat, IconEdit, IconGoogle, IconSparkle, IconStore } from "@/components/marketing/Doodles";
import { IconArrowLeft, IconArrowRight, IconImage, IconRedo, IconUndo } from "@/components/marketing/Icons2";
import { SiteView } from "@/components/site/SiteView";
import { draftToSite } from "@/lib/site";
import { quality, type EditorTab } from "@/lib/score";
import { clearDraft, contentToDraft, type Draft } from "@/lib/draft";
import { clearSyncMarker, fetchServerBusiness } from "@/lib/serverSync";
import { saveLabel, useEditor, type SyncConfig } from "./useEditor";
import { logout, setLogoutHook, useUser } from "@/components/auth/authStore";
import { api } from "@/lib/authClient";
import { NegocioTab } from "./tabs/NegocioTab";
import { TextosTab } from "./tabs/TextosTab";
import { FotosTab } from "./tabs/FotosTab";
import { ProductosTab } from "./tabs/ProductosTab";
import { PedidosTab } from "./tabs/PedidosTab";
import { DisenoTab } from "./tabs/DisenoTab";
import { SeoTab } from "./tabs/SeoTab";
import { PublicarTab } from "./tabs/PublicarTab";

const TABS: { id: EditorTab; label: string; hint: string; Icon: (p: { className?: string }) => React.ReactNode }[] = [
  { id: "negocio", label: "Negocio", hint: "Nombre, WhatsApp, horarios", Icon: IconStore },
  { id: "textos", label: "Textos", hint: "Cómo te presentás", Icon: IconEdit },
  { id: "fotos", label: "Fotos", hint: "Logo, portada y productos", Icon: IconImage },
  { id: "productos", label: "Productos", hint: "Tu catálogo y precios", Icon: IconBag },
  { id: "pedidos", label: "Pedidos", hint: "Cómo te piden", Icon: IconChat },
  { id: "diseno", label: "Diseño", hint: "Colores y estilo", Icon: IconSparkle },
  { id: "seo", label: "SEO y compartir", hint: "Google y redes", Icon: IconGoogle },
  { id: "publicar", label: "Publicar", hint: "Tu link y revisión final", Icon: IconBolt },
];

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

export function Editor({ initial, sync }: { initial: Draft; sync?: SyncConfig }) {
  const { draft, update, undo, redo, canUndo, canRedo, save, now, syncState, syncEnabled, keepMine, adoptServer, resumeSync, prepareSignOut, settleNow } = useEditor(initial, sync);
  const [conflictBusy, setConflictBusy] = useState(false);
  const [tab, setTab] = useState<EditorTab>("negocio");
  const [device, setDevice] = useState<"celular" | "computadora">("celular");
  const [mobileView, setMobileView] = useState<"editar" | "ver">("editar");
  const [fullscreen, setFullscreen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const user = useUser();
  const [resend, setResend] = useState<"idle" | "sending" | "sent" | "error">("idle");
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

  /** Cierra sesión sin dejar el borrador de la cuenta en esta computadora. */
  async function signOut() {
    await prepareSignOut();
    clearDraft();
    clearSyncMarker();
    await logout();
  }

  // La barra lateral del panel cierra la sesión por acá: así siempre se limpia el borrador de esta computadora.
  const signOutRef = useRef(signOut);
  useEffect(() => { signOutRef.current = signOut; });
  useEffect(() => {
    setLogoutHook(() => signOutRef.current());
    return () => setLogoutHook(null);
  }, []);

  async function loadAccountVersion() {
    setConflictBusy(true);
    const r = await fetchServerBusiness();
    setConflictBusy(false);
    if (r.kind === "ok" && r.business && r.content) adoptServer(contentToDraft(r.content), r.business.version);
  }

  function goTab(t: EditorTab) {
    setTab(t);
    setMobileView("editar");
    panelRef.current?.scrollTo({ top: 0 });
  }

  const props = { draft, update, goTab, account: { enabled: syncEnabled, settle: settleNow } };
  const preview = (
    <div className={`mx-auto bg-background ${device === "celular" ? "w-[390px] max-w-full rounded-[2rem] border-8 border-foreground/80" : "w-full max-w-5xl rounded-lg border"} overflow-hidden`} data-testid="preview-frame" data-device={device}>
      <SiteView site={site} preview />
    </div>
  );

  const idx = TABS.findIndex((t) => t.id === tab);
  const prev = TABS[idx - 1];
  const next = TABS[idx + 1];
  const iconBtn = "grid size-10 place-items-center rounded-lg text-[#0E1B2C] hover:bg-[#EAF4FC] focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-35";

  return (
    <div className={`flex flex-col bg-white ${user ? "h-full" : "h-dvh"}`}>
      <header className="flex shrink-0 items-center gap-2 border-b border-[#D6E4F2] bg-white px-3 py-2 sm:gap-3 sm:px-4">
        {!user && <Link href="/" aria-label="MiShowo, ir al inicio" className="font-heading text-lg font-bold">Mi<span className="text-primary">Showo</span></Link>}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-bold" data-testid="header-name">{draft.name}</p>
          <p className="truncate text-xs text-muted-foreground" role="status" aria-live="polite" data-testid="save-status">{saveLabel(save, now, syncState, syncEnabled)}</p>
        </div>
        <div className="flex items-center">
          <button type="button" className={iconBtn} onClick={undo} disabled={!canUndo} aria-label="Deshacer" title="Deshacer (Ctrl+Z)"><IconUndo className="size-5" /></button>
          <button type="button" className={iconBtn} onClick={redo} disabled={!canRedo} aria-label="Rehacer" title="Rehacer (Ctrl+Y)"><IconRedo className="size-5" /></button>
        </div>
        <button type="button" onClick={() => goTab("publicar")} className="hidden min-h-10 items-center rounded-full border border-[#D6E4F2] px-3 text-sm font-semibold hover:bg-[#EAF4FC] focus-visible:outline-2 focus-visible:outline-ring md:inline-flex" aria-label={`Calidad de tu página: ${q.score} por ciento. Ver pendientes`}>
          {q.score}% listo
        </button>
        {user === null ? (
          <Button size="lg" render={<Link href="/registro?next=/editor" />}>Guardar mi página</Button>
        ) : (
          <Button size="lg" onClick={() => goTab("publicar")}>Publicar</Button>
        )}
      </header>

      {syncEnabled && syncState.kind === "conflict" && (
        <div role="alert" className="flex flex-wrap items-center gap-2 border-b bg-destructive/10 px-4 py-2 text-sm" data-testid="conflict-banner">
          <span>Tu página se modificó desde otro dispositivo. Elegí qué versión conservar:</span>
          <Button size="sm" variant="outline" disabled={conflictBusy} onClick={() => void loadAccountVersion()}>Usar la de mi cuenta</Button>
          <Button size="sm" variant="outline" onClick={() => keepMine(syncState.serverVersion)}>Quedarme con esta</Button>
        </div>
      )}
      {syncEnabled && syncState.kind === "unauthorized" && (
        <div role="alert" className="flex flex-wrap items-center gap-2 border-b bg-destructive/10 px-4 py-2 text-sm" data-testid="unauthorized-banner">
          <span>Tu sesión venció, por eso no se está guardando en tu cuenta. Tus cambios siguen acá.</span>
          <Button size="sm" render={<Link href="/ingresar?next=/editor" />} onClick={resumeSync}>Ingresar de nuevo</Button>
        </div>
      )}

      {user && !user.emailVerified && (
        <div role="status" className="flex flex-wrap items-center gap-2 border-b bg-muted px-4 py-2 text-sm" data-testid="verify-banner">
          <span>Confirmá tu email para poder publicar. Te mandamos un enlace a <strong>{user.email}</strong>.</span>
          <Button variant="outline" size="sm" disabled={resend === "sending" || resend === "sent"}
            onClick={async () => { setResend("sending"); const r = await api("/auth/resend-verification", { body: {} }); setResend(r.ok ? "sent" : "error"); }}>
            {resend === "sent" ? "Enviado ✓" : resend === "sending" ? "Enviando…" : "Reenviar el email"}
          </Button>
          {resend === "error" && <span className="text-destructive">No pudimos enviarlo, probá de nuevo.</span>}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,30rem)_minmax(0,1fr)] xl:grid-rows-1">
        <div role="tablist" aria-label="Secciones del editor" aria-orientation="horizontal"
          onKeyDown={(e) => {
            const keys = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"];
            if (!keys.includes(e.key)) return;
            e.preventDefault();
            const i = e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : (idx + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1) + TABS.length) % TABS.length;
            setTab(TABS[i]!.id);
            document.getElementById(`tab-${TABS[i]!.id}`)?.focus();
          }}
          className={`mk-tabstrip relative flex shrink-0 gap-1 overflow-x-auto border-b border-[#D6E4F2] bg-[#F4F9FE] px-2 py-2 lg:col-start-1 lg:row-start-1 xl:flex-col xl:gap-0.5 xl:overflow-y-auto xl:border-b-0 xl:border-r xl:px-3 xl:py-4 ${mobileView === "ver" ? "hidden lg:flex" : "flex"}`}>
          {TABS.map((t, n) => (
            <button key={t.id} id={`tab-${t.id}`} role="tab" type="button" aria-label={t.label} aria-posinset={n + 1} aria-setsize={TABS.length} title={t.hint} aria-selected={tab === t.id} aria-controls="panel" tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)} ref={(el) => { if (el && tab === t.id) el.scrollIntoView?.({ block: "nearest", inline: "center" }); }}
              className={`flex min-h-11 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring xl:w-full ${tab === t.id ? "bg-[#2F6FB0] text-white shadow-[0_8px_18px_-10px_rgba(47,111,176,0.9)]" : "text-[#0E1B2C] hover:bg-[#EAF4FC]"}`}>
              <t.Icon className={`size-5 shrink-0 ${tab === t.id ? "text-white" : "text-[#2F6FB0]"}`} />
              <span className="flex flex-col items-start text-left leading-tight">
                <span>{t.label}</span>
                <span className={`hidden text-xs font-normal xl:block ${tab === t.id ? "text-white/80" : "text-[#47566A]"}`}>{t.hint}</span>
              </span>
            </button>
          ))}
        </div>

        <div className={`min-h-0 min-w-0 flex-1 flex-col lg:col-start-1 lg:row-start-2 xl:col-start-2 xl:row-start-1 ${mobileView === "ver" ? "hidden lg:flex" : "flex"}`}>
          <div id="panel" role="tabpanel" aria-labelledby={`tab-${tab}`} ref={panelRef} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto p-4 pb-6 outline-none sm:p-5">
            {tab === "negocio" && <NegocioTab {...props} />}
            {tab === "textos" && <TextosTab {...props} />}
            {tab === "fotos" && <FotosTab {...props} />}
            {tab === "productos" && <ProductosTab {...props} />}
            {tab === "pedidos" && <PedidosTab {...props} />}
            {tab === "diseno" && <DisenoTab {...props} />}
            {tab === "seo" && <SeoTab {...props} />}
            {tab === "publicar" && <PublicarTab {...props} />}
          </div>
          <nav aria-label="Pasos" className="hidden shrink-0 items-center justify-between gap-2 border-t border-[#D6E4F2] bg-white px-4 py-3 lg:flex">
            {prev ? <Button variant="outline" size="lg" onClick={() => goTab(prev.id)}><IconArrowLeft className="size-4" />{prev.label}</Button> : <span />}
            {next ? <Button size="lg" onClick={() => goTab(next.id)}>Siguiente: {next.label}<IconArrowRight className="size-4" /></Button> : <span />}
          </nav>
        </div>

        <aside aria-label="Vista previa" className={`min-h-0 min-w-0 flex-1 flex-col border-l border-[#D6E4F2] bg-[#EAF4FC]/60 lg:col-start-2 lg:row-span-2 lg:row-start-1 xl:col-start-3 xl:row-span-1 ${mobileView === "ver" ? "flex" : "hidden lg:flex"}`}>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#D6E4F2] bg-white/70 px-3 py-2">
            <div role="group" aria-label="Dispositivo" className="flex gap-1">
              {(["celular", "computadora"] as const).map((d) => (
                <Button key={d} size="sm" variant={device === d ? "default" : "outline"} aria-pressed={device === d} onClick={() => setDevice(d)} className="min-h-9 px-3">
                  {d === "celular" ? "Celular" : "Computadora"}
                </Button>
              ))}
            </div>
            <Button size="sm" variant="outline" className="min-h-9 px-3" onClick={() => setFullscreen(true)}>Pantalla completa</Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{preview}</div>
        </aside>
      </div>

      {/* Barra inferior del celular: ocupa su propio lugar (no flota), así nunca tapa contenido. */}
      <div className="flex shrink-0 gap-2 border-t border-[#D6E4F2] bg-white p-3 lg:hidden">
        <Button size="lg" variant={mobileView === "editar" ? "outline" : "default"} className="flex-1" onClick={() => setMobileView((v) => (v === "editar" ? "ver" : "editar"))} data-testid="toggle-view">
          {mobileView === "editar" ? "Ver cómo queda" : "Seguir editando"}
        </Button>
        {mobileView === "editar" && next && <Button size="lg" className="flex-1" onClick={() => goTab(next.id)}>Siguiente<IconArrowRight className="size-4" /></Button>}
      </div>

      {fullscreen && (
        <div role="dialog" aria-modal="true" aria-label="Vista previa en pantalla completa" className="fixed inset-0 z-50 overflow-y-auto bg-background">
          <div className="sticky top-0 z-10 flex justify-end border-b bg-background p-2">
            <Button onClick={() => setFullscreen(false)} autoFocus>Cerrar vista previa</Button>
          </div>
          <SiteView site={site} preview />
        </div>
      )}
    </div>
  );
}
