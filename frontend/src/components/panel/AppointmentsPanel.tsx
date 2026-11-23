"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/fields";
import { api } from "@/lib/authClient";
import { whatsappLink } from "@/lib/whatsapp";
import { formatPrice } from "@/lib/format";

interface Appt {
  id: string; date: string; time: string; minutes: number; customerName: string; customerPhone: string; customerEmail: string | null;
  service: string | null; price: number | null; staffName: string | null; notes: string | null; status: "pendiente" | "confirmado" | "cancelado"; reminded: boolean;
}
interface Service { name: string; minutes: number | null; price: number | null }
interface Staff { id: string; name: string }
interface Settings { enabled: boolean; slotMinutes: number; minNoticeHours: number; capacity: number; horizonDays: number; services: Service[]; staff: Staff[]; allowedByPlan: boolean }

const today = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10); // hoy en Argentina
const shift = (iso: string, n: number) => new Date(new Date(`${iso}T12:00:00-03:00`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const fmt = (iso: string) => iso.split("-").reverse().join("/");
const STATUS: Record<Appt["status"], { label: string; tone: string }> = {
  pendiente: { label: "Por confirmar", tone: "bg-amber-100 text-amber-900" },
  confirmado: { label: "Confirmado", tone: "bg-emerald-100 text-emerald-900" },
  cancelado: { label: "Cancelado", tone: "bg-muted text-muted-foreground line-through" },
};
const ERR: Record<string, string> = {
  plan_not_allowed: "Tu plan no incluye turnos.", invalid_request: "Revisá los valores: algo está fuera de rango.", invalid_transition: "Ese turno ya no admite ese cambio.",
  duplicate_service: "Tenés dos servicios con el mismo nombre.", network: "No pudimos conectarnos.",
};

export function AppointmentsPanel() {
  const [date, setDate] = useState(today);
  const [list, setList] = useState<Appt[] | null>(null);
  const [cfg, setCfg] = useState<Settings | null>(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [noBiz, setNoBiz] = useState(false);
  const [services, setServices] = useState<{ name: string; minutes: string; price: string }[]>([]);
  const [staff, setStaff] = useState<{ id?: string; name: string }[]>([]);

  useEffect(() => {
    let alive = true;
    api<Settings>("/me/appointments/settings").then((r) => {
      if (!alive) return;
      if (r.ok) { setCfg(r.data); setServices(r.data.services.map((x) => ({ name: x.name, minutes: x.minutes ? String(x.minutes) : "", price: x.price !== null ? String(x.price) : "" }))); setStaff(r.data.staff); }
      else if (r.data.error === "no_business") setNoBiz(true);
    });
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
      services: services.filter((x) => x.name.trim()).map((x) => ({ name: x.name.trim(), minutes: x.minutes ? Number(x.minutes) : null, price: x.price ? Number(x.price) : null })),
      staff: staff.filter((x) => x.name.trim()).map((x) => ({ ...(x.id ? { id: x.id } : {}), name: x.name.trim() })),
    } });
    if (!r.ok) return setError(r.data.error ?? "network");
    setCfg({ ...r.data, allowedByPlan: cfg?.allowedByPlan ?? true }); setStaff(r.data.staff); setSaved(true);
  }

  if (noBiz) return <p className="border border-dashed p-6 text-center">Primero creá tu página en el editor.</p>;

  const active = list?.filter((a) => a.status !== "cancelado") ?? [];
  const byStaff = cfg && cfg.staff.length > 0;

  return (
    <section aria-labelledby="appt-title" className="space-y-8">
      <div>
        <h1 id="appt-title" className="text-2xl font-bold">Turnos</h1>
        <p className="mt-2 max-w-[60ch] text-muted-foreground">Tus clientes reservan desde tu página, en los horarios que ya cargaste. Vos confirmás o cancelás, y si dejaron su email les avisamos solos.</p>
      </div>
      {error && <p role="alert" className="bg-destructive/10 p-3 text-sm text-destructive">{ERR[error] ?? "No se pudo completar la acción."}</p>}

      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <Button variant="outline" aria-label="Día anterior" onClick={() => setDate((d) => shift(d, -1))}>←</Button>
          <Field label="Día">{(id) => <TextInput id={id} type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-44" />}</Field>
          <Button variant="outline" aria-label="Día siguiente" onClick={() => setDate((d) => shift(d, 1))}>→</Button>
          <Button variant="outline" onClick={() => setDate(today())}>Hoy</Button>
          {list && <p className="ml-auto text-sm text-muted-foreground" data-testid="appts-count">{active.length} {active.length === 1 ? "turno" : "turnos"} · {fmt(date)}</p>}
        </div>
        {list === null ? <p className="text-muted-foreground">Cargando turnos…</p> : list.length === 0 ? (
          <p className="border border-dashed p-6 text-center text-muted-foreground" data-testid="appts-empty">No hay turnos para este día.</p>
        ) : (
          <ul className="divide-y border" data-testid="appts">
            {list.map((a) => {
              const msg = `Hola ${a.customerName}! Te recordamos tu turno del ${fmt(a.date)} a las ${a.time}${a.service ? ` (${a.service})` : ""}. ¿Nos confirmás que venís?`;
              const wa = whatsappLink(a.customerPhone, msg);
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4" data-testid="appt" data-status={a.status}>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-3"><span className="text-xl font-bold tabular-nums">{a.time}</span><span className="text-sm text-muted-foreground">{a.minutes} min</span><span className={`px-2.5 py-0.5 text-xs font-medium ${STATUS[a.status].tone}`}>{STATUS[a.status].label}</span></p>
                    <p className="mt-1 font-medium">{a.customerName}{a.service ? ` · ${a.service}` : ""}{a.price !== null ? ` · ${formatPrice(a.price)}` : ""}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.customerPhone}{a.customerEmail ? ` · ${a.customerEmail}${a.reminded ? " (recordatorio enviado)" : ""}` : ""}{a.staffName ? ` · con ${a.staffName}` : ""}{a.notes ? ` · ${a.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {wa && a.status !== "cancelado" && <a className="inline-flex h-8 items-center border px-3 text-sm hover:bg-muted" target="_blank" rel="noopener noreferrer" href={wa}>Recordar por WhatsApp</a>}
                    {a.status === "pendiente" && <Button size="sm" onClick={() => void setStatus(a, "confirmado")}>Confirmar</Button>}
                    {a.status !== "cancelado" && <Button size="sm" variant="outline" onClick={() => void setStatus(a, "cancelado")}>Cancelar</Button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {byStaff && list && list.length > 0 && <p className="text-xs text-muted-foreground">Cada profesional atiende un turno a la vez: el mismo horario se puede reservar tantas veces como profesionales tengas.</p>}
      </div>

      {cfg && (
        <form key={JSON.stringify(cfg)} className="space-y-6 border-t pt-6" data-testid="appt-settings" onSubmit={(e) => { e.preventDefault(); void saveSettings(e.currentTarget); }}>
          <h2 className="text-lg font-bold">Configuración</h2>
          {!cfg.allowedByPlan && <p className="bg-muted p-3 text-sm">Tu plan actual no incluye turnos. Podés ver la configuración, pero no activarlos.</p>}
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="enabled" defaultChecked={cfg.enabled} disabled={!cfg.allowedByPlan} />Mostrar «Reservá tu turno» en mi página (solo se ve con el diseño de servicios)</label>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Servicios</legend>
            <p className="text-xs text-muted-foreground">Cada servicio puede tener su duración y precio: el calendario bloquea el tiempo que realmente lleva. Si no cargás ninguno, todos los turnos duran lo mismo.</p>
            {services.map((sv, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_8rem_auto]" data-testid="service-row">
                <TextInput aria-label={`Nombre del servicio ${i + 1}`} placeholder="Ej.: Corte" value={sv.name} maxLength={60} onChange={(e) => setServices((a) => a.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <TextInput aria-label={`Minutos del servicio ${i + 1}`} placeholder="Minutos" type="number" min={5} max={480} value={sv.minutes} onChange={(e) => setServices((a) => a.map((x, j) => (j === i ? { ...x, minutes: e.target.value } : x)))} />
                <TextInput aria-label={`Precio del servicio ${i + 1}`} placeholder="Precio $" type="number" min={0} value={sv.price} onChange={(e) => setServices((a) => a.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                <Button type="button" variant="ghost" aria-label={`Quitar el servicio ${i + 1}`} onClick={() => setServices((a) => a.filter((_, j) => j !== i))}>Quitar</Button>
              </div>
            ))}
            {services.length < 20 && <Button type="button" variant="outline" size="sm" onClick={() => setServices((a) => [...a, { name: "", minutes: "", price: "" }])}>+ Agregar servicio</Button>}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Profesionales (opcional)</legend>
            <p className="text-xs text-muted-foreground">Si trabajan varias personas, cargalas: el cliente puede elegir con quién y cada una atiende un turno a la vez.</p>
            {staff.map((p, i) => (
              <div key={p.id ?? i} className="flex gap-2" data-testid="staff-row">
                <TextInput aria-label={`Nombre del profesional ${i + 1}`} placeholder="Nombre" value={p.name} maxLength={60} onChange={(e) => setStaff((a) => a.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Button type="button" variant="ghost" aria-label={`Quitar al profesional ${i + 1}`} onClick={() => setStaff((a) => a.filter((_, j) => j !== i))}>Quitar</Button>
              </div>
            ))}
            {staff.length < 10 && <Button type="button" variant="outline" size="sm" onClick={() => setStaff((a) => [...a, { name: "" }])}>+ Agregar profesional</Button>}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Paso del calendario (min)" hint="De a cuánto se ofrecen los horarios">{(id, d) => <TextInput id={id} aria-describedby={d} name="slotMinutes" type="number" min={10} max={240} defaultValue={cfg.slotMinutes} required />}</Field>
            <Field label="Cupos por horario" hint={cfg.staff.length > 0 ? "Con profesionales cargados, manda la cantidad de profesionales" : "Cuántas personas pueden reservar la misma franja"}>{(id, d) => <TextInput id={id} aria-describedby={d} name="capacity" type="number" min={1} max={20} defaultValue={cfg.capacity} required />}</Field>
            <Field label="Anticipación mínima (horas)">{(id) => <TextInput id={id} name="minNoticeHours" type="number" min={0} max={168} defaultValue={cfg.minNoticeHours} required />}</Field>
            <Field label="Hasta cuántos días adelante">{(id) => <TextInput id={id} name="horizonDays" type="number" min={1} max={90} defaultValue={cfg.horizonDays} required />}</Field>
          </div>
          <p className="text-xs text-muted-foreground">Los horarios de atención son los de tu negocio (pestaña Negocio del editor). Los mails de turnos (acuse, confirmación y recordatorio un día antes) llegan a quien dejó su email.</p>
          <div>{saved && <p role="status" className="mb-2 text-sm">Guardado.</p>}<Button type="submit">Guardar configuración</Button></div>
        </form>
      )}
    </section>
  );
}
