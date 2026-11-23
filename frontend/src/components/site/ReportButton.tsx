"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const REASONS = [
  { id: "estafa", label: "Parece una estafa" },
  { id: "contenido_ilegal", label: "Vende o muestra algo ilegal" },
  { id: "ofensivo", label: "Contenido ofensivo" },
  { id: "otro", label: "Otro motivo" },
] as const;

/** Botón discreto para denunciar una página. Va a la cola de moderación del admin. */
export function ReportButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("estafa");
  const [detail, setDetail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function send() {
    setState("sending");
    try {
      const res = await fetch(`${API}/public/reports`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, reason, ...(detail.trim() ? { detail: detail.trim() } : {}) }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setState("idle"); }} className="text-xs text-muted-foreground ">
        Denunciar esta página
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Denunciar esta página" onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-3 rounded-2xl bg-background p-4 text-left text-foreground shadow-xl">
            {state === "done" ? (
              <>
                <p className="font-semibold">Gracias por avisarnos</p>
                <p className="text-sm text-muted-foreground">Vamos a revisar esta página.</p>
                <button type="button" autoFocus onClick={() => setOpen(false)} className="rounded-md border px-3 py-1.5 text-sm">Cerrar</button>
              </>
            ) : (
              <>
                <h2 className="font-semibold">Denunciar esta página</h2>
                <label className="block text-sm font-medium">Motivo
                  <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal">
                    {REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium">Contanos más (opcional)
                  <textarea value={detail} maxLength={500} rows={3} onChange={(e) => setDetail(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal" />
                </label>
                {state === "error" && <p role="alert" className="text-sm text-destructive">No pudimos enviar la denuncia. Probá de nuevo en un momento.</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={send} disabled={state === "sending"} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
                    {state === "sending" ? "Enviando…" : "Enviar denuncia"}
                  </button>
                  <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-3 py-1.5 text-sm">Cancelar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
