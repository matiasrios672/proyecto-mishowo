"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Section, Select, TextArea, TextInput, Toggle } from "@/components/ui/fields";
import { parseCsv, parsePastedList, type BulkItem } from "@/lib/bulk";
import {
  addCategory, addProduct, buildVariants, duplicateProduct, filterProducts, findProduct, importItems, isAvailable,
  moveProduct, moveProductTo, moveProductToCategory, removeCategory, removeExamples, removeProduct, renameCategory, updateProduct,
} from "@/lib/draftOps";
import { formatPrice, priceLabel } from "@/lib/format";
import type { DraftProduct } from "@/lib/draft";
import { ExampleBadge } from "@/components/onboarding/ExampleBadge";
import { NumberInput } from "./NumberInput";
import type { TabProps } from "./types";

export function ProductosTab({ draft, update }: TabProps) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [newCat, setNewCat] = useState("");

  const total = draft.categories.reduce((n, c) => n + c.products.length, 0);
  const examples = draft.categories.flatMap((c) => c.products).filter((p) => p.isExample).length;
  const matches = new Set(filterProducts(draft, query).map((p) => p.id));
  const searching = query.trim().length > 0;

  function add(categoryId?: string) {
    const r = addProduct(draft, categoryId);
    update(() => r.draft);
    setOpenId(r.id);
  }

  return (
    <div className="space-y-6">
      <Section title="Productos y servicios" description={`${total} en total${examples ? ` · ${examples} de ejemplo` : ""}`}>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => add()}>+ Agregar producto</Button>
          <Button variant="outline" onClick={() => setShowBulk((v) => !v)} aria-expanded={showBulk}>Cargar varios</Button>
          {examples > 0 && (
            <Button variant="ghost" onClick={() => update((d) => removeExamples(d))}>Quitar los {examples} de ejemplo</Button>
          )}
        </div>
        {showBulk && <BulkPanel onImport={(items) => { update((d) => importItems(d, items)); setShowBulk(false); }} onCancel={() => setShowBulk(false)} />}
        {total > 5 && (
          <Field label="Buscar en tus productos">
            {(id) => <TextInput id={id} type="search" placeholder="Nombre o descripción" value={query} onChange={(e) => setQuery(e.target.value)} />}
          </Field>
        )}
      </Section>

      {searching && matches.size === 0 && <p className="text-sm text-muted-foreground">No encontramos productos con «{query}».</p>}

      {draft.categories.map((c) => {
        const visible = c.products.filter((p) => !searching || matches.has(p.id));
        if (searching && visible.length === 0) return null;
        return (
          <section key={c.id} aria-label={c.name} className="space-y-2 rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <TextInput aria-label="Nombre de la categoría" value={c.name} className="font-semibold"
                onChange={(e) => update((d) => renameCategory(d, c.id, e.target.value), `cat${c.id}`)} />
              <Button variant="outline" size="sm" onClick={() => add(c.id)}>+ Producto</Button>
              {draft.categories.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => update((d) => removeCategory(d, c.id))} aria-label={`Eliminar la categoría ${c.name}`}>Eliminar</Button>
              )}
            </div>
            <ul className="space-y-2">
              {visible.map((p) => (
                <li key={p.id} draggable={!searching}
                  onDragStart={() => setDragId(p.id)} onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => dragId && e.preventDefault()}
                  onDrop={() => { if (dragId) update((d) => moveProductTo(d, dragId, p.id)); setDragId(null); }}
                  className={`rounded-lg border bg-card ${dragId === p.id ? "opacity-50" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2 p-2">
                    <span aria-hidden className="cursor-grab select-none px-1 text-muted-foreground" title="Arrastrá para ordenar">⠿</span>
                    <button type="button" className="min-w-0 flex-1 basis-40 text-left" aria-expanded={openId === p.id}
                      onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                      <span className="block truncate text-sm font-medium">
                        {p.name || "Producto sin nombre"}{p.isExample && <ExampleBadge />}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {priceLabel(p.price, p.options) || "Sin precio"}{!isAvailable(p) ? " · Agotado" : ""}
                      </span>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="sm" aria-label={`Subir ${p.name}`} onClick={() => update((d) => moveProduct(d, p.id, -1))}>↑</Button>
                      <Button variant="ghost" size="sm" aria-label={`Bajar ${p.name}`} onClick={() => update((d) => moveProduct(d, p.id, 1))}>↓</Button>
                      <Button variant="ghost" size="sm" aria-label={`Duplicar ${p.name}`} onClick={() => { const r = duplicateProduct(draft, p.id); update(() => r.draft); if (r.id) setOpenId(r.id); }}>Duplicar</Button>
                      <Button variant="ghost" size="sm" aria-label={`Eliminar ${p.name}`} onClick={() => { update((d) => removeProduct(d, p.id)); if (openId === p.id) setOpenId(null); }}>Eliminar</Button>
                    </div>
                  </div>
                  {openId === p.id && <ProductForm draft={draft} update={update} id={p.id} />}
                </li>
              ))}
              {c.products.length === 0 && <li className="p-2 text-sm text-muted-foreground">Esta categoría está vacía.</li>}
            </ul>
          </section>
        );
      })}

      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); update((d) => addCategory(d, newCat)); setNewCat(""); }}>
        <div className="flex-1">
          <Field label="Nueva categoría" hint="Agrupa tus productos en secciones con un menú en tu página">
            {(id, desc) => <TextInput id={id} aria-describedby={desc} placeholder="Ej: Bebidas" value={newCat} onChange={(e) => setNewCat(e.target.value)} />}
          </Field>
        </div>
        <Button type="submit" variant="outline" disabled={!newCat.trim()}>Agregar</Button>
      </form>
    </div>
  );
}

function ProductForm({ draft, update, id }: { draft: TabProps["draft"]; update: TabProps["update"]; id: string }) {
  const found = findProduct(draft, id);
  const [axis1, setAxis1] = useState("");
  const [axis2, setAxis2] = useState("");
  if (!found) return null;
  const { product: p, category } = found;
  const set = (patch: Partial<DraftProduct>, key?: string) => update((d) => updateProduct(d, id, patch), key ?? null);
  const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const discount = p.price !== null && p.comparePrice !== null && p.comparePrice <= p.price;

  return (
    <div className="space-y-4 border-t p-3">
      <Field label="Nombre" required counter={{ value: p.name, max: 80 }}>
        {(fid) => <TextInput id={fid} maxLength={80} value={p.name} onChange={(e) => set({ name: e.target.value }, `pn${id}`)} />}
      </Field>
      <Field label="Descripción" counter={{ value: p.description, max: 400 }}>
        {(fid) => <TextArea id={fid} maxLength={400} value={p.description} onChange={(e) => set({ description: e.target.value }, `pd${id}`)} />}
      </Field>
      <Field label="Categoría">
        {(fid) => (
          <Select id={fid} value={category.id} onChange={(e) => update((d) => moveProductToCategory(d, id, e.target.value))}>
            {draft.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Precio ($)">{(fid) => <NumberInput id={fid} value={p.price} onChange={(v) => set({ price: v }, `pp${id}`)} placeholder="1800" />}</Field>
        <Field label="Precio tachado ($)" error={discount ? "Tiene que ser mayor al precio" : null} hint={discount ? undefined : "Opcional, para mostrar una oferta"}>
          {(fid) => <NumberInput id={fid} value={p.comparePrice} onChange={(v) => set({ comparePrice: v }, `pc${id}`)} placeholder="2400" />}
        </Field>
      </div>
      <Field label="Stock" hint="Opcional. Si lo cargás, al llegar a 0 el producto queda agotado solo.">
        {(fid) => <NumberInput id={fid} integer value={p.stock} onChange={(v) => set({ stock: v }, `ps${id}`)} placeholder="Sin control de stock" />}
      </Field>
      <Toggle checked={p.available} onChange={(v) => set({ available: v })} label="Disponible" hint="Si lo apagás, tu página muestra «Agotado»" />

      <div className="space-y-3 rounded-lg bg-muted p-3">
        <p className="text-sm font-medium">Opciones (talles, colores, tamaños)</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Opción 1" hint="Separadas por coma">
            {(fid) => <TextInput id={fid} placeholder="S, M, L" value={axis1} onChange={(e) => setAxis1(e.target.value)} />}
          </Field>
          <Field label="Opción 2 (opcional)" hint="Ej: colores">
            {(fid) => <TextInput id={fid} placeholder="Rojo, Azul" value={axis2} onChange={(e) => setAxis2(e.target.value)} />}
          </Field>
        </div>
        <Button variant="outline" size="sm" disabled={split(axis1).length === 0 && split(axis2).length === 0}
          onClick={() => set({ options: buildVariants(split(axis1), split(axis2), p.options) })}>
          Generar opciones
        </Button>
        {p.options.length > 0 && (
          <ul className="space-y-2">
            {p.options.map((o) => (
              <li key={o.id} className="grid grid-cols-[1fr_6rem] items-center gap-2 sm:grid-cols-[1fr_7rem_auto_auto]">
                <TextInput aria-label="Nombre de la opción" value={o.label}
                  onChange={(e) => set({ options: p.options.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)) }, `ol${o.id}`)} />
                <NumberInput label={`Precio de ${o.label}`} placeholder="= base" value={o.price}
                  onChange={(v) => set({ options: p.options.map((x) => (x.id === o.id ? { ...x, price: v } : x)) }, `op${o.id}`)} />
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={o.soldOut} onChange={(e) => set({ options: p.options.map((x) => (x.id === o.id ? { ...x, soldOut: e.target.checked } : x)) })} />
                  Agotado
                </label>
                <Button variant="ghost" size="sm" aria-label={`Quitar ${o.label}`} onClick={() => set({ options: p.options.filter((x) => x.id !== o.id) })}>Quitar</Button>
              </li>
            ))}
          </ul>
        )}
        {p.options.some((o) => o.price !== null) && <p className="text-xs text-muted-foreground">Las opciones sin precio usan {formatPrice(p.price) || "el precio base"}.</p>}
      </div>
    </div>
  );
}

function BulkPanel({ onImport, onCancel }: { onImport: (items: BulkItem[]) => void; onCancel: () => void }) {
  const [mode, setMode] = useState<"lista" | "csv">("lista");
  const [text, setText] = useState("");
  const result = text.trim() ? (mode === "csv" ? parseCsv(text) : parsePastedList(text)) : null;

  return (
    <div className="space-y-3 rounded-xl border bg-muted p-3">
      <div role="tablist" aria-label="Forma de carga" className="flex gap-2">
        {(["lista", "csv"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={`rounded-full border px-3 py-1 text-sm ${mode === m ? "bg-primary text-primary-foreground" : "bg-background"}`}>
            {m === "lista" ? "Pegar una lista" : "Archivo CSV"}
          </button>
        ))}
      </div>
      {mode === "lista" ? (
        <p className="text-sm text-muted-foreground">Una línea por producto con su precio. Una línea que termina en «:» crea una categoría.</p>
      ) : (
        <p className="text-sm text-muted-foreground">Columnas: nombre, descripción, precio, categoría (la primera fila son los títulos). Podés separar con coma o punto y coma.</p>
      )}
      {mode === "csv" && (
        <input type="file" accept=".csv,text/csv,text/plain" aria-label="Elegir archivo CSV"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
      )}
      <TextArea aria-label="Contenido a importar" rows={6} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={mode === "lista" ? "Empanadas:\n- Carne - 1800\n- Jamón y queso $1.700" : "nombre;precio;categoría\nEmpanada de carne;1800;Empanadas"} />
      {result && (
        <div className="text-sm" aria-live="polite">
          <p className="font-medium">Vamos a agregar {result.items.length} producto{result.items.length === 1 ? "" : "s"}.</p>
          {result.errors.slice(0, 5).map((er) => <p key={er} className="text-destructive">{er}</p>)}
          {result.errors.length > 5 && <p className="text-muted-foreground">y {result.errors.length - 5} avisos más</p>}
        </div>
      )}
      <div className="flex gap-2">
        <Button disabled={!result || result.items.length === 0} onClick={() => result && onImport(result.items)}>Agregar a mi catálogo</Button>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}
