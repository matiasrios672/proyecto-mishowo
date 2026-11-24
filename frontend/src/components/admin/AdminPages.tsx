"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/fields";
import { API_URL, api } from "@/lib/authClient";
import { siteUrl } from "@/lib/siteUrl";
import { CountUp, PanelSkeleton } from "@/components/feedback/CountUp";
import { ErrorBox, Money, Pager, useAdmin, when, PageHeader } from "./AdminShell";
import { confirmAction } from "@/components/feedback/confirm";

const th = "px-3 py-2 text-left text-xs font-medium text-muted-foreground";
const td = "px-3 py-2 align-top text-sm";
const table = "w-full min-w-[640px] border-collapse";
const wrap = "overflow-x-auto rounded-xl border";
const E: Record<string, string> = {
  forbidden_role: "No tenés permiso para esta acción.", not_pending: "Ese pago ya estaba resuelto.", invalid_request: "Revisá los datos: algo no está bien escrito.",
  already_suspended: "Ya estaba suspendido.", not_suspended: "No está suspendido.", not_published: "No está publicado.", days_required: "Para un plan pago hay que indicar cuántos días.",
  cannot_target_self: "No podés hacerlo sobre tu propia cuenta.", user_not_found: "Esa persona todavía no tiene cuenta: pedile que se registre primero.", is_owner: "No se puede cambiar a un Owner.",
  already_resolved: "Otra persona ya resolvió esta denuncia.", note_required: "Escribí la nota antes de guardarla.", business_gone: "El negocio ya no existe.", gratis_must_stay_free: "El plan gratuito tiene que seguir activo y costar $ 0.", invalid_plan: "Ese plan no sirve para esto.", network: "No pudimos conectarnos.",
};
export const msg = (e?: string) => E[e ?? ""] ?? "No se pudo completar la acción.";

/** Carga un recurso del admin y lo recarga con `reload()`. */
export function useLoad<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (path === null) return; // sin permiso o sin nada que pedir
    let alive = true;
    api<T>(path).then((r) => { if (!alive) return; if (r.ok) { setData(r.data); setError(null); } else setError(msg(r.data.error)); });
    return () => { alive = false; };
  }, [path, tick]);
  return { data, error, reload: () => setTick((n) => n + 1) };
}

// ───────────── Resumen ─────────────
interface Dash {
  finance?: boolean; kpis: Record<string, number>; byPlan: { plan: string; count: number }[]; byIndustry: { industry: string; count: number }[];
  signups: { day: string; count: number }[]; alerts: { pendingPayments: number; expiring7d: number; newReports: number; newContacts?: number; stalePayments: number; oldestPending: string | null };
}
interface Setup { id: string; label: string; hint: string; href: string; done: boolean }
/** «Primeros pasos» del equipo: lo que falta dejar listo para salir al aire. Se arma con el estado real y desaparece cuando todo está hecho. */
function SetupGuide() {
  const me = useAdmin();
  const pay = useLoad<{ alias: string; cbu: string }>(me.role === "owner" ? "/admin/settings/payment" : null);
  const demo = useLoad<{ missing: string[] }>(me.can("sistema") ? "/admin/system/demo" : null);
  const plans = useLoad<{ plans: { id: string; priceMonthly: number }[] }>(me.can("planes") ? "/admin/plans" : null);
  const items: Setup[] = [];
  if (me.role === "owner" && pay.data) items.push({ id: "pay", label: "Cargá tus datos de cobro", hint: "Es lo que ven tus clientes al pagar un plan por transferencia.", href: "/admin/planes", done: !!(pay.data.alias || pay.data.cbu) });
  if (plans.data) items.push({ id: "plans", label: "Poné el precio de los planes", hint: "Todavía hay planes pagos con precio de ejemplo o en $ 0.", href: "/admin/planes", done: plans.data.plans.filter((p) => p.id !== "gratis").every((p) => p.priceMonthly > 0) });
  if (demo.data) items.push({ id: "demo", label: "Creá los negocios de ejemplo", hint: "La landing los muestra como demos (demo-ropa, demo-eventos…).", href: "/admin/sistema", done: demo.data.missing.length === 0 });
  if (me.role === "owner") items.push({ id: "team", label: "Sumá a tu equipo", hint: "Invitá a Soporte o Admin con los permisos que quieras.", href: "/admin/admins", done: false });
  const todo = items.filter((i) => !i.done);
  if (todo.length === 0) return null;
  return (
    <section aria-labelledby="setup-title" className="rounded-2xl border-2 border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-5" data-testid="setup-guide">
      <h2 id="setup-title" className="font-bold">Primeros pasos</h2>
      <p className="mb-3 text-sm text-muted-foreground">Lo que falta para dejar MiShowo listo. Cada paso te lleva a la pantalla donde se hace.</p>
      <ol className="space-y-2">
        {todo.map((i, n) => (
          <li key={i.id}><Link href={i.href} className="flex min-h-11 items-center gap-3 rounded-xl bg-white px-4 py-2 hover:bg-[#F1F3F5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-[#FC5502] text-sm font-bold text-[#0E1B2C]">{n + 1}</span>
            <span className="flex-1"><span className="block font-semibold">{i.label}</span><span className="block text-xs text-muted-foreground">{i.hint}</span></span>
            <span aria-hidden className="text-muted-foreground">→</span>
          </Link></li>
        ))}
      </ol>
    </section>
  );
}

/** Muestra un valor del resumen («2743», «$ 326.700», «1.2%») subiendo desde cero. Si no tiene forma de número, lo deja igual. */
function Animated({ value }: { value: string }) {
  // «2743», «$ 326.700» (puntos de miles) o «1.2%» (decimal): se anima el número y se conserva el resto del texto.
  const thousands = /^(\D*?)(\d{1,3}(?:\.\d{3})+)(\D*)$/.exec(value);
  const plain = /^(\D*?)(\d+(?:\.\d+)?)(\D*)$/.exec(value);
  const m = thousands ?? plain;
  if (!m) return <>{value}</>;
  const raw = thousands ? m[2]!.replace(/\./g, "") : m[2]!;
  const n = Number(raw);
  if (!Number.isFinite(n)) return <>{value}</>;
  const decimals = !thousands && raw.includes(".") ? raw.split(".")[1]!.length : 0;
  return <>{m[1]}<CountUp value={Math.round(n * 10 ** decimals)} format={(x) => (decimals ? (x / 10 ** decimals).toFixed(decimals) : x.toLocaleString("es-AR"))} />{m[3]}</>;
}

export function Dashboard() {
  const { data: d, error } = useLoad<Dash>("/admin/dashboard");
  if (!d) return <><ErrorBox error={error} />{!error && <PanelSkeleton />}</>;
  const k = d.kpis, a = d.alerts;
  const finance = d.finance !== false; // Soporte no ve ingresos ni planes
  const groups: { title: string; tiles: [string, string][] }[] = [
    { title: "Negocios", tiles: [["Negocios", String(k.businesses)], ["Publicados", String(k.published)], ["Suspendidos", String(k.suspended)], ["Activos (pedidos en 7 días)", String(k.active7d)]] },
    { title: "Crecimiento", tiles: [["Nuevos hoy", String(k.newToday)], ["Nuevos esta semana", String(k.newWeek)], ["Nuevos este mes", String(k.newMonth)], ...(finance ? [["Conversión a pago", `${k.conversion}%`] as [string, string]] : [])] },
    ...(finance ? [{ title: "Ingresos", tiles: [["Con plan pago", String(k.paidActive)], ["Ingreso mensual estimado", Money(k.mrr)], ["Vencen en 7 días", String(k.expiring7d)], ["Bajas del mes", String(k.churn30d)]] as [string, string][] }] : []),
  ];
  const todo: { label: string; n: number; href?: string; tone: "alert" | "info" }[] = [
    { label: "Pagos para confirmar", n: a.pendingPayments, href: "/admin/pagos", tone: "info" },
    { label: "Pagos esperando hace más de 2 días", n: a.stalePayments, href: "/admin/pagos", tone: "alert" },
    { label: "Consultas sin responder", n: a.newContacts ?? 0, href: "/admin/consultas", tone: "info" },
    { label: "Denuncias nuevas", n: a.newReports, href: "/admin/denuncias", tone: "alert" },
    { label: "Planes por vencer en 7 días", n: a.expiring7d, tone: "info" },
  ];
  const pending = todo.filter((t) => t.n > 0);
  const max = Math.max(1, ...d.signups.map((s) => s.count));
  const topPlan = Math.max(1, ...d.byPlan.map((p) => p.count)), topInd = Math.max(1, ...d.byIndustry.map((p) => p.count));
  return (
    <div className="space-y-8">
      <PageHeader title="Resumen" />
      <SetupGuide />
      <section aria-labelledby="todo-title">
        <h2 id="todo-title" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Para atender</h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl bg-[#F1F3F5] p-5 text-sm font-medium">Todo al día: no hay pagos, consultas ni denuncias esperando.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Alertas">
            {pending.map((t) => {
              const body = (
                <>
                  <span className={`text-3xl font-extrabold tabular-nums ${t.tone === "alert" ? "text-destructive" : "text-[#C73E00]"}`}><CountUp value={t.n} /></span>
                  <span className="text-sm font-medium">{t.label}</span>
                  {t.href && <span aria-hidden className="ml-auto text-muted-foreground">→</span>}
                </>
              );
              const cls = `flex min-h-16 items-center gap-3 rounded-2xl border-2 px-4 py-3 ${t.tone === "alert" ? "border-destructive/40 bg-destructive/5" : "border-[#D1D5DB] bg-[#F9FAFB]"}`;
              return <li key={t.label}>{t.href ? <Link href={t.href} className={`${cls} transition-colors hover:bg-white`}>{body}</Link> : <div className={cls}>{body}</div>}</li>;
            })}
          </ul>
        )}
      </section>
      <div className="grid gap-4 lg:grid-cols-3" data-testid="kpis">
        {groups.map((g) => (
          <section key={g.title} aria-label={g.title} className="border-t border-[#E5E7EB] pt-4 lg:px-5 lg:first:pl-0 lg:[&:not(:first-child)]:border-l lg:border-t-0 lg:pt-0">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              {g.tiles.map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-2xl font-bold tabular-nums"><Animated value={value} /></dd></div>)}
            </dl>
          </section>
        ))}
      </div>
      <section aria-labelledby="altas" className="border-t border-[#E5E7EB] pt-5">
        <h2 id="altas" className="mb-3 font-semibold">Altas por día <span className="text-sm font-normal text-muted-foreground">(últimos 30 días)</span></h2>
        <div role="img" aria-label={`Altas por día: ${d.signups.map((s) => `${s.day} ${s.count}`).join(", ")}`} className="flex h-32 items-end gap-1">
          {d.signups.map((s, i) => <div key={s.day} title={`${s.day}: ${s.count}`} className="panel-grow flex-1 rounded-t bg-[#FC5502]" style={{ height: `${Math.max(3, (s.count / max) * 100)}%`, opacity: s.count ? 1 : 0.25, animationDelay: `${i * 18}ms` }} />)}
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        {([...(finance ? [["Por plan", d.byPlan.map((p) => [p.plan, p.count] as const), topPlan] as const] : []), ["Por rubro", d.byIndustry.map((p) => [p.industry, p.count] as const), topInd]] as const).map(([title, rows, top]) => (
          <section key={title} className="border-t border-[#E5E7EB] pt-5">
            <h2 className="mb-3 font-semibold">{title}</h2>
            <ul className="space-y-2.5 text-sm">
              {rows.map(([label, n]) => (
                <li key={label}>
                  <div className="flex justify-between"><span>{label}</span><span className="font-semibold tabular-nums">{n}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden><div className="h-full rounded-full bg-[#FC5502]" style={{ width: `${Math.max(3, (n / top) * 100)}%` }} /></div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

// ───────────── Pagos ─────────────
interface Pay { id: string; businessId: string; businessName: string; slug: string; ownerEmail: string; planId: string; months: number; amount: number; status: string; note: string | null; rejectReason: string | null; hasReceipt: boolean; createdAt: string }
export function Payments() {
  const me = useAdmin();
  const manage = me.can("pagos", "manage");
  const [status, setStatus] = useState("pendiente");
  const { data, error, reload } = useLoad<{ payments: Pay[] }>(`/admin/payments?status=${status}`);
  const [err, setErr] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, kind: "confirm" | "reject") {
    if (!(await confirmAction(kind === "confirm" ? { title: "¿Confirmar el pago?", message: "Se activa el plan y le llega un mail a la persona.", confirmLabel: "Confirmar pago" } : { title: "¿Rechazar el pago?", message: "Le avisamos con el motivo que escribiste.", confirmLabel: "Rechazar", danger: true }))) return;
    setBusy(id); setErr(null);
    const r = await api(`/admin/payments/${id}/${kind}`, { body: kind === "reject" ? { reason } : {} });
    setBusy(null);
    if (!r.ok) return setErr(msg(r.data.error));
    setRejecting(null); setReason(""); reload();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Pagos" />
        {manage && <Button variant="outline" onClick={() => setManual((v) => !v)} aria-expanded={manual}>Registrar un pago manual</Button>}
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
                <p className="font-semibold"><Link className="" href={`/admin/negocios/${p.businessId}`}>{p.businessName}</Link> · Plan {p.planId} · {p.months} {p.months === 1 ? "mes" : "meses"}</p>
                <p className="text-sm text-muted-foreground">{p.ownerEmail} · {when(p.createdAt)}</p>
              </div>
              <p className="text-xl font-bold tabular-nums">{Money(p.amount)}</p>
            </div>
            {p.note && <p className="mt-2 text-sm">Aclaración: {p.note}</p>}
            {p.rejectReason && <p className="mt-2 text-sm text-destructive">Motivo del rechazo: {p.rejectReason}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {p.hasReceipt ? <a className="rounded-md border px-3 py-1.5 text-sm" href={`${API_URL}/admin/payments/${p.id}/receipt`} target="_blank" rel="noopener noreferrer">Ver comprobante</a> : <span className="text-sm text-muted-foreground">Sin comprobante</span>}
              {manage && p.status === "pendiente" && (rejecting === p.id ? (
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
      <PageHeader title="Negocios" />
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
                <td className={td}><Link href={`/admin/negocios/${b.id}`} className="font-medium ">{b.name}</Link><div className="text-xs text-muted-foreground">{b.slug}</div></td>
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

// ───────────── Usuarios ─────────────
interface Usr { id: string; email: string; name: string | null; role: string; emailVerifiedAt: string | null; blockedAt: string | null; lastLoginAt: string | null; createdAt: string }
const USER_FILTERS = [{ id: "all", label: "Todas" }, { id: "clients", label: "Clientes" }, { id: "team", label: "Equipo" }, { id: "unverified", label: "Sin verificar" }, { id: "blocked", label: "Bloqueadas" }] as const;
const ROLE_BADGE: Record<string, string> = { owner: "Owner", admin: "Admin", support: "Soporte", user: "Cliente" };
export function Users() {
  const me = useAdmin();
  const [q, setQ] = useState(""), [page, setPage] = useState(1), [filter, setFilter] = useState<(typeof USER_FILTERS)[number]["id"]>("all");
  const { data, error, reload } = useLoad<{ users: Usr[]; total: number; pageSize: number }>(`/admin/users?page=${page}&filter=${filter}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const [err, setErr] = useState<string | null>(null);
  async function toggle(u: Usr) {
    if (!(await confirmAction(u.blockedAt ? { title: "¿Desbloquear la cuenta?", message: `${u.email} vuelve a poder ingresar.`, confirmLabel: "Desbloquear" } : { title: "¿Bloquear la cuenta?", message: `${u.email} queda sin acceso y se le cierran todas las sesiones.`, confirmLabel: "Bloquear", danger: true }))) return;
    setErr(null);
    const r = await api(`/admin/users/${u.id}/${u.blockedAt ? "unblock" : "block"}`, { body: {} });
    if (!r.ok) return setErr(msg(r.data.error));
    reload();
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Cuentas" />
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Buscar">{(id) => <TextInput id={id} type="search" placeholder="Email o nombre" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="w-64" />}</Field>
        <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-2">
          {USER_FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => { setFilter(f.id); setPage(1); }}
              className={`min-h-11 rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${filter === f.id ? "border-[#C73E00] bg-[#FC5502] text-[#0E1B2C]" : "bg-white hover:bg-[#F1F3F5]"}`}>{f.label}</button>
          ))}
        </div>
        {me.role === "owner" && <Link href="/admin/admins" className="ml-auto text-sm font-semibold text-[#C73E00]">Gestionar el equipo y sus permisos →</Link>}
      </div>
      <ErrorBox error={error ?? err} />
      <div className={wrap}>
        <table className={table}>
          <caption className="sr-only">Cuentas</caption>
          <thead className="bg-muted/50"><tr>{["Email", "Rol", "Email verificado", "Último ingreso", "Estado", ""].map((h, i) => <th key={i} scope="col" className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {data?.users.map((u) => (
              <tr key={u.id} className="border-t" data-testid="admin-user">
                <td className={td}>{u.email}{u.name && <div className="text-xs text-muted-foreground">{u.name}</div>}</td><td className={td}><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.role === "user" ? "bg-muted" : "bg-[#F1F3F5] text-[#C73E00]"}`}>{ROLE_BADGE[u.role] ?? u.role}</span></td>
                <td className={td}>{u.emailVerifiedAt ? "Sí" : "No"}</td><td className={td}>{when(u.lastLoginAt)}</td><td className={td}>{u.blockedAt ? <span className="text-destructive">Bloqueado</span> : "Activo"}</td>
                <td className={td}>{me.can("usuarios", "manage") && u.id !== me.id && <Button size="sm" variant="outline" onClick={() => void toggle(u)}>{u.blockedAt ? "Desbloquear" : "Bloquear"}</Button>}</td>
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
interface ModuleDef { key: string; label: string; description: string }
interface PlanRow { id: string; name: string; priceMonthly: number; limits: { products: number | null; photosPerProduct: number; whatsappNumbers: number; uploadMb: number; coupons?: number | null }; modules: Record<string, boolean>; features: string[]; active: boolean }
function PlanEditor({ plan, modules, onSaved, canEdit }: { plan: PlanRow; modules: ModuleDef[]; onSaved: () => void; canEdit: boolean }) {
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
        limits: {
          products: prod === "" ? null : Number(prod), photosPerProduct: Number(f.get("photos")), whatsappNumbers: Number(f.get("wa")), uploadMb: Number(f.get("mb")),
          coupons: String(f.get("coupons")).trim() === "" ? null : Number(f.get("coupons")),
          modules: Object.fromEntries(modules.map((m) => [m.key, f.get(`mod_${m.key}`) === "on"])),
        },
        features: String(f.get("features")).split("\n").map((x) => x.trim()).filter(Boolean),
      } });
      if (r.ok) { setErr(null); setOk(true); onSaved(); } else { setOk(false); setErr(msg(r.data.error)); }
    }}>
      <fieldset disabled={!canEdit} className="contents">
      <h3 className="font-semibold sm:col-span-3">{plan.name} <span className="text-xs font-normal text-muted-foreground">({plan.id})</span></h3>
      <Field label="Nombre">{(id) => <TextInput id={id} name="name" defaultValue={plan.name} required />}</Field>
      <Field label="Precio por mes, por página ($)">{(id) => <TextInput id={id} name="price" type="number" min={0} step="0.01" defaultValue={plan.priceMonthly} required />}</Field>
      <Field label="Productos máx." hint="Vacío = ilimitados">{(id, d) => <TextInput id={id} aria-describedby={d} name="products" type="number" min={1} defaultValue={plan.limits.products ?? ""} />}</Field>
      <Field label="Fotos por producto">{(id) => <TextInput id={id} name="photos" type="number" min={0} defaultValue={plan.limits.photosPerProduct} required />}</Field>
      <Field label="WhatsApp">{(id) => <TextInput id={id} name="wa" type="number" min={1} defaultValue={plan.limits.whatsappNumbers} required />}</Field>
      <Field label="Subida máx. (MB)">{(id) => <TextInput id={id} name="mb" type="number" min={1} defaultValue={plan.limits.uploadMb} required />}</Field>
      <Field label="Cupones máx." hint="Vacío = ilimitados">{(id, d) => <TextInput id={id} aria-describedby={d} name="coupons" type="number" min={0} defaultValue={plan.limits.coupons === undefined ? 3 : (plan.limits.coupons ?? "")} />}</Field>
      <fieldset className="sm:col-span-3 rounded-lg border p-3" data-testid="plan-modules">
        <legend className="px-1 text-sm font-semibold">Módulos habilitados en este plan</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {modules.map((m) => (
            <label key={m.key} className="flex items-start gap-2.5 rounded-md p-2 text-sm hover:bg-muted/50">
              <input type="checkbox" name={`mod_${m.key}`} defaultChecked={plan.modules[m.key] === true} className="mt-1 size-4" />
              <span><span className="font-medium">{m.label}</span><span className="block text-xs text-muted-foreground">{m.description}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2"><Field label="Beneficios (uno por línea)">{(id) => <TextArea id={id} name="features" rows={4} defaultValue={plan.features.join("\n")} />}</Field></div>
      <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="active" defaultChecked={plan.active} disabled={free} /> Activo (se muestra y se puede contratar)</label>
      <div className="sm:col-span-3"><ErrorBox error={err} />{ok && <p role="status" className="mb-2 text-sm">Guardado. Ya se ve en la landing y en los avisos de pago.</p>}{canEdit ? <Button type="submit" size="sm">Guardar {plan.name}</Button> : <p className="text-sm text-muted-foreground">Con tus permisos podés ver los planes, no editarlos.</p>}</div>
      </fieldset>
    </form>
  );
}

export function Plans() {
  const me = useAdmin();
  const { data, error, reload } = useLoad<{ plans: PlanRow[]; modules: ModuleDef[] }>("/admin/plans");
  return (
    <div className="space-y-6">
      <PageHeader title="Planes y precios" />
      <p className="max-w-[60ch] text-muted-foreground">Los precios y límites que cargues acá se aplican enseguida: en la landing, en los avisos de pago y en los límites de cada negocio.</p>
      <ErrorBox error={error} />
      {data?.plans.map((p) => <PlanEditor key={p.id} plan={p} modules={data.modules} onSaved={reload} canEdit={me.can("planes", "manage")} />)}
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
      <PageHeader title="Auditoría" />
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
