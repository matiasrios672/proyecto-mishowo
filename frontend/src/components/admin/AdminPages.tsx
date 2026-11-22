"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/fields";
import { API_URL, api } from "@/lib/authClient";
import { siteUrl } from "@/lib/siteUrl";
import { ErrorBox, Money, Pager, useAdmin, when } from "./AdminShell";

const th = "px-3 py-2 text-left text-xs font-medium text-muted-foreground";
const td = "px-3 py-2 align-top text-sm";
const table = "w-full min-w-[640px] border-collapse";
const wrap = "overflow-x-auto rounded-xl border";
const E: Record<string, string> = {
  forbidden_role: "Tu rol no permite esta acción.", not_pending: "Ese pago ya estaba resuelto.", invalid_request: "Revisá los datos: algo no está bien escrito.",
  already_suspended: "Ya estaba suspendido.", not_suspended: "No está suspendido.", not_published: "No está publicado.", days_required: "Para un plan pago hay que indicar cuántos días.",
  cannot_target_self: "No podés hacerlo sobre tu propia cuenta.", user_not_found: "Esa persona todavía no tiene cuenta: pedile que se registre primero.", is_owner: "No se puede cambiar a un Owner.",
  already_resolved: "Otra persona ya resolvió esta denuncia.", note_required: "Escribí la nota antes de guardarla.", business_gone: "El negocio ya no existe.", gratis_must_stay_free: "El plan gratuito tiene que seguir activo y costar $ 0.", invalid_plan: "Ese plan no sirve para esto.", network: "No pudimos conectarnos.",
};
export const msg = (e?: string) => E[e ?? ""] ?? "No se pudo completar la acción.";

/** Carga un recurso del admin y lo recarga con `reload()`. */
export function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    api<T>(path).then((r) => { if (!alive) return; if (r.ok) { setData(r.data); setError(null); } else setError(msg(r.data.error)); });
    return () => { alive = false; };
  }, [path, tick]);
  return { data, error, reload: () => setTick((n) => n + 1) };
}

// ───────────── Resumen ─────────────
interface Dash {
  kpis: Record<string, number>; byPlan: { plan: string; count: number }[]; byIndustry: { industry: string; count: number }[];
  signups: { day: string; count: number }[]; alerts: { pendingPayments: number; expiring7d: number; newReports: number; stalePayments: number; oldestPending: string | null };
}
export function Dashboard() {
  const { data: d, error } = useLoad<Dash>("/admin/dashboard");
  if (!d) return <><ErrorBox error={error} />{!error && <p className="text-muted-foreground">Cargando…</p>}</>;
  const k = d.kpis;
  const tiles: [string, string][] = [
    ["Negocios", String(k.businesses)], ["Publicados", String(k.published)], ["Nuevos hoy", String(k.newToday)], ["Nuevos esta semana", String(k.newWeek)], ["Nuevos este mes", String(k.newMonth)],
    ["Activos (pedidos en 7 días)", String(k.active7d)], ["Con plan pago", String(k.paidActive)], ["Ingreso mensual estimado", Money(k.mrr)],
    ["Vencen en 7 días", String(k.expiring7d)], ["Bajas del mes", String(k.churn30d)], ["Conversión a pago", `${k.conversion}%`], ["Suspendidos", String(k.suspended)],
  ];
  const max = Math.max(1, ...d.signups.map((s) => s.count));
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Resumen</h1>
      {(d.alerts.pendingPayments > 0 || d.alerts.expiring7d > 0 || d.alerts.newReports > 0 || d.alerts.stalePayments > 0) && (
        <ul className="flex flex-wrap gap-3" aria-label="Alertas">
          {d.alerts.pendingPayments > 0 && <li><Link href="/admin/pagos" className="block rounded-lg border-2 border-primary px-4 py-2 text-sm font-medium">{d.alerts.pendingPayments} pago{d.alerts.pendingPayments === 1 ? "" : "s"} para confirmar</Link></li>}
          {d.alerts.expiring7d > 0 && <li className="rounded-lg border px-4 py-2 text-sm">{d.alerts.expiring7d} plan{d.alerts.expiring7d === 1 ? "" : "es"} por vencer en 7 días</li>}
          {d.alerts.stalePayments > 0 && <li><Link href="/admin/pagos" className="block rounded-lg border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive">{d.alerts.stalePayments} pago{d.alerts.stalePayments === 1 ? "" : "s"} esperando hace más de 2 días</Link></li>}
          {d.alerts.newReports > 0 && <li><Link href="/admin/denuncias" className="block rounded-lg border border-destructive/50 px-4 py-2 text-sm text-destructive">{d.alerts.newReports} denuncia{d.alerts.newReports === 1 ? "" : "s"} nueva{d.alerts.newReports === 1 ? "" : "s"}</Link></li>}
        </ul>
      )}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4" data-testid="kpis">
        {tiles.map(([label, value]) => <div key={label} className="border-t pt-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-2xl font-bold tabular-nums">{value}</dd></div>)}
      </dl>
      <section aria-labelledby="altas">
        <h2 id="altas" className="mb-3 font-semibold">Altas por día (últimos 30 días)</h2>
        <div role="img" aria-label={`Altas por día: ${d.signups.map((s) => `${s.day} ${s.count}`).join(", ")}`} className="flex h-32 items-end gap-1">
          {d.signups.map((s) => <div key={s.day} title={`${s.day}: ${s.count}`} className="flex-1 rounded-t bg-primary" style={{ height: `${Math.max(3, (s.count / max) * 100)}%`, opacity: s.count ? 1 : 0.25 }} />)}
        </div>
      </section>
      <div className="grid gap-8 sm:grid-cols-2">
        <section><h2 className="mb-2 font-semibold">Por plan</h2><ul className="space-y-1 text-sm">{d.byPlan.map((p) => <li key={p.plan} className="flex justify-between border-b py-1"><span>{p.plan}</span><span className="tabular-nums">{p.count}</span></li>)}</ul></section>
        <section><h2 className="mb-2 font-semibold">Por rubro</h2><ul className="space-y-1 text-sm">{d.byIndustry.map((p) => <li key={p.industry} className="flex justify-between border-b py-1"><span>{p.industry}</span><span className="tabular-nums">{p.count}</span></li>)}</ul></section>
      </div>
    </div>
  );
}

// ───────────── Pagos ─────────────
interface Pay { id: string; businessId: string; businessName: string; slug: string; ownerEmail: string; planId: string; months: number; amount: number; status: string; note: string | null; rejectReason: string | null; hasReceipt: boolean; createdAt: string }
export function Payments() {
  const [status, setStatus] = useState("pendiente");
  const { data, error, reload } = useLoad<{ payments: Pay[] }>(`/admin/payments?status=${status}`);
  const [err, setErr] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, kind: "confirm" | "reject") {
    setBusy(id); setErr(null);
    const r = await api(`/admin/payments/${id}/${kind}`, { body: kind === "reject" ? { reason } : {} });
    setBusy(null);
    if (!r.ok) return setErr(msg(r.data.error));
    setRejecting(null); setReason(""); reload();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Pagos</h1>
        <Button variant="outline" onClick={() => setManual((v) => !v)} aria-expanded={manual}>Registrar un pago manual</Button>
      </div>
      {manual && <ManualPayment onDone={() => { setManual(false); reload(); }} />}
      <div role="tablist" aria-label="Estado" className="flex gap-1">
        {["pendiente", "confirmado", "rechazado"].map((s) => <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1.5 text-sm ${status === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{s === "pendiente" ? "Pendientes" : s === "confirmado" ? "Confirmados" : "Rechazados"}</button>)}
      </div>
      <ErrorBox error={error ?? err} />
      {data?.payments.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground" data-testid="payments-empty">No hay pagos {status === "pendiente" ? "pendientes" : status === "confirmado" ? "confirmados" : "rechazados"}.</p>}
      <ul className="space-y-3">
        {data?.payments.map((p) => (
          <li key={p.id} className="rounded-xl border p-4" data-testid="admin-payment">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold"><Link className="underline underline-offset-4" href={`/admin/negocios/${p.businessId}`}>{p.businessName}</Link> · Plan {p.planId} · {p.months} {p.months === 1 ? "mes" : "meses"}</p>
                <p className="text-sm text-muted-foreground">{p.ownerEmail} · {when(p.createdAt)}</p>
              </div>
              <p className="text-xl font-bold tabular-nums">{Money(p.amount)}</p>
            </div>
            {p.note && <p className="mt-2 text-sm">Aclaración: {p.note}</p>}
            {p.rejectReason && <p className="mt-2 text-sm text-destructive">Motivo del rechazo: {p.rejectReason}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {p.hasReceipt ? <a className="rounded-md border px-3 py-1.5 text-sm" href={`${API_URL}/admin/payments/${p.id}/receipt`} target="_blank" rel="noopener noreferrer">Ver comprobante</a> : <span className="text-sm text-muted-foreground">Sin comprobante</span>}
              {p.status === "pendiente" && (rejecting === p.id ? (
                <span className="flex flex-wrap items-center gap-2">
                  <TextInput aria-label="Motivo del rechazo" placeholder="Motivo (se lo mandamos por email)" value={reason} onChange={(e) => setReason(e.target.value)} className="w-72" />
                  <Button size="sm" variant="destructive" disabled={busy === p.id || reason.trim().length < 3} onClick={() => void act(p.id, "reject")}>Rechazar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setRejecting(null)}>Cancelar</Button>
                </span>
              ) : (
                <>
                  <Button size="sm" disabled={busy === p.id} onClick={() => void act(p.id, "confirm")}>Confirmar pago</Button>
                  <Button size="sm" variant="outline" onClick={() => { setRejecting(p.id); setReason(""); }}>Rechazar</Button>
                </>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ManualPayment({ onDone }: { onDone: () => void }) {
  const plans = useLoad<{ plans: { id: string; name: string; priceMonthly: number }[] }>("/admin/plans");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const r = await api("/admin/payments/manual", { body: { businessId: String(f.get("businessId")).trim(), planId: String(f.get("planId")), months: Number(f.get("months")), method: String(f.get("method")), ...(String(f.get("amount")) ? { amount: Number(f.get("amount")) } : {}), ...(String(f.get("note")).trim() ? { note: String(f.get("note")).trim() } : {}) } });
      if (r.ok) onDone(); else setErr(msg(r.data.error));
    }}>
      <Field label="ID del negocio" hint="Lo ves en la ficha del negocio">{(id, d) => <TextInput id={id} aria-describedby={d} name="businessId" required />}</Field>
      <Field label="Plan">{(id) => <Select id={id} name="planId">{plans.data?.plans.filter((p) => p.priceMonthly > 0).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}</Field>
      <Field label="Meses">{(id) => <TextInput id={id} name="months" type="number" min={1} max={24} defaultValue={1} required />}</Field>
      <Field label="Medio">{(id) => <Select id={id} name="method"><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="otro">Otro</option></Select>}</Field>
      <Field label="Monto ($)" hint="Vacío = precio del plan × meses">{(id, d) => <TextInput id={id} aria-describedby={d} name="amount" type="number" min={0} step="0.01" />}</Field>
      <Field label="Nota">{(id) => <TextInput id={id} name="note" maxLength={300} />}</Field>
      <div className="sm:col-span-2"><ErrorBox error={err} /><Button type="submit">Registrar y activar el plan</Button></div>
    </form>
  );
}

// ───────────── Negocios ─────────────
interface Biz { id: string; slug: string; name: string; industry: string; status: string; planId: string; planExpiresAt: string | null; ownerEmail: string; createdAt: string }
export function Businesses() {
  const [q, setQ] = useState(""), [status, setStatus] = useState(""), [plan, setPlan] = useState(""), [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page), ...(q ? { q } : {}), ...(status ? { status } : {}), ...(plan ? { plan } : {}) }).toString();
  const { data, error } = useLoad<{ businesses: Biz[]; total: number; pageSize: number }>(`/admin/businesses?${qs}`);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Negocios</h1>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Buscar">{(id) => <TextInput id={id} type="search" placeholder="Nombre, link o email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="w-64" />}</Field>
        <Field label="Estado">{(id) => <Select id={id} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Todos</option><option value="published">Publicados</option><option value="draft">Borradores</option><option value="suspended">Suspendidos</option></Select>}</Field>
        <Field label="Plan">{(id) => <Select id={id} value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }}><option value="">Todos</option><option value="gratis">Gratis</option><option value="emprende">Emprende</option><option value="pro">Pro</option></Select>}</Field>
      </div>
      <ErrorBox error={error} />
      <div className={wrap}>
        <table className={table}>
          <caption className="sr-only">Negocios</caption>
          <thead className="bg-muted/50"><tr>{["Negocio", "Dueño", "Estado", "Plan", "Vence", "Alta"].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {data?.businesses.map((b) => (
              <tr key={b.id} className="border-t" data-testid="admin-business">
                <td className={td}><Link href={`/admin/negocios/${b.id}`} className="font-medium underline underline-offset-4">{b.name}</Link><div className="text-xs text-muted-foreground">{b.slug}</div></td>
                <td className={td}>{b.ownerEmail}</td><td className={td}>{b.status}</td><td className={td}>{b.planId}</td><td className={td}>{b.planExpiresAt ? when(b.planExpiresAt) : "—"}</td><td className={td}>{when(b.createdAt)}</td>
              </tr>
            ))}
            {data?.businesses.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No hay negocios con esos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      {data && <Pager page={page} total={data.total} size={data.pageSize} onPage={setPage} />}
    </div>
  );
}

interface Detail {
  business: { id: string; slug: string; name: string; status: string; planId: string; planExpiresAt: string | null; internalNote: string | null; createdAt: string };
  view: { design: { layout?: string; theme?: string; fontPair?: string } | null; whatsappSet: boolean; instagramSet: boolean; addressSet: boolean; openDays: number; announcement: string; categories: number; available_products: number; media: number; open_reports: number; last_order_at: string | null };
  owner: { id: string; email: string; blockedAt: string | null }; counts: { products: number; orders: number };
  payments: { id: string; planId: string; months: number; amount: number; status: string; createdAt: string }[];
  history: { id: number; action: string; createdAt: string }[];
}
export function BusinessDetail({ id }: { id: string }) {
  const me = useAdmin();
  const { data, error, reload } = useLoad<Detail>(`/admin/businesses/${id}`);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [days, setDays] = useState(30), [planId, setPlanId] = useState("emprende");
  const manage = me.role !== "support";
  if (!data) return <ErrorBox error={error ?? "Cargando…"} />;
  const b = data.business;
  async function act(path: string, method: "POST" | "PUT" | "DELETE" = "POST", body: object = {}) {
    setErr(null);
    const r = await api(`/admin/businesses/${id}${path}`, { method, body: method === "DELETE" ? undefined : body });
    if (!r.ok) return setErr(msg(r.data.error));
    reload();
  }
  return (
    <div className="space-y-6">
      <Link href="/admin/negocios" className="text-sm underline underline-offset-4">← Negocios</Link>
      <div><h1 className="text-2xl font-bold">{b.name}</h1><p className="text-sm text-muted-foreground">ID: <code>{b.id}</code> · {b.status} · plan {b.planId}{b.planExpiresAt ? ` hasta ${when(b.planExpiresAt)}` : ""}</p></div>
      <ErrorBox error={err} />
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {([["Dueño", data.owner.email], ["Productos", data.counts.products], ["Pedidos", data.counts.orders], ["Alta", when(b.createdAt)]] as const).map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>)}
      </dl>
      {b.status === "published" && <a className="inline-block text-sm underline underline-offset-4" href={siteUrl(b.slug)} target="_blank" rel="noopener noreferrer">Ver la página publicada</a>}

      <section aria-labelledby="view-title" data-testid="business-view">
        <h2 id="view-title" className="mb-2 font-semibold">Cómo está armada su página <span className="text-xs font-normal text-muted-foreground">(solo lectura)</span></h2>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {([["Diseño", `${data.view.design?.layout ?? "—"} · ${data.view.design?.theme ?? "—"}`], ["Categorías", data.view.categories], ["Productos disponibles", data.view.available_products], ["Fotos y videos", data.view.media], ["Días con horario", data.view.openDays], ["WhatsApp", data.view.whatsappSet ? "Cargado" : "Falta"], ["Instagram", data.view.instagramSet ? "Cargado" : "No"], ["Dirección", data.view.addressSet ? "Cargada" : "No"], ["Último pedido", data.view.last_order_at ? when(data.view.last_order_at) : "Ninguno"], ["Denuncias abiertas", data.view.open_reports]] as const).map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>)}
        </dl>
        {data.view.announcement && <p className="mt-2 text-sm">Anuncio: “{data.view.announcement}”</p>}
      </section>

      <section className="space-y-2"><h2 className="font-semibold">Nota interna</h2>
        <TextArea aria-label="Nota interna" rows={3} maxLength={1000} value={note ?? b.internalNote ?? ""} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" variant="outline" disabled={note === null} onClick={() => void act("/note", "PUT", { note: note ?? "" }).then(() => setNote(null))}>Guardar nota</Button>
      </section>

      {manage ? (
        <section className="space-y-3"><h2 className="font-semibold">Acciones</h2>
          <div className="flex flex-wrap gap-2">
            {b.status !== "suspended" ? <Button size="sm" variant="outline" onClick={() => void act("/suspend")}>Suspender</Button> : <Button size="sm" onClick={() => void act("/reactivate")}>Reactivar</Button>}
            {b.status === "published" && <Button size="sm" variant="outline" onClick={() => void act("/unpublish")}>Despublicar</Button>}
            {confirmDel ? <span className="flex items-center gap-2 text-sm">¿Eliminar este negocio?<Button size="sm" variant="destructive" onClick={() => void act("", "DELETE")}>Sí, eliminar</Button><Button size="sm" variant="ghost" onClick={() => setConfirmDel(false)}>No</Button></span> : <Button size="sm" variant="ghost" onClick={() => setConfirmDel(true)}>Eliminar</Button>}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Cambiar plan">{(i) => <Select id={i} value={planId} onChange={(e) => setPlanId(e.target.value)}><option value="emprende">Emprende</option><option value="pro">Pro</option><option value="gratis">Gratis</option></Select>}</Field>
            <Field label="Días">{(i) => <TextInput id={i} type="number" min={1} max={3650} value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-24" />}</Field>
            <Button size="sm" variant="outline" onClick={() => void act("/plan", "POST", { planId, ...(planId !== "gratis" ? { days } : {}) })}>Aplicar plan</Button>
          </div>
        </section>
      ) : <p className="text-sm text-muted-foreground">Tu rol (Soporte) permite ver y dejar notas, no cambiar planes ni moderar.</p>}

      <section><h2 className="mb-2 font-semibold">Pagos</h2>{data.payments.length === 0 ? <p className="text-sm text-muted-foreground">Sin pagos.</p> : <ul className="space-y-1 text-sm">{data.payments.map((p) => <li key={p.id}>{p.planId} · {p.months} m · {Money(p.amount)} · {p.status} · {when(p.createdAt)}</li>)}</ul>}</section>
      <section><h2 className="mb-2 font-semibold">Historial</h2>{data.history.length === 0 ? <p className="text-sm text-muted-foreground">Sin movimientos.</p> : <ul className="space-y-1 text-sm">{data.history.map((h) => <li key={h.id}>{when(h.createdAt)} · {h.action}</li>)}</ul>}</section>
    </div>
  );
}

// ───────────── Usuarios ─────────────
interface Usr { id: string; email: string; name: string | null; role: string; emailVerifiedAt: string | null; blockedAt: string | null; lastLoginAt: string | null; createdAt: string }
export function Users() {
  const me = useAdmin();
  const [q, setQ] = useState(""), [page, setPage] = useState(1);
  const { data, error, reload } = useLoad<{ users: Usr[]; total: number; pageSize: number }>(`/admin/users?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const [err, setErr] = useState<string | null>(null);
  async function toggle(u: Usr) {
    setErr(null);
    const r = await api(`/admin/users/${u.id}/${u.blockedAt ? "unblock" : "block"}`, { body: {} });
    if (!r.ok) return setErr(msg(r.data.error));
    reload();
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Usuarios</h1>
      <Field label="Buscar">{(id) => <TextInput id={id} type="search" placeholder="Email o nombre" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="w-64" />}</Field>
      <ErrorBox error={error ?? err} />
      <div className={wrap}>
        <table className={table}>
          <caption className="sr-only">Usuarios</caption>
          <thead className="bg-muted/50"><tr>{["Email", "Rol", "Email verificado", "Último ingreso", "Estado", ""].map((h, i) => <th key={i} scope="col" className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {data?.users.map((u) => (
              <tr key={u.id} className="border-t" data-testid="admin-user">
                <td className={td}>{u.email}{u.name && <div className="text-xs text-muted-foreground">{u.name}</div>}</td><td className={td}>{u.role}</td>
                <td className={td}>{u.emailVerifiedAt ? "Sí" : "No"}</td><td className={td}>{when(u.lastLoginAt)}</td><td className={td}>{u.blockedAt ? <span className="text-destructive">Bloqueado</span> : "Activo"}</td>
                <td className={td}>{me.role !== "support" && u.id !== me.id && <Button size="sm" variant="outline" onClick={() => void toggle(u)}>{u.blockedAt ? "Desbloquear" : "Bloquear"}</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && <Pager page={page} total={data.total} size={data.pageSize} onPage={setPage} />}
    </div>
  );
}

// ───────────── Planes y ajustes ─────────────
interface PlanRow { id: string; name: string; priceMonthly: number; limits: { products: number | null; photosPerProduct: number; whatsappNumbers: number; uploadMb: number }; features: string[]; active: boolean }
function PlanEditor({ plan, onSaved }: { plan: PlanRow; onSaved: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const free = plan.id === "gratis";
  return (
    <form className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3" data-testid="plan-form" onSubmit={async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const prod = String(f.get("products")).trim();
      const r = await api(`/admin/plans/${plan.id}`, { method: "PUT", body: {
        name: String(f.get("name")), priceMonthly: Number(f.get("price")), active: f.get("active") === "on",
        limits: { products: prod === "" ? null : Number(prod), photosPerProduct: Number(f.get("photos")), whatsappNumbers: Number(f.get("wa")), uploadMb: Number(f.get("mb")) },
        features: String(f.get("features")).split("\n").map((x) => x.trim()).filter(Boolean),
      } });
      if (r.ok) { setErr(null); setOk(true); onSaved(); } else { setOk(false); setErr(msg(r.data.error)); }
    }}>
      <h3 className="font-semibold sm:col-span-3">{plan.name} <span className="text-xs font-normal text-muted-foreground">({plan.id})</span></h3>
      <Field label="Nombre">{(id) => <TextInput id={id} name="name" defaultValue={plan.name} required />}</Field>
      <Field label="Precio por mes ($)">{(id) => <TextInput id={id} name="price" type="number" min={0} step="0.01" defaultValue={plan.priceMonthly} required />}</Field>
      <Field label="Productos máx." hint="Vacío = ilimitados">{(id, d) => <TextInput id={id} aria-describedby={d} name="products" type="number" min={1} defaultValue={plan.limits.products ?? ""} />}</Field>
      <Field label="Fotos por producto">{(id) => <TextInput id={id} name="photos" type="number" min={0} defaultValue={plan.limits.photosPerProduct} required />}</Field>
      <Field label="WhatsApp">{(id) => <TextInput id={id} name="wa" type="number" min={1} defaultValue={plan.limits.whatsappNumbers} required />}</Field>
      <Field label="Subida máx. (MB)">{(id) => <TextInput id={id} name="mb" type="number" min={1} defaultValue={plan.limits.uploadMb} required />}</Field>
      <div className="sm:col-span-2"><Field label="Beneficios (uno por línea)">{(id) => <TextArea id={id} name="features" rows={4} defaultValue={plan.features.join("\n")} />}</Field></div>
      <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="active" defaultChecked={plan.active} disabled={free} /> Activo (se muestra y se puede contratar)</label>
      <div className="sm:col-span-3"><ErrorBox error={err} />{ok && <p role="status" className="mb-2 text-sm">Guardado. Ya se ve en la landing y en los avisos de pago.</p>}<Button type="submit" size="sm">Guardar {plan.name}</Button></div>
    </form>
  );
}

export function Plans() {
  const me = useAdmin();
  const { data, error, reload } = useLoad<{ plans: PlanRow[] }>("/admin/plans");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Planes y precios</h1>
      <p className="max-w-[60ch] text-muted-foreground">Los precios y límites que cargues acá se aplican enseguida: en la landing, en los avisos de pago y en los límites de cada negocio.</p>
      <ErrorBox error={error} />
      {data?.plans.map((p) => <PlanEditor key={p.id} plan={p} onSaved={reload} />)}
      {me.role === "owner" && <PaymentSettings />}
    </div>
  );
}

function PaymentSettings() {
  const { data, error } = useLoad<{ holder: string; alias: string; cbu: string; bank: string; instructions: string }>("/admin/settings/payment");
  const [msgOk, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!data) return <ErrorBox error={error} />;
  return (
    <form className="grid gap-3 rounded-xl border-2 p-4 sm:grid-cols-2" data-testid="payment-settings" onSubmit={async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const r = await api("/admin/settings/payment", { method: "PUT", body: Object.fromEntries(["holder", "alias", "cbu", "bank", "instructions"].map((k) => [k, String(f.get(k) ?? "")])) });
      if (r.ok) { setErr(null); setOk(true); } else { setOk(false); setErr(r.data.error === "invalid_request" ? "Revisá el CBU: son solo números (hasta 22)." : msg(r.data.error)); }
    }}>
      <h2 className="font-semibold sm:col-span-2">Datos para transferir (solo Owner)</h2>
      <Field label="Titular">{(id) => <TextInput id={id} name="holder" defaultValue={data.holder} maxLength={100} />}</Field>
      <Field label="Alias">{(id) => <TextInput id={id} name="alias" defaultValue={data.alias} maxLength={60} />}</Field>
      <Field label="CBU / CVU">{(id) => <TextInput id={id} name="cbu" defaultValue={data.cbu} inputMode="numeric" maxLength={22} />}</Field>
      <Field label="Banco">{(id) => <TextInput id={id} name="bank" defaultValue={data.bank} maxLength={60} />}</Field>
      <div className="sm:col-span-2"><Field label="Instrucciones para quien paga">{(id) => <TextArea id={id} name="instructions" rows={2} defaultValue={data.instructions} maxLength={500} />}</Field></div>
      <div className="sm:col-span-2"><ErrorBox error={err} />{msgOk && <p role="status" className="mb-2 text-sm">Guardado. Los usuarios ya ven estos datos.</p>}<Button type="submit" size="sm">Guardar datos de pago</Button></div>
    </form>
  );
}

// ───────────── Auditoría ─────────────
interface Entry { id: number; at: string; actor: string | null; action: string; entity: string; entityId: string; before: unknown; after: unknown; ip: string | null }
export function Audit() {
  const [entity, setEntity] = useState(""), [page, setPage] = useState(1);
  const { data, error } = useLoad<{ entries: Entry[] }>(`/admin/audit?page=${page}${entity ? `&entity=${entity}` : ""}`);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Auditoría</h1>
      <p className="text-sm text-muted-foreground">Registro de solo lectura: nadie puede modificarlo ni borrarlo.</p>
      <Field label="Filtrar por tipo">{(id) => <Select id={id} value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}><option value="">Todo</option><option value="payment">Pagos</option><option value="business">Negocios</option><option value="user">Usuarios</option><option value="plan">Planes</option><option value="settings">Ajustes</option></Select>}</Field>
      <ErrorBox error={error} />
      <div className={wrap}>
        <table className={table}>
          <caption className="sr-only">Auditoría</caption>
          <thead className="bg-muted/50"><tr>{["Cuándo", "Quién", "Acción", "Sobre", "Antes → después", "IP"].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {data?.entries.map((e) => (
              <tr key={e.id} className="border-t" data-testid="audit-row">
                <td className={td}>{when(e.at)}</td><td className={td}>{e.actor ?? "Sistema"}</td><td className={td}><code>{e.action}</code></td><td className={td}>{e.entity} <span className="text-xs text-muted-foreground">{e.entityId.slice(0, 8)}</span></td>
                <td className={`${td} max-w-xs break-words text-xs`}>{e.before ? JSON.stringify(e.before) : "—"} → {e.after ? JSON.stringify(e.after) : "—"}</td><td className={td}>{e.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav className="flex items-center gap-2 text-sm"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button><span>Página {page}</span><Button size="sm" variant="outline" disabled={(data?.entries.length ?? 0) < 50} onClick={() => setPage(page + 1)}>Siguiente</Button></nav>
    </div>
  );
}

// ───────────── Equipo (solo Owner) ─────────────
export function Team() {
  const me = useAdmin();
  const { data, error, reload } = useLoad<{ admins: { id: string; email: string; role: string; totpEnabled: boolean; lastLoginAt: string | null }[] }>("/admin/admins");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Equipo</h1>
      <ErrorBox error={error ?? err} />
      <ul className="divide-y rounded-xl border" data-testid="team">
        {data?.admins.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span><strong>{a.email}</strong> · {a.role === "owner" ? "Owner" : a.role === "admin" ? "Admin" : "Soporte"} · 2FA {a.totpEnabled ? "activo" : "pendiente"} · último ingreso {when(a.lastLoginAt)}</span>
            {a.role !== "owner" && a.id !== me.id && <Button size="sm" variant="ghost" onClick={async () => { const r = await api(`/admin/admins/${a.id}`, { method: "DELETE" }); if (r.ok) reload(); else setErr(msg(r.data.error)); }}>Quitar acceso</Button>}
          </li>
        ))}
      </ul>
      <form className="flex flex-wrap items-end gap-3 rounded-xl border p-4" onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const r = await api("/admin/admins", { body: { email: String(f.get("email")), role: String(f.get("role")) } });
        if (r.ok) { setErr(null); (e.target as HTMLFormElement).reset(); reload(); } else setErr(msg(r.data.error));
      }}>
        <Field label="Email de una cuenta existente">{(id) => <TextInput id={id} name="email" type="email" required className="w-72" />}</Field>
        <Field label="Rol">{(id) => <Select id={id} name="role"><option value="support">Soporte</option><option value="admin">Admin</option></Select>}</Field>
        <Button type="submit">Dar acceso</Button>
      </form>
    </div>
  );
}
