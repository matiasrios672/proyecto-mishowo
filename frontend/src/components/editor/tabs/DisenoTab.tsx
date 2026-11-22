"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Section, TextInput } from "@/components/ui/fields";
import { SiteView } from "@/components/site/SiteView";
import { extractBrandColor } from "@/lib/color";
import { FONT_PAIRS, fontPairStyle } from "@/lib/fonts";
import { LAYOUTS, THEME_SUGGESTION_NOTE, recommendLayout } from "@/lib/recommend";
import { draftToSite } from "@/lib/site";
import { THEMES, contrast, isValidHex, readableOn } from "@/lib/themes";
import type { TabProps } from "./types";

const SHAPES = [
  { id: "redondeado", name: "Redondeado", radius: "0.5rem" },
  { id: "pildora", name: "Píldora", radius: "9999px" },
  { id: "recto", name: "Recto", radius: "2px" },
] as const;

export function DisenoTab({ draft, update }: TabProps) {
  const design = draft.design;
  const recommended = recommendLayout(draft);
  const [comparing, setComparing] = useState(false);
  const [hex, setHex] = useState<string | null>(null);
  const [logoMsg, setLogoMsg] = useState<string | null>(null);
  const setDesign = (patch: Partial<typeof design>) => update((d) => ({ ...d, design: { ...d.design, ...patch } }));

  const brand = design.brandColor;
  const hexShown = hex ?? brand ?? "";
  const lowContrast = brand && contrast(brand, readableOn(brand)) < 4.5;

  async function onLogo(file: File | undefined) {
    if (!file) return;
    setLogoMsg(null);
    try {
      const c = await extractBrandColor(file);
      if (c) { setDesign({ brandColor: c }); setLogoMsg(`Usamos el color ${c} de tu logo.`); }
      else setLogoMsg("No encontramos un color claro en ese logo. Elegilo a mano.");
    } catch {
      setLogoMsg("No pudimos leer esa imagen. Probá con un PNG o JPG.");
    }
  }

  return (
    <div className="space-y-8">
      <Section title="Diseño" description={THEME_SUGGESTION_NOTE}>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Diseño de la página">
          {LAYOUTS.map((l) => (
            <li key={l.id}>
              <button type="button" role="radio" aria-checked={design.layout === l.id} onClick={() => setDesign({ layout: l.id })}
                className={`w-full rounded-xl border p-3 text-left ${design.layout === l.id ? "border-primary ring-2 ring-primary" : ""}`}>
                <span className="flex items-center gap-2 font-medium">
                  {l.name}
                  {recommended === l.id && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Recomendado</span>}
                </span>
                <span className="block text-xs text-muted-foreground">{l.blurb}</span>
              </button>
            </li>
          ))}
        </ul>
        <Button variant="outline" onClick={() => setComparing((v) => !v)} aria-expanded={comparing}>{comparing ? "Cerrar comparación" : "Comparar diseños lado a lado"}</Button>
        {comparing && (
          <div className="grid grid-cols-2 gap-3" data-testid="compare">
            {LAYOUTS.map((l) => (
              <div key={l.id} className="space-y-2">
                <div className="h-72 overflow-hidden rounded-lg border">
                  <div style={{ width: 390, transform: "scale(0.42)", transformOrigin: "top left" }} aria-hidden inert>
                    <SiteView site={{ ...draftToSite(draft), design: { ...draft.design, layout: l.id } }} preview />
                  </div>
                </div>
                <Button size="sm" variant={design.layout === l.id ? "default" : "outline"} className="w-full" onClick={() => setDesign({ layout: l.id })}>
                  {design.layout === l.id ? `${l.name} ✓` : `Elegir ${l.name}`}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Colores">
        <ul className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema de color">
          {THEMES.map((t) => (
            <li key={t.id}>
              <button type="button" role="radio" aria-checked={design.theme === t.id} onClick={() => setDesign({ theme: t.id })}
                className={`w-full rounded-xl border p-2 text-left ${design.theme === t.id ? "border-primary ring-2 ring-primary" : ""}`} title={t.suggestedFor}>
                <span aria-hidden className="mb-1 block h-8 rounded-md border" style={{ background: t.bg, borderColor: t.border }}>
                  <span className="block h-full w-1/3 rounded-md" style={{ background: t.primary }} />
                </span>
                <span className="block text-xs font-medium">{t.name}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="space-y-3 rounded-xl border p-3">
          <p className="text-sm font-medium">Color de tu marca</p>
          <p className="text-xs text-muted-foreground">Reemplaza el color de los botones y detalles del tema. Subí tu logo y lo detectamos solo.</p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Elegir color">
              {(id) => <input id={id} type="color" value={brand && isValidHex(brand) ? brand : "#000000"} className="h-10 w-16 rounded border"
                onChange={(e) => { setHex(null); setDesign({ brandColor: e.target.value.toUpperCase() }); }} />}
            </Field>
            <Field label="Código" error={hex !== null && hex !== "" && !isValidHex(hex) ? "Formato: #RRGGBB" : null}>
              {(id, d) => <TextInput id={id} aria-describedby={d} className="w-28" placeholder="#B5472B" value={hexShown} maxLength={7}
                onChange={(e) => { const v = e.target.value; setHex(v); if (isValidHex(v)) setDesign({ brandColor: v.toUpperCase() }); else if (v === "") setDesign({ brandColor: null }); }}
                onBlur={() => setHex(null)} />}
            </Field>
            <Field label="Detectar desde mi logo">
              {(id) => <input id={id} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => onLogo(e.target.files?.[0])} />}
            </Field>
            {brand && <Button variant="ghost" onClick={() => { setHex(null); setLogoMsg(null); setDesign({ brandColor: null }); }}>Usar el color del tema</Button>}
          </div>
          {logoMsg && <p className="text-sm" role="status">{logoMsg}</p>}
          {lowContrast && <p className="text-sm text-destructive">Este color tiene poco contraste con el texto de los botones. Probá uno más oscuro o más claro.</p>}
        </div>
      </Section>

      <Section title="Tipografía">
        <ul className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipografía">
          {FONT_PAIRS.map((p) => (
            <li key={p.id} className={p.classes}>
              <button type="button" role="radio" aria-checked={design.fontPair === p.id} onClick={() => setDesign({ fontPair: p.id })}
                style={fontPairStyle(p.id)} className={`w-full rounded-xl border p-3 text-left ${design.fontPair === p.id ? "border-primary ring-2 ring-primary" : ""}`}>
                <span className="block text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>Aa {p.name}</span>
                <span className="block text-xs">Pedí por WhatsApp</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Forma de los botones">
        <ul className="flex gap-2" role="radiogroup" aria-label="Forma de los botones">
          {SHAPES.map((s) => (
            <li key={s.id}>
              <button type="button" role="radio" aria-checked={design.buttonShape === s.id} onClick={() => setDesign({ buttonShape: s.id })}
                className={`border px-4 py-2 text-sm ${design.buttonShape === s.id ? "bg-primary text-primary-foreground" : ""}`} style={{ borderRadius: s.radius }}>
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
