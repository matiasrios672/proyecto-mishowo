"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextArea } from "@/components/ui/fields";
import { api } from "@/lib/authClient";

type Status = "pendiente" | "aprobada" | "rechazada";
interface Review { id: string; name: string; rating: number; comment: string | null; reply: string | null; status: Status; createdAt: string }
interface Data { enabled: boolean; counts: Record<Status, number>; items: Review[] }

const LABEL: Record<Status, string> = { pendiente: "Pendientes", aprobada: "Aprobadas", rechazada: "Rechazadas" };
const when = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });

/** Reseñas de clientes: nada se muestra en tu página hasta que lo aprobás. */
export function ReviewsPanel() {
  const [status, setStatus] = useState<Status>("pendiente");
  const [data, setData] = useState<Data | null>(null);
  const [tick, setTick] = useState(0);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<Data>(`/me/reviews?status=${status}`).then((r) => { if (alive) { if (r.ok) setData(r.data); else setError(r.data.error === "no_business" ? "Primero creá tu página en el editor." : "No pudimos cargar las reseñas."); } });
    return () => { alive = false; };
  }, [status, tick]);

  async function act(r: Review, body: { status?: Status; reply?: string | null }) {
    setError(null);
    const res = await api(`/me/reviews/${r.id}`, { method: "PATCH", body });
    if (!res.ok) setError("No se pudo guardar el cambio.");
    else { setOpen(null); setTick((n) => n + 1); }
  }

  if (error && !data) return <p className="border border-dashed p-6 text-center">{error}</p>;
  return (
    <section aria-labelledby="rev-title" className="space-y-6">
      <div>
        <h1 id="rev-title" className="text-2xl font-bold">Reseñas</h1>
        <p className="mt-2 max-w-[60ch] text-muted-foreground">Tus clientes dejan su opinión desde tu página. Vos elegís cuáles se muestran y podés responderlas en público.</p>
      </div>
      {data && !data.enabled && <p role="status" className="bg-muted p-3 text-sm">Tu plan actual no muestra reseñas en tu página. Las que ya llegaron quedan guardadas.</p>}
      {error && <p role="alert" className="bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div role="group" aria-label="Estado" className="flex flex-wrap gap-1">
        {(Object.keys(LABEL) as Status[]).map((s) => (
          <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className={`min-h-10 px-4 text-sm ${status === s ? "bg-[#FC5502] text-[#0E1B2C]" : "border hover:bg-muted"}`}>
            {LABEL[s]}{data ? ` (${data.counts[s]})` : ""}
          </button>
        ))}
      </div>

      {data?.items.length === 0 && <p className="border border-dashed p-8 text-center text-sm text-muted-foreground" data-testid="reviews-empty">{status === "pendiente" ? "No hay reseñas para revisar." : "No hay reseñas en esta lista."}</p>}
      <ul className="divide-y border" data-testid="reviews-panel-list">
        {data?.items.map((r) => (
          <li key={r.id} className="space-y-2 p-4" data-testid="review-item">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{r.name} <span className="text-[#F6B40E]" aria-label={`${r.rating} de 5`}>{"★".repeat(r.rating)}<span className="opacity-25">{"★".repeat(5 - r.rating)}</span></span></p>
              <p className="text-xs text-muted-foreground">{when(r.createdAt)}</p>
            </div>
            {r.comment ? <p className="whitespace-pre-wrap text-sm">{r.comment}</p> : <p className="text-sm text-muted-foreground">Sin comentario.</p>}
            {r.reply && open !== r.id && <p className="border-l-2 border-[#C73E00] pl-3 text-sm text-muted-foreground"><strong className="text-foreground">Tu respuesta:</strong> {r.reply}</p>}
            {open === r.id && (
              <div className="space-y-2">
                <Field label="Tu respuesta pública" counter={{ value: reply[r.id] ?? r.reply ?? "", max: 500 }}>
                  {(id) => <TextArea id={id} rows={3} maxLength={500} value={reply[r.id] ?? r.reply ?? ""} onChange={(e) => setReply((x) => ({ ...x, [r.id]: e.target.value }))} />}
                </Field>
                <div className="flex gap-2"><Button size="sm" onClick={() => void act(r, { reply: (reply[r.id] ?? r.reply ?? "").trim() || null })}>Guardar respuesta</Button><Button size="sm" variant="ghost" onClick={() => setOpen(null)}>Cancelar</Button></div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {r.status !== "aprobada" && <Button size="sm" onClick={() => void act(r, { status: "aprobada" })}>Aprobar y mostrar</Button>}
              {r.status !== "rechazada" && <Button size="sm" variant="outline" onClick={() => void act(r, { status: "rechazada" })}>{r.status === "aprobada" ? "Ocultar" : "Rechazar"}</Button>}
              {r.status === "aprobada" && open !== r.id && <Button size="sm" variant="ghost" onClick={() => setOpen(r.id)}>{r.reply ? "Editar respuesta" : "Responder"}</Button>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
