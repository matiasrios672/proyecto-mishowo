"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select, TextArea } from "@/components/ui/fields";
import { API_URL, api, apiUpload } from "@/lib/authClient";
import { formatPrice, timeAgo } from "@/lib/format";

interface Plan { id: string; name: string; priceMonthly: number; limits: { products?: number | null }; features: string[] }
interface Payment { id: string; planId: string; months: number; amount: number; status: "pendiente" | "confirmado" | "rechazado"; note: string | null; rejectReason: string | null; hasReceipt: boolean; createdAt: string }
interface PlanData {
  current: { id: string; name: string }; expiresAt: string | null; daysLeft: number | null; plans: Plan[]; months: number[];
  paymentInfo: { holder: string; alias: string; cbu: string; bank: string; instructions: string }; payments: Payment[];
}

const STATUS: Record<Payment["status"], { label: string; tone: string }> = {
  pendiente: { label: "En revisión", tone: "bg-muted" },
  confirmado: { label: "Confirmado", tone: "bg-primary text-primary-foreground" },
  rechazado: { label: "Rechazado", tone: "border border-destructive/40 text-destructive" },
};
const ERR: Record<string, string> = {
  too_many_pending: "Ya tenés 3 avisos en revisión. Esperá a que los confirmemos para avisar otro.",
  invalid_plan: "Ese plan ya no está disponible. Elegí otro.",
  unsupported_file: "El comprobante tiene que ser una imagen (JPG, PNG, WebP) o un PDF.",
  file_too_large: "El comprobante pesa más de 5 MB. Probá con una captura más liviana.",
  network: "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.",
};

export function PlanPanel() {
  const [data, setData] = useState<PlanData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [months, setMonths] = useState(1);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<PlanData>("/me/plan").then((r) => {
      if (!alive) return;
      if (r.ok) { setData(r.data); setError(null); } else setError(r.data.error === "no_business" ? "no_business" : "network");
    });
    return () => { alive = false; };
  }, [tick]);

  const plan = data?.plans.find((p) => p.id === choice) ?? null;

  async function submit() {
    if (!plan) return;
    setBusy(true); setError(null);
    const r = await api<{ id: string }>("/me/payments", { body: { planId: plan.id, months, ...(note.trim() ? { note: note.trim() } : {}) } });
    if (!r.ok) { setBusy(false); return setError(r.data.error ?? "network"); }
    if (file) {
      const up = await apiUpload(`/me/payments/${r.data.id}/receipt`, file);
      if (!up.ok) { setBusy(false); setSent(true); setTick((n) => n + 1); return setError(up.data.error ?? "network"); }
    }
    setBusy(false); setSent(true); setChoice(null); setNote(""); setFile(null); setTick((n) => n + 1);
  }

  async function addReceipt(id: string, f: File) {
    const up = await apiUpload(`/me/payments/${id}/receipt`, f);
    if (!up.ok) return setError(up.data.error ?? "network");
    setError(null); setTick((n) => n + 1);
  }

  async function copy(key: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch { /* sin permiso */ }
  }

  if (error === "no_business")
    return <p className="rounded-xl border border-dashed p-6 text-center">Primero creá tu página en el editor y después elegís tu plan.</p>;
  if (!data) return <p className="text-muted-foreground">{error ? ERR.network : "Cargando tu plan…"}</p>;

  const info = data.paymentInfo;
  const hasInfo = Object.values(info).some(Boolean);

  return (
    <section aria-labelledby="plan-title" className="space-y-8">
      <div>
        <h1 id="plan-title" className="text-2xl font-bold">Plan y pagos</h1>
        <p className="mt-2" data-testid="current-plan">
          Tu plan actual es <strong>{data.current.name}</strong>
          {data.expiresAt ? `, activo hasta el ${new Date(data.expiresAt).toLocaleDateString("es-AR")} (${data.daysLeft} ${data.daysLeft === 1 ? "día" : "días"})` : "."}
        </p>
      </div>

      {error && error !== "no_business" && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{ERR[error] ?? "Algo salió mal. Probá de nuevo en un momento."}</p>}
      {sent && !error && <p role="status" className="rounded-lg bg-muted p-3 text-sm" data-testid="payment-sent">Recibimos tu aviso. Lo revisamos y te escribimos por email cuando el plan esté activo.</p>}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Elegí un plan</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {data.plans.map((p) => (
            <li key={p.id} className={`flex flex-col rounded-xl border p-4 ${data.current.id === p.id ? "border-primary" : ""}`}>
              <p className="font-semibold">{p.name}</p>
              <p className="mt-1 text-2xl font-bold">{p.priceMonthly === 0 ? "Gratis" : <>{formatPrice(p.priceMonthly)}<span className="text-sm font-normal text-muted-foreground"> /mes</span></>}</p>
              <ul className="my-3 flex-1 space-y-1 text-sm text-muted-foreground">
                <li>{p.limits.products ? `Hasta ${p.limits.products} productos` : "Productos ilimitados"}</li>
                {p.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              {p.priceMonthly > 0 && (
                <Button size="sm" variant={choice === p.id ? "default" : "outline"} aria-pressed={choice === p.id} onClick={() => { setChoice(p.id); setSent(false); }}>
                  {data.current.id === p.id ? "Renovar" : "Elegir"} {p.name}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {plan && (
        <div className="space-y-5 rounded-xl border-2 border-primary p-5" data-testid="payment-form">
          <h2 className="text-lg font-semibold">Pagar el plan {plan.name}</h2>
          <Field label="¿Por cuántos meses?">
            {(id) => (
              <Select id={id} value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                {data.months.map((m) => <option key={m} value={m}>{m} {m === 1 ? "mes" : "meses"}: {formatPrice(plan.priceMonthly * m)}</option>)}
              </Select>
            )}
          </Field>
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="mb-2 font-medium">1. Transferí {formatPrice(plan.priceMonthly * months)} a:</p>
            {hasInfo ? (
              <dl className="space-y-1">
                {([["Titular", info.holder], ["Alias", info.alias], ["CBU", info.cbu], ["Banco", info.bank]] as const).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2"><dt className="w-16 text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd>
                    <button type="button" className="text-xs underline" onClick={() => void copy(k, v)}>{copied === k ? "¡Copiado!" : "Copiar"}</button></div>
                ))}
              </dl>
            ) : <p>Todavía no cargamos los datos de transferencia. Escribinos desde la página de contacto y te los pasamos.</p>}
            {info.instructions && <p className="mt-2 text-muted-foreground">{info.instructions}</p>}
          </div>
          <p className="text-sm font-medium">2. Avisanos que pagaste</p>
          <Field label="Comprobante (imagen o PDF, hasta 5 MB)" hint="Opcional, pero acelera la confirmación">
            {(id, d) => <input id={id} aria-describedby={d} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}
          </Field>
          <Field label="Aclaración (opcional)" hint="Ej: número de operación o nombre de quien transfirió">
            {(id, d) => <TextArea id={id} aria-describedby={d} rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
          <Button size="lg" disabled={busy} onClick={() => void submit()} data-testid="paid-button">{busy ? "Enviando…" : "Ya pagué"}</Button>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Tus pagos</h2>
        {data.payments.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no avisaste ningún pago.</p> : (
          <ul className="space-y-2" data-testid="payments">
            {data.payments.map((p) => (
              <li key={p.id} className="rounded-lg border p-3 text-sm" data-testid="payment" data-status={p.status}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">Plan {data.plans.find((x) => x.id === p.planId)?.name ?? p.planId} · {p.months} {p.months === 1 ? "mes" : "meses"} · {formatPrice(p.amount)}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS[p.status].tone}`}>{STATUS[p.status].label}</span>
                </div>
                <p className="text-muted-foreground">{timeAgo(p.createdAt)}{p.hasReceipt ? " · con comprobante" : ""}</p>
                {p.rejectReason && <p className="mt-1 text-destructive">Motivo: {p.rejectReason}</p>}
                {p.status === "pendiente" && !p.hasReceipt && (
                  <label className="mt-2 block text-xs">Sumar comprobante: <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) void addReceipt(p.id, f); }} /></label>
                )}
                {p.hasReceipt && <a className="mt-1 inline-block text-xs underline" href={`${API_URL}/me/payments/${p.id}/receipt`} target="_blank" rel="noopener noreferrer">Ver comprobante</a>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
