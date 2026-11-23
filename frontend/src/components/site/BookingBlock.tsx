"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/authClient";
import { whatsappLink } from "@/lib/whatsapp";
import { formatPrice } from "@/lib/format";

interface Service { name: string; minutes: number | null; price: number | null }
interface Staff { id: string; name: string }
interface Cfg { enabled: boolean; slotMinutes?: number; horizonDays?: number; services?: Service[]; staff?: Staff[]; minDate?: string }
interface Slot { time: string; left: number }
type Done = { date: string; time: string; staffName: string | null; link: string | null };

const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
const radius = { borderRadius: "var(--btn-radius)" } as const;
const ERR: Record<string, string> = {
  slot_taken: "Ese horario se acaba de ocupar. Elegí otro.",
  already_booked: "Ya tenés un turno reservado en ese horario.",
  slot_unavailable: "Ese horario ya no está disponible. Elegí otro.",
  invalid_service: "Elegí uno de los servicios de la lista.",
  invalid_staff: "Esa persona ya no atiende. Elegí otra.",
  booking_disabled: "Este negocio no está tomando turnos por ahora.",
  invalid_request: "Revisá tu nombre, tu teléfono y tu email.",
};
const fmtDate = (iso: string) => iso.split("-").reverse().join("/");
const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T12:00:00-03:00`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);

/**
 * «Reservá tu turno» para negocios de servicios. Pide la configuración al cargar: si el negocio no activó los
 * turnos (o su plan no los incluye) no dibuja nada. Servicio → profesional → día → horario → datos.
 * Los horarios libres los calcula el servidor según lo que dura el servicio y quién lo atiende.
 */
export function BookingBlock({ slug, whatsapp, businessName }: { slug: string; whatsapp: string; businessName: string }) {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [time, setTime] = useState("");
  const [service, setService] = useState("");
  const [staffId, setStaffId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API_URL}/public/sites/${encodeURIComponent(slug)}/booking`).then((r) => (r.ok ? r.json() : { enabled: false })).then((c: Cfg) => { if (alive) setCfg(c); }).catch(() => undefined);
    return () => { alive = false; };
  }, [slug]);

  const chosen = cfg?.services?.find((x) => x.name === service);
  const loadSlots = (d: string) => {
    const qs = new URLSearchParams({ date: d, ...(service ? { service } : {}), ...(staffId ? { staff: staffId } : {}) });
    return fetch(`${API_URL}/public/sites/${encodeURIComponent(slug)}/booking/slots?${qs}`).then((r) => (r.ok ? r.json() : { slots: [] })).then((x: { slots?: Slot[] }) => x.slots ?? []);
  };

  useEffect(() => {
    if (!date) return;
    let alive = true;
    loadSlots(date).then((s) => { if (alive) setSlots(s); }).catch(() => { if (alive) setSlots([]); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se vuelve a pedir al cambiar el día, el servicio o el profesional
  }, [date, slug, service, staffId]);

  if (!cfg?.enabled) return null;

  async function submit() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/public/appointments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, date, time, customerName: name.trim(), customerPhone: phone.trim(), ...(email.trim() ? { customerEmail: email.trim() } : {}), ...(service ? { service } : {}), ...(staffId ? { staffId } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(ERR[d?.error] ?? "No pudimos reservar tu turno. Probá de nuevo en un momento.");
        if (d?.error === "slot_taken" || d?.error === "slot_unavailable") { setTime(""); setSlots(null); loadSlots(date).then(setSlots).catch(() => undefined); }
        return;
      }
      const text = `Hola! Reservé un turno en ${businessName} para el ${fmtDate(d.date)} a las ${d.time}.${service ? ` Servicio: ${service}.` : ""}${d.staffName ? ` Con ${d.staffName}.` : ""} Soy ${name.trim()}.`;
      setDone({ date: d.date, time: d.time, staffName: d.staffName ?? null, link: whatsappLink(whatsapp, text) });
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const min = cfg.minDate ?? "";
  const max = min ? addDays(min, cfg.horizonDays ?? 30) : undefined;
  const services = cfg.services ?? [];
  const staff = cfg.staff ?? [];
  const ready = !!date && !!time && name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 6;
  const reset = () => { setTime(""); setSlots(null); setError(null); };

  return (
    <section id="turnos" aria-labelledby="book-title" className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-10 @2xl:px-8" data-testid="booking">
      <div className="mx-auto max-w-xl rounded-2xl border bg-card p-5 text-card-foreground shadow-sm @2xl:p-7">
        <h2 id="book-title" className="site-display text-2xl font-bold @2xl:text-3xl">Reservá tu turno</h2>
        {done ? (
          <div className="mt-4 space-y-3" role="status" data-testid="booking-done">
            <p className="text-lg font-semibold">¡Listo! Tu turno quedó reservado.</p>
            <p>{fmtDate(done.date)} a las <strong>{done.time}</strong>{done.staffName ? <> con <strong>{done.staffName}</strong></> : null}. {businessName} te va a confirmar.{email.trim() ? " También te mandamos un mail con los datos." : ""}</p>
            {done.link && <a href={done.link} target="_blank" rel="noopener noreferrer" className="inline-block bg-primary px-4 py-3 text-sm font-medium text-primary-foreground" style={radius}>Avisar por WhatsApp</a>}
          </div>
        ) : (
          <form className="mt-4 space-y-5" onSubmit={(e) => { e.preventDefault(); if (ready && !busy) void submit(); }}>
            {services.length > 0 && (
              <fieldset>
                <legend className="mb-2 text-sm font-medium">¿Qué servicio querés?</legend>
                <div className="grid gap-2 @md:grid-cols-2" role="radiogroup" aria-label="Servicios">
                  {services.map((sv) => (
                    <button key={sv.name} type="button" role="radio" aria-checked={service === sv.name} data-testid="service-option" onClick={() => { setService(sv.name); reset(); }}
                      className={`border p-3 text-left transition-colors ${service === sv.name ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:bg-muted"}`} style={radius}>
                      <span className="block font-semibold">{sv.name}</span>
                      <span className="block text-xs text-muted-foreground">{[sv.minutes ? dur(sv.minutes) : null, sv.price !== null ? formatPrice(sv.price) : null].filter(Boolean).join(" · ") || "Consultá el precio"}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {staff.length > 0 && (
              <label className="block text-sm font-medium">¿Con quién?
                <select className={`${field} mt-1 font-normal`} value={staffId} onChange={(e) => { setStaffId(e.target.value); reset(); }} data-testid="staff-select">
                  <option value="">Cualquiera (el primero libre)</option>
                  {staff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            )}
            <label className="block text-sm font-medium">Día
              <input type="date" className={`${field} mt-1 font-normal`} value={date} min={min} max={max} required onChange={(e) => { setDate(e.target.value); reset(); }} />
            </label>
            {date && (
              <fieldset>
                <legend className="mb-1 text-sm font-medium">Horario{chosen?.minutes ? ` (dura ${dur(chosen.minutes)})` : ""}</legend>
                {slots === null ? <p className="text-sm text-muted-foreground">Buscando horarios…</p> : slots.filter((x) => x.left > 0).length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="no-slots">No hay horarios para ese día. Probá con otro.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 @xl:grid-cols-4" role="radiogroup" aria-label="Horarios disponibles">
                    {slots.map((s) => (
                      <button key={s.time} type="button" role="radio" aria-checked={time === s.time} disabled={s.left === 0} onClick={() => setTime(s.time)} data-testid="slot"
                        className={`rounded-lg border px-2 py-2 text-sm font-medium tabular-nums disabled:cursor-not-allowed disabled:line-through disabled:opacity-40 ${time === s.time ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{s.time}</button>
                    ))}
                  </div>
                )}
              </fieldset>
            )}
            <div className="grid gap-4 @md:grid-cols-2">
              <label className="block text-sm font-medium">Tu nombre <span aria-hidden className="text-destructive">*</span>
                <input className={`${field} mt-1 font-normal`} value={name} maxLength={80} required autoComplete="name" onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="block text-sm font-medium">Tu teléfono <span aria-hidden className="text-destructive">*</span>
                <input className={`${field} mt-1 font-normal`} value={phone} maxLength={30} required inputMode="tel" autoComplete="tel" onChange={(e) => setPhone(e.target.value)} />
              </label>
            </div>
            <label className="block text-sm font-medium">Tu email (opcional)
              <input type="email" className={`${field} mt-1 font-normal`} value={email} maxLength={254} autoComplete="email" onChange={(e) => setEmail(e.target.value)} aria-describedby="book-email-help" />
              <span id="book-email-help" className="mt-1 block text-xs font-normal text-muted-foreground">Si lo dejás, te avisamos cuando se confirme y te recordamos el turno un día antes.</span>
            </label>
            <label className="block text-sm font-medium">Aclaraciones (opcional)
              <textarea className={`${field} mt-1 font-normal`} rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" data-testid="booking-error">{error}</p>}
            <button type="submit" disabled={!ready || busy} className="w-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60" style={radius} data-testid="booking-submit">{busy ? "Reservando…" : "Reservar turno"}</button>
          </form>
        )}
      </div>
    </section>
  );
}
