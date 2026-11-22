"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteView } from "@/components/site/SiteView";
import { createDraftFromTemplate, saveDraft, type TemplateInput } from "@/lib/draft";
import { draftToSite } from "@/lib/site";
import { THEMES } from "@/lib/themes";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const RUBROS = [
  { id: "rotiseria", label: "Comidas" },
  { id: "ropa", label: "Ropa" },
  { id: "belleza", label: "Belleza" },
  { id: "gimnasio", label: "Gimnasio" },
  { id: "muebles", label: "Muebles" },
] as const;

/**
 * Demo del producto real: usa el mismo componente que las páginas de los negocios, así lo que se ve
 * acá es exactamente lo que va a tener el cliente. "Usar este diseño" lleva al editor con todo cargado.
 */
export function LiveDemo({ initial }: { initial?: TemplateInput | null }) {
  const router = useRouter();
  const [rubro, setRubro] = useState<string>("rotiseria");
  const [name, setName] = useState("");
  const [theme, setTheme] = useState<string | null>(null);
  // El primer rubro llega ya armado desde el servidor: la demo se ve en el primer HTML, sin esperar JS ni la API.
  const [templates, setTemplates] = useState<Record<string, TemplateInput>>(initial ? { rotiseria: initial } : {});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (templates[rubro]) return;
    let alive = true;
    fetch(`${API}/public/templates/${rubro}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((t: TemplateInput) => alive && setTemplates((cur) => ({ ...cur, [rubro]: t })))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [rubro, templates]);

  const tpl = templates[rubro];
  const draft = useMemo(() => {
    if (!tpl) return null;
    const d = createDraftFromTemplate(tpl);
    if (name.trim()) { d.name = name.trim(); d.nameIsExample = false; }
    if (theme) d.design = { ...d.design, theme };
    return d;
  }, [tpl, name, theme]);
  const site = useMemo(() => (draft ? { ...draftToSite(draft), whatsapp: "1155550000" } : null), [draft]);

  function startFromDemo() {
    if (!draft) return;
    saveDraft(draft);
    router.push("/editor");
  }

  return (
    <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]" data-testid="live-demo">
      <div className="order-2 space-y-5 md:order-1">
        <div>
          <label htmlFor="demo-name" className="mk-display text-lg font-bold">¿Cómo se llama tu negocio?</label>
          <input
            id="demo-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Ej: Panadería del Sol"
            className="mt-2 w-full rounded-xl border-2 border-border bg-white px-4 py-3 text-lg outline-none focus-visible:border-primary"
          />
          <p className="mt-2 text-sm text-muted-foreground">
            Tu link va a ser <strong className="text-foreground">{(name.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tunegocio")}.mishowo.com</strong>
          </p>
        </div>

        <fieldset>
          <legend className="mk-display text-lg font-bold">¿Qué vendés?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {RUBROS.map((r) => (
              <button
                key={r.id} type="button" aria-pressed={rubro === r.id} onClick={() => { setRubro(r.id); setTheme(null); setFailed(false); }}
                className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors ${rubro === r.id ? "border-[#0E1B2C] bg-[#0E1B2C] text-white" : "border-border bg-white hover:border-primary"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mk-display text-lg font-bold">Elegí tu estilo</legend>
          <div className="mt-2 flex flex-wrap gap-2.5" role="radiogroup" aria-label="Estilo de color">
            {THEMES.map((t) => {
              const active = (theme ?? tpl?.theme) === t.id;
              return (
                <button
                  key={t.id} type="button" role="radio" aria-checked={active} aria-label={t.name} title={t.name} onClick={() => setTheme(t.id)}
                  className={`size-10 rounded-full border-2 transition-transform active:scale-90 ${active ? "scale-110 border-[#0E1B2C]" : "border-white shadow-[0_0_0_1px_var(--border)]"}`}
                  style={{ background: `linear-gradient(135deg, ${t.bg} 50%, ${t.primary} 50%)` }}
                />
              );
            })}
          </div>
        </fieldset>

        <button
          type="button" onClick={startFromDemo} disabled={!draft}
          className="inline-flex items-center justify-center rounded-xl bg-[#F6B40E] px-6 py-3.5 text-base font-bold text-[#0E1B2C] transition-transform hover:bg-[#FFC21F] active:scale-95 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Usar este diseño para mi página
        </button>
        {failed && <p role="alert" className="text-sm text-destructive">No pudimos cargar el ejemplo. Probá de nuevo en un momento.</p>}
      </div>

      <div className="order-1 md:order-2">
        <div className="mx-auto w-[330px] max-w-full rounded-[2.6rem] bg-[#0E1B2C] p-3 shadow-[0_40px_80px_-20px_rgba(14,27,44,0.45)]">
          <div className="h-[600px] overflow-y-auto overscroll-contain rounded-[2rem] bg-white" tabIndex={0} aria-label="Vista previa de tu página">
            {site ? <SiteView site={site} preview /> : <p className="p-6 text-sm text-muted-foreground">Cargando ejemplo…</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
