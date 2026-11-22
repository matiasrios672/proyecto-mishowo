"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/ui/fields";
import { api } from "@/lib/authClient";
import { formatPrice } from "@/lib/format";

interface Coupon {
  id: string; code: string; kind: "percent" | "fixed"; value: number; minPurchase: number; expiresAt: string | null;
  maxUses: number | null; maxUsesPerCustomer: number | null; usedCount: number; active: boolean;
}
interface List { coupons: Coupon[]; limit: number | null }

const ERR: Record<string, string> = {
  coupon_limit: "Llegaste al máximo de cupones de tu plan. Borrá uno o pasate a un plan con más cupones.",
  code_taken: "Ya tenés un cupón con ese código.",
  invalid_request: "Revisá los datos: el código lleva solo letras y números, y un porcentaje no puede pasar de 100.",
  network: "No pudimos conectarnos. Probá de nuevo.",
};
const describe = (c: Coupon) => (c.kind === "percent" ? `${c.value}% de descuento` : `${formatPrice(c.value)} de descuento`);
const expired = (c: Coupon) => !!c.expiresAt && new Date(c.expiresAt).getTime() <= Date.now();

export function CouponsPanel() {
  const [data, setData] = useState<List | null>(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api<List>("/me/coupons").then((r) => { if (alive) { if (r.ok) setData(r.data); else setError(r.data.error === "no_business" ? "no_business" : "network"); } });
    return () => { alive = false; };
  }, [tick]);

  async function create(form: HTMLFormElement) {
    const f = new FormData(form);
    const num = (k: string) => { const v = String(f.get(k) ?? "").trim(); return v === "" ? null : Number(v); };
    const exp = String(f.get("expiresAt") ?? "");
    setSaving(true); setError(null);
    const r = await api("/me/coupons", { body: {
      code: String(f.get("code") ?? "").trim(), kind: String(f.get("kind")), value: Number(f.get("value")),
      minPurchase: num("minPurchase") ?? 0, maxUses: num("maxUses"), maxUsesPerCustomer: num("maxUsesPerCustomer"),
      expiresAt: exp ? new Date(`${exp}T23:59:59-03:00`).toISOString() : null,
    } });
    setSaving(false);
    if (!r.ok) return setError(r.data.error ?? "network");
    form.reset(); setTick((n) => n + 1);
  }

  async function toggle(c: Coupon) {
    const r = await api(`/me/coupons/${c.id}`, { method: "PATCH", body: { active: !c.active } });
    if (!r.ok) return setError(r.data.error ?? "network");
    setTick((n) => n + 1);
  }
  async function remove(c: Coupon) {
    const r = await api(`/me/coupons/${c.id}`, { method: "DELETE" });
    if (!r.ok) return setError(r.data.error ?? "network");
    setTick((n) => n + 1);
  }

  if (error === "no_business") return <p className="rounded-xl border border-dashed p-6 text-center">Primero creá tu página en el editor.</p>;
  if (!data) return <p className="text-muted-foreground">{error ? ERR.network : "Cargando cupones…"}</p>;
  const full = data.limit !== null && data.coupons.length >= data.limit;

  return (
    <section aria-labelledby="coupons-title" className="space-y-8">
      <div>
        <h1 id="coupons-title" className="text-2xl font-bold">Cupones</h1>
        <p className="mt-2 max-w-[60ch] text-muted-foreground">Tus clientes escriben el código en el pedido y el descuento se aplica solo. {data.limit !== null && `Tu plan permite hasta ${data.limit} cupones.`}</p>
      </div>
      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{ERR[error] ?? "No se pudo completar la acción."}</p>}

      <form className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="coupon-form" onSubmit={(e) => { e.preventDefault(); void create(e.currentTarget); }}>
        <h2 className="font-semibold sm:col-span-2 lg:col-span-3">Nuevo cupón</h2>
        <Field label="Código" hint="Letras y números, sin espacios. Ej: VERANO10" required>{(id, d) => <TextInput id={id} aria-describedby={d} name="code" required minLength={3} maxLength={30} pattern="[A-Za-z0-9_\-]+" className="uppercase" />}</Field>
        <Field label="Tipo">{(id) => <Select id={id} name="kind" defaultValue="percent"><option value="percent">Porcentaje (%)</option><option value="fixed">Monto fijo ($)</option></Select>}</Field>
        <Field label="Valor" required>{(id) => <TextInput id={id} name="value" type="number" required min={1} step="any" />}</Field>
        <Field label="Compra mínima ($)" hint="Vacío = sin mínimo">{(id, d) => <TextInput id={id} aria-describedby={d} name="minPurchase" type="number" min={0} />}</Field>
        <Field label="Vence el" hint="Vacío = no vence">{(id, d) => <TextInput id={id} aria-describedby={d} name="expiresAt" type="date" />}</Field>
        <Field label="Usos en total" hint="Vacío = sin tope">{(id, d) => <TextInput id={id} aria-describedby={d} name="maxUses" type="number" min={1} />}</Field>
        <Field label="Usos por cliente" hint="Se cuenta por teléfono. Vacío = sin tope">{(id, d) => <TextInput id={id} aria-describedby={d} name="maxUsesPerCustomer" type="number" min={1} />}</Field>
        <div className="flex items-end"><Button type="submit" disabled={saving || full}>{saving ? "Creando…" : "Crear cupón"}</Button></div>
        {full && <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">Llegaste al máximo de tu plan. Borrá un cupón para crear otro.</p>}
      </form>

      {data.coupons.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground" data-testid="coupons-empty">Todavía no creaste cupones. Un buen primero: 10% para quien pide por primera vez.</p>
      ) : (
        <ul className="space-y-3" data-testid="coupons">
          {data.coupons.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4" data-testid="coupon" data-active={c.active && !expired(c)}>
              <div className="min-w-0">
                <p className="flex items-center gap-2"><code className="rounded bg-muted px-2 py-0.5 text-base font-bold">{c.code}</code>
                  {expired(c) ? <span className="text-xs text-destructive">Vencido</span> : !c.active ? <span className="text-xs text-muted-foreground">Pausado</span> : <span className="text-xs text-emerald-700">Activo</span>}</p>
                <p className="mt-1 text-sm">{describe(c)}{c.minPurchase > 0 ? ` · desde ${formatPrice(c.minPurchase)}` : ""}</p>
                <p className="text-xs text-muted-foreground">
                  Usado {c.usedCount}{c.maxUses !== null ? ` de ${c.maxUses}` : ""} {c.usedCount === 1 ? "vez" : "veces"}
                  {c.maxUsesPerCustomer !== null ? ` · ${c.maxUsesPerCustomer} por cliente` : ""}
                  {c.expiresAt ? ` · vence el ${new Date(c.expiresAt).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void toggle(c)}>{c.active ? "Pausar" : "Activar"}</Button>
                <Button size="sm" variant="ghost" onClick={() => void remove(c)} aria-label={`Borrar el cupón ${c.code}`}>Borrar</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
