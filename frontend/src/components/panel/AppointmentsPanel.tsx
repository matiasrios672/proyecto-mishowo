"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/fields";
import { api } from "@/lib/authClient";
import { whatsappLink } from "@/lib/whatsapp";

interface Appt { id: string; date: string; time: string; customerName: string; customerPhone: string; service: string | null; notes: string | null; status: "pendiente" | "confirmado" | "cancelado" }
interface Settings { enabled: boolean; slotMinutes: number; minNoticeHours: number; capacity: number; horizonDays: number; services: string[]; allowedByPlan: boolean }

const today = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10); // hoy en Argentina
const STATUS: Record<Appt["status"], { label: string; tone: string }> = {
  pendiente: { label: "Por confirmar", tone: "bg-amber-100 text-amber-900" },
  confirmado: { label: "Confirmado", tone: "bg-emerald-100 text-emerald-900" },
  cancelado: { label: "Cancelado", tone: "bg-muted text-muted-foreground line-through" },
};
const ERR: Record<string, string> = { plan_not_allowed: "Tu plan no incluye turnos.", invalid_request: "Revisá los valores: algo está fuera de rango.", invalid_transition: "Ese turno ya no admite ese cambio.", network: "No pudimos conectarnos." };

export function AppointmentsPanel() {
  const [date, setDate] = useState(today);
  const [list, setList] = useState<Appt[] | null>(null);
  const [cfg, setCfg] = useState<Settings | null>(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [noBiz, setNoBiz] = useState(false);

  useEffect(() => {
    let alive = true;
    api<Settings>("/me/appointments/settings").then((r) => { if (!alive) return; if (r.ok) setCfg(r.data); else if (r.data.error === "no_business") setNoBiz(true); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    let alive = true;
    api<{ appointments: Appt[] }>(`/me/appointments?date=${date}`).then((r) => { if (alive && r.ok) setList(r.data.appointments); });
    return () => { alive = false; };
  }, [date, tick]);

  async function setStatus(a: Appt, status: "confirmado" | "cancelado") {
    setError(null);
    const r = await api(`/me/appointments/${a.id}/status`, { method: "PATCH", body: { status } });
    if (!r.ok) setError(r.data.error ?? "network");
    setTick((n) => n + 1);
  }

  async function saveSettings(form: HTMLFormElement) {
    const f = new FormData(form);
    setError(null); setSaved(false);
    const r = await api<Settings>("/me/appointments/settings", { method: "PUT", body: {
      enabled: f.get("enabled") === "on", slotMinutes: Number(f.get("slotMinutes")), minNoticeHours: Number(f.get("minNoticeHours")),
      capacity: Number(f.get("capacity")), horizonDays: Number(f.get("horizonDays")),
      services: String(f.get("services") ?? "").split("\n").map((x) => x.trim()).filter(Boolean),
    } });
    if (!r.ok) return setError(r.data.error ?? "network");
    setCfg({ ...r.data, allowedByPlan: cfg?.allowedByPlan ?? true }); setSaved(true);
  }

  if (noBiz) return <p className="rounded-xl border border-dashed p-6 text-center">Primero creá tu página en el editor.</p>;

  return (
    <section aria-labelledby="appt-title" className="space-y-8">
      <div>
        <h1 id="appt-title" className="text-2xl font-bold">Turnos</h1>
        <p className="mt-2 max-w-[60ch] text-muted-foreground">Tus clientes reservan desde tu página, en los horarios que ya cargaste. Vos confirmás o cancelás.</p>
      </div>
      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{ERR[error] ?? "No se pudo completar la acción."}</p>}

      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Día">{(id) => <TextInput id={id} type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-44" />}</Field>
          <Button variant="outline" onClick={() => setDate(today())}>Hoy</Button>
        </div>
        {list === null ? <p className="text-muted-foreground">Cargando turnos…</p> : list.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground" data-testid="appts-empty">No hay turnos para este día.</p>
        ) : (
          <ul className="space-y-3" data-testid="appts">
            {list.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4" data-testid="appt" data-status={a.status}>
                <div>
                  <p className="flex items-center gap-3"><span className="text-xl font-bold tabular-nums">{a.time}</span><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[a.status].tone}`}>{STATUS[a.status].label}</span></p>
                  <p className="mt-1 font-medium">{a.customerName}{a.service ? ` · ${a.service}` : ""}</p>
                  <p className="text-sm text-muted-foreground">{a.customerPhone}{a.notes ? ` · ${a.notes}` : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {whatsappLink(a.customerPhone, `Hola ${a.customerName}! Te escribo por tu turno del ${a.date.split("-").reverse().join("/")} a las ${a.time}.`) && (
                    <a className="inline-flex h-8 items-center rounded-lg border px-3 text-sm" target="_blank" rel="noopener noreferrer" href={whatsappLink(a.customerPhone, `Hola ${a.customerName}! Te escribo por tu turno del ${a.date.split("-").reverse().join("/")} a las ${a.time}.`)!}>Escribir</a>
                  )}
                  {a.status === "pendiente" && <Button size="sm" onClick={() => void setStatus(a, "confirmado")}>Confirmar</Button>}
                  {a.status !== "cancelado" && <Button size="sm" variant="outline" onClick={() => void setStatus(a, "cancelado")}>Cancelar</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {cfg && (
        <form key={JSON.stringify(cfg)} className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2" data-testid="appt-settings" onSubmit={(e) => { e.preventDefault(); void saveSettings(e.currentTarget); }}>
          <h2 className="font-semibold sm:col-span-2">Configuración</h2>
          {!cfg.allowedByPlan && <p className="rounded-lg bg-muted p-3 text-sm sm:col-span-2">Tu plan actual no incluye turnos. Podés ver la configuración, pero no activarlos.</p>}
          <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2"><input type="checkbox" name="enabled" defaultChecked={cfg.enabled} disabled={!cfg.allowedByPlan} />Mostrar «Reservá tu turno» en mi página (solo se ve con el diseño de servicios)</label>
          <Field label="Duración de cada turno (min)">{(id) => <TextInput id={id} name="slotMinutes" type="number" min={10} max={240} defaultValue={cfg.slotMinutes} required />}</Field>
          <Field label="Cupos por horario" hint="Cuántas personas pueden reservar la misma franja">{(id, d) => <TextInput id={id} aria-describedby={d} name="capacity" type="number" min={1} max={20} defaultValue={cfg.capacity} required />}</Field>
          <Field label="Anticipación mínima (horas)">{(id) => <TextInput id={id} name="minNoticeHours" type="number" min={0} max={168} defaultValue={cfg.minNoticeHours} required />}</Field>
          <Field label="Hasta cuántos días adelante">{(id) => <TextInput id={id} name="horizonDays" type="number" min={1} max={90} defaultValue={cfg.horizonDays} required />}</Field>
          <div className="sm:col-span-2"><Field label="Servicios (uno por línea, opcional)" hint="Si los cargás, el cliente elige uno al reservar">{(id, d) => <textarea id={id} aria-describedby={d} name="services" rows={3} defaultValue={cfg.services.join("\n")} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />}</Field></div>
          <p className="text-xs text-muted-foreground sm:col-span-2">Los horarios de atención son los de tu negocio (pestaña Negocio del editor).</p>
          <div className="sm:col-span-2">{saved && <p role="status" className="mb-2 text-sm">Guardado.</p>}<Button type="submit">Guardar configuración</Button></div>
        </form>
      )}
    </section>
  );
}
