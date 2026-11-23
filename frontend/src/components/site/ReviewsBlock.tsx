"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/authClient";

interface Review { id: string; name: string; rating: number; comment: string | null; reply: string | null; createdAt: string }
interface Data { count: number; average: number | null; items: Review[] }

const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
const radius = { borderRadius: "var(--btn-radius)" } as const;

function Stars({ value, size = "text-lg" }: { value: number; size?: string }) {
  return (
    <span aria-hidden className={`${size} leading-none tracking-tight text-[#F6B40E]`}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= Math.round(value) ? "" : "opacity-25"}>★</span>)}
    </span>
  );
}

/**
 * Opiniones de clientes. Cualquiera puede dejar la suya sin cuenta, pero se muestra recién cuando el negocio la aprueba.
 * Si todavía no hay reseñas aprobadas, solo se ofrece dejar la primera.
 */
export function ReviewsBlock({ slug, businessName }: { slug: string; businessName: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [off, setOff] = useState(false);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "again" | "error">("idle");

  useEffect(() => {
    let alive = true;
    fetch(`${API_URL}/public/sites/${encodeURIComponent(slug)}/reviews`).then((r) => { if (!r.ok) { if (alive) setOff(true); return null; } return r.json(); })
      .then((d: Data | null) => { if (alive && d) setData(d); }).catch(() => { if (alive) setOff(true); });
    return () => { alive = false; };
  }, [slug]);

  if (off || !data) return null;

  async function submit() {
    setState("busy");
    try {
      const res = await fetch(`${API_URL}/public/sites/${encodeURIComponent(slug)}/reviews`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), rating, ...(comment.trim() ? { comment: comment.trim() } : {}), website: trap }),
      });
      setState(res.ok ? "sent" : res.status === 429 ? "again" : "error");
    } catch { setState("error"); }
  }
  const ready = rating >= 1 && name.trim().length >= 2;

  return (
    <section id="resenas" aria-labelledby="rev-title" className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-10 @2xl:px-8" data-testid="reviews">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="rev-title" className="site-display text-2xl font-bold @2xl:text-3xl">Lo que dicen los clientes</h2>
          {data.count > 0 && data.average !== null && (
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground" data-testid="reviews-summary">
              <Stars value={data.average} /> <strong className="text-foreground">{data.average.toFixed(1).replace(".", ",")}</strong> · {data.count} {data.count === 1 ? "reseña" : "reseñas"}
            </p>
          )}
        </div>
        {!open && state !== "sent" && (
          <button type="button" onClick={() => setOpen(true)} className="border border-primary px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10" style={radius} data-testid="reviews-open">Dejar mi opinión</button>
        )}
      </div>

      {data.items.length > 0 ? (
        <ul className="mt-6 grid gap-4 @2xl:grid-cols-2" data-testid="reviews-list">
          {data.items.map((r) => (
            <li key={r.id} className="rounded-2xl border bg-card p-4 text-card-foreground">
              <p className="flex items-center justify-between gap-2"><span className="font-semibold">{r.name}</span><Stars value={r.rating} size="text-base" /></p>
              {r.comment && <p className="mt-2 text-sm leading-relaxed">{r.comment}</p>}
              {r.reply && <p className="mt-3 border-l-2 border-primary pl-3 text-sm text-muted-foreground"><strong className="text-foreground">{businessName}:</strong> {r.reply}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Todavía no hay opiniones. ¡Dejá la primera!</p>
      )}

      {state === "sent" && <p role="status" className="mt-6 rounded-xl bg-muted p-4 text-sm" data-testid="reviews-sent">¡Gracias! Tu opinión se va a mostrar cuando {businessName} la apruebe.</p>}
      {open && state !== "sent" && (
        <form className="mt-6 max-w-xl space-y-4 rounded-2xl border bg-card p-5 text-card-foreground" onSubmit={(e) => { e.preventDefault(); if (ready && state !== "busy") void submit(); }}>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">¿Cómo fue tu experiencia?</legend>
            <div className="flex gap-1" role="radiogroup" aria-label="Puntaje">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`} onClick={() => setRating(n)}
                  className={`size-11 text-2xl leading-none transition-transform hover:scale-110 ${n <= rating ? "text-[#F6B40E]" : "text-muted-foreground/40"}`}>★</button>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-medium">Tu nombre
            <input className={`${field} mt-1 font-normal`} value={name} maxLength={60} required autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">Tu opinión (opcional)
            <textarea className={`${field} mt-1 font-normal`} rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          {/* Campo trampa para robots: está fuera de pantalla y no se completa a mano. */}
          <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden"><label>Sitio web<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label></div>
          {state === "again" && <p role="alert" className="text-sm text-destructive">Ya dejaste una opinión hoy. Gracias.</p>}
          {state === "error" && <p role="alert" className="text-sm text-destructive">No pudimos enviarla. Probá de nuevo en un momento.</p>}
          <button type="submit" disabled={!ready || state === "busy"} className="bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60" style={radius} data-testid="reviews-submit">{state === "busy" ? "Enviando…" : "Enviar opinión"}</button>
        </form>
      )}
    </section>
  );
}
