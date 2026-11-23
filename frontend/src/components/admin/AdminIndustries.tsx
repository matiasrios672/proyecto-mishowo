"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/ui/fields";
import { api } from "@/lib/authClient";
import { getTheme } from "@/lib/themes";
import { ErrorBox, useAdmin } from "./AdminShell";
import { msg, useLoad } from "./AdminPages";

interface Fields { name?: string; blurb?: string; tagline?: string; theme?: string; layout?: string; fontPair?: string; hidden?: boolean }
interface Industry { id: string; mode: string; locked: boolean; defaults: Required<Omit<Fields, "hidden">>; override: Fields }
interface Data { options: { themes: string[]; layouts: string[]; fontPairs: string[] }; industries: Industry[] }

const LAYOUT_LABEL: Record<string, string> = { vidriera: "Vidriera", mostrador: "Carta", grilla: "Grilla", servicios: "Servicios" };
const FONT_LABEL: Record<string, string> = { clasica: "Clásica", moderna: "Moderna", calida: "Cálida", limpia: "Limpia" };

/** Rubros que se ofrecen al crear una página: nombre, bajada, estilo inicial y cuáles se muestran. El contenido de ejemplo de cada rubro no se edita acá. */
export function Industries() {
  const me = useAdmin();
  const canEdit = me.role !== "support";
  const { data, error, reload } = useLoad<Data>("/admin/industries");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rubros</h1>
        <p className="mt-1 max-w-[64ch] text-muted-foreground">Lo que se ofrece al crear una página. Los cambios se ven enseguida en /crear y en la demo de la landing. Lo que dejes vacío vuelve al valor original.</p>
      </div>
      <ErrorBox error={error} />
      <ul className="divide-y border" data-testid="industries">
        {data?.industries.map((i) => <Row key={`${i.id}-${JSON.stringify(i.override)}`} ind={i} options={data.options} canEdit={canEdit} onSaved={reload} />)}
      </ul>
    </div>
  );
}

function Row({ ind, options, canEdit, onSaved }: { ind: Industry; options: Data["options"]; canEdit: boolean; onSaved: () => void }) {
  const [f, setF] = useState<Fields>(ind.override);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const set = (k: keyof Fields, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(ind.override);
  const theme = getTheme(f.theme || ind.defaults.theme);

  async function save(body: Fields) {
    const r = await api(`/admin/industries/${ind.id}`, { method: "PUT", body });
    if (r.ok) { setStatus({ kind: "ok", text: "Guardado." }); onSaved(); }
    else setStatus({ kind: "error", text: r.data.error === "always_visible" ? "Este rubro no se puede ocultar: es la salida para quien no encuentra el suyo." : msg(r.data.error) });
  }

  return (
    <li className="space-y-3 p-4" data-testid="industry-row" data-id={ind.id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-3 font-semibold">
          <span aria-hidden className="size-8 border" style={{ background: theme.bg, borderColor: theme.border, boxShadow: `inset -14px -14px 0 -4px ${theme.primary}` }} />
          {f.name || ind.defaults.name} <span className="text-xs font-normal text-muted-foreground">({ind.id} · {ind.mode})</span>
        </p>
        {canEdit && !ind.locked && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={!f.hidden} onChange={(e) => set("hidden", !e.target.checked)} />Se ofrece al crear una página</label>
        )}
        {ind.locked && <span className="text-xs text-muted-foreground">Siempre visible</span>}
      </div>
      <fieldset disabled={!canEdit} className="grid gap-3 border-0 p-0 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Nombre">{(id) => <TextInput id={id} value={f.name ?? ""} placeholder={ind.defaults.name} maxLength={60} onChange={(e) => set("name", e.target.value)} />}</Field>
        <Field label="Bajada">{(id) => <TextInput id={id} value={f.blurb ?? ""} placeholder={ind.defaults.blurb} maxLength={120} onChange={(e) => set("blurb", e.target.value)} />}</Field>
        <Field label="Frase de la portada">{(id) => <TextInput id={id} value={f.tagline ?? ""} placeholder={ind.defaults.tagline} maxLength={200} onChange={(e) => set("tagline", e.target.value)} />}</Field>
        <Field label="Tema">{(id) => <Select id={id} value={f.theme ?? ""} onChange={(e) => set("theme", e.target.value)}><option value="">Original ({ind.defaults.theme})</option>{options.themes.map((t) => <option key={t} value={t}>{t}</option>)}</Select>}</Field>
        <Field label="Diseño">{(id) => <Select id={id} value={f.layout ?? ""} onChange={(e) => set("layout", e.target.value)}><option value="">Original ({LAYOUT_LABEL[ind.defaults.layout]})</option>{options.layouts.map((t) => <option key={t} value={t}>{LAYOUT_LABEL[t] ?? t}</option>)}</Select>}</Field>
        <Field label="Tipografía">{(id) => <Select id={id} value={f.fontPair ?? ""} onChange={(e) => set("fontPair", e.target.value)}><option value="">Original ({FONT_LABEL[ind.defaults.fontPair]})</option>{options.fontPairs.map((t) => <option key={t} value={t}>{FONT_LABEL[t] ?? t}</option>)}</Select>}</Field>
      </fieldset>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={!dirty} onClick={() => void save(f)}>Guardar</Button>
          {Object.keys(ind.override).length > 0 && <Button size="sm" variant="ghost" onClick={() => void save({})}>Volver al original</Button>}
          {status && <p role={status.kind === "error" ? "alert" : "status"} className={`text-sm ${status.kind === "error" ? "text-destructive" : ""}`}>{status.text}</p>}
        </div>
      )}
    </li>
  );
}
