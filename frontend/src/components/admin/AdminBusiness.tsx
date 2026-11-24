"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/fields";
import { api } from "@/lib/authClient";
import { siteUrl } from "@/lib/siteUrl";
import { confirmAction } from "@/components/feedback/confirm";
import { CountUp, PanelSkeleton } from "@/components/feedback/CountUp";
import { ErrorBox, Money, useAdmin, when } from "./AdminShell";
import { msg, useLoad } from "./AdminPages";

interface Note { id: string; body: string; pinned: boolean; createdAt: string; author: { id: string; email: string | null; name: string | null } | null }
interface Detail {
  business: { id: string; slug: string; name: string; status: string; planId: string; planExpiresAt: string | null; createdAt: string; publishedAt?: string | null; updatedAt?: string };
  view: { design: { layout?: string; theme?: string; fontPair?: string } | null; whatsappSet: boolean; instagramSet: boolean; addressSet: boolean; openDays: number; announcement: string; categories: number; available_products: number; media: number; open_reports: number; last_order_at: string | null };
  owner: { id: string; email: string; name: string | null; lastName: string | null; phone: string | null; blockedAt: string | null; emailVerifiedAt: string | null; lastLoginAt: string | null; createdAt: string };
  contact: { whatsapp: string | null; instagram: string | null; address: string | null; industry: string };
  counts: { products: number; orders: number };
  activity: { visits30: number; whatsapp30: number; orders30: number; orders_total: number };
  notes: Note[];
  payments: { id: string; planId: string; months: number; amount: number; status: string; createdAt: string }[];
  history: { id: number; action: string; createdAt: string; actorEmail: string | null; actorName: string | null }[];
}

/** Nombres en castellano para el registro de movimientos (lo que no figure se muestra como viene). */
const ACTION: Record<string, string> = {
  "business.suspend": "Suspendió el negocio", "business.reactivate": "Reactivó el negocio", "business.unpublish": "Despublicó la página", "business.plan": "Cambió el plan",
  "business.note": "Editó la nota interna", "business.note_add": "Dejó una nota interna", "business.note_delete": "Borró una nota interna", "business.delete": "Eliminó el negocio",
  "payment.confirm": "Confirmó un pago", "payment.reject": "Rechazó un pago", "payment.manual": "Registró un pago manual",
};
const STATUS: Record<string, { label: string; cls: string }> = {
  published: { label: "Publicado", cls: "bg-emerald-100 text-emerald-900" }, draft: { label: "Borrador", cls: "bg-gray-100 text-gray-800" }, suspended: { label: "Suspendido", cls: "bg-rose-100 text-rose-900" },
};
const initialOf = (s: string) => (s.trim().match(/[\p{L}\p{N}]/u)?.[0] ?? "•").toUpperCase();
const fullName = (o: Detail["owner"]) => [o.name, o.lastName].filter(Boolean).join(" ") || "Sin nombre";
const who = (a: Note["author"]) => (a ? ([a.name, a.email].filter(Boolean).join(" · ") || "Cuenta eliminada") : "Nota anterior (sin autor registrado)");
const ago = (iso: string | null) => {
  if (!iso) return "Nunca";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "Hoy" : d === 1 ? "Ayer" : `Hace ${d} días`;
};
const card = "rounded-2xl border bg-white p-5";

function Tile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return <div className="rounded-xl border bg-white p-4"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-2xl font-extrabold tabular-nums">{value}</dd>{hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}</div>;
}

/** Avance de armado de la página: cuántos de los pasos clave ya hizo (sirve para saber a quién ayudar). */
function Completeness({ d }: { d: Detail }) {
  const steps: [string, boolean][] = [
    ["Tiene productos disponibles", d.view.available_products > 0], ["Cargó su WhatsApp", d.view.whatsappSet], ["Cargó sus horarios", d.view.openDays > 0],
    ["Cargó su dirección o zona", d.view.addressSet], ["Cargó su Instagram", d.view.instagramSet], ["Subió fotos o logo", d.view.media > 0], ["Está publicada", d.business.status === "published"],
  ];
  const done = steps.filter(([, ok]) => ok).length;
  return (
    <section aria-labelledby="comp-title" className={card} data-testid="business-view">
      <div className="mb-3 flex items-baseline justify-between"><h2 id="comp-title" className="font-semibold">Cómo está armada su página</h2><span className="text-sm font-bold">{done} de {steps.length}</span></div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={steps.length} aria-label="Avance de la página">
        <div className="h-full rounded-full bg-[#FC5502] transition-[width] duration-700" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {steps.map(([t, ok]) => <li key={t} className="flex items-center gap-2"><span aria-hidden className={`grid size-5 place-items-center rounded-full text-xs font-bold ${ok ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"}`}>{ok ? "✓" : "–"}</span><span className={ok ? "" : "text-muted-foreground"}>{t}<span className="sr-only">{ok ? " (hecho)" : " (falta)"}</span></span></li>)}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">Diseño {d.view.design?.layout ?? "—"} · tema {d.view.design?.theme ?? "—"} · {d.view.categories} categorías{d.view.open_reports > 0 && <> · <strong className="text-destructive">{d.view.open_reports} denuncia(s) sin resolver</strong></>}</p>
      {d.view.announcement && <p className="mt-1 text-sm">Anuncio: “{d.view.announcement}”</p>}
    </section>
  );
}

/** Notas internas: se agregan, se fijan y quedan con quién las dejó y cuándo. Solo las ve el equipo. */
function Notes({ id, notes, me, reload }: { id: string; notes: Note[]; me: { id: string; role: string }; reload: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const r = await api(`/admin/businesses/${id}/notes`, { body: { body: text.trim() }, toastText: "Nota guardada." });
    setBusy(false);
    if (r.ok) { setText(""); reload(); }
  }
  async function pin(n: Note) { const r = await api(`/admin/businesses/${id}/notes/${n.id}`, { method: "PATCH", body: { pinned: !n.pinned }, toastText: n.pinned ? "Nota desfijada." : "Nota fijada arriba." }); if (r.ok) reload(); }
  async function remove(n: Note) {
    if (!(await confirmAction({ title: "¿Borrar la nota?", message: "Queda el registro de que se borró, pero el texto ya no se ve acá.", confirmLabel: "Borrar nota", danger: true }))) return;
    const r = await api(`/admin/businesses/${id}/notes/${n.id}`, { method: "DELETE", toastText: "Nota borrada." });
    if (r.ok) reload();
  }
  return (
    <section aria-labelledby="notes-title" className={card} data-testid="business-notes">
      <h2 id="notes-title" className="font-semibold">Notas internas</h2>
      <p className="mb-3 text-xs text-muted-foreground">Solo las ve el equipo de MiShowo. Cada nota guarda quién la dejó y cuándo.</p>
      <form onSubmit={add} className="space-y-2">
        <TextArea aria-label="Nueva nota interna" rows={3} maxLength={2000} placeholder="Ej: Me escribió por WhatsApp, quiere pasar a Pro después del 15." value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" size="sm" disabled={busy || !text.trim()}>Agregar nota</Button>
      </form>
      {notes.length === 0 ? <p className="mt-4 rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Todavía no hay notas. La primera que dejes queda con tu nombre.</p> : (
        <ul className="mt-4 space-y-3" data-testid="notes-list">
          {notes.map((n) => (
            <li key={n.id} className={`rounded-xl border p-3 ${n.pinned ? "border-gray-400 bg-gray-50" : ""}`} data-testid="business-note">
              <p className="whitespace-pre-wrap break-words text-sm">{n.body}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{n.pinned && <strong className="mr-1.5 text-foreground">Fijada ·</strong>}<span data-testid="note-author">{who(n.author)}</span> · {when(n.createdAt)}</span>
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => void pin(n)}>{n.pinned ? "Desfijar" : "Fijar"}</Button>
                  {(n.author?.id === me.id || me.role === "owner") && <Button size="sm" variant="ghost" onClick={() => void remove(n)}>Borrar</Button>}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function BusinessDetail({ id }: { id: string }) {
  const me = useAdmin();
  const { data, error, reload } = useLoad<Detail>(`/admin/businesses/${id}`);
  const [err, setErr] = useState<string | null>(null);
  const [days, setDays] = useState(30), [planId, setPlanId] = useState("emprende");
  const manage = me.can("negocios", "manage");
  const canPlan = me.can("planes", "manage");
  if (!data) return <><ErrorBox error={error} />{!error && <PanelSkeleton />}</>;
  const b = data.business, o = data.owner, a = data.activity;
  const st = STATUS[b.status] ?? { label: b.status, cls: "bg-gray-100 text-gray-800" };

  async function act(path: string, method: "POST" | "PUT" | "DELETE" = "POST", body: object = {}) {
    const ask: Record<string, { title: string; message: string; label: string; danger?: boolean }> = {
      "/suspend": { title: "¿Suspender este negocio?", message: "La página y el panel dejan de funcionar hasta que lo reactives.", label: "Suspender", danger: true },
      "/unpublish": { title: "¿Despublicar la página?", message: "Deja de verse al instante.", label: "Despublicar", danger: true },
      "/plan": { title: "¿Cambiar el plan de esta página?", message: "Se aplica ahora mismo y queda en Auditoría.", label: "Aplicar plan" },
    };
    const q = method === "DELETE" ? { title: "¿Eliminar este negocio?", message: "No se puede deshacer.", label: "Eliminar", danger: true } : ask[path];
    if (q && !(await confirmAction({ title: q.title, message: q.message, confirmLabel: q.label, ...(q.danger ? { danger: true } : {}) }))) return;
    setErr(null);
    const r = await api(`/admin/businesses/${id}${path}`, { method, body: method === "DELETE" ? undefined : body });
    if (!r.ok) return setErr(msg(r.data.error));
    reload();
  }
  const waPhone = o.phone ? `https://wa.me/${o.phone}` : null;

  return (
    <div className="space-y-6">
      <Link href="/admin/negocios" className="text-sm font-semibold text-[#C73E00]">← Negocios</Link>

      <header className={`${card} flex flex-wrap items-center gap-4`}>
        <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[#1F2937] text-3xl font-extrabold text-white">{initialOf(b.name)}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight">{b.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${st.cls}`}>{st.label}</span>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-800">Plan {b.planId}{b.planExpiresAt ? ` hasta ${when(b.planExpiresAt)}` : ""}</span>
            <span>{data.contact.industry}</span>
            <code className="text-xs">{b.slug}</code>
          </p>
        </div>
        {b.status === "published" && <a className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold hover:bg-gray-50" href={siteUrl(b.slug)} target="_blank" rel="noopener noreferrer">Ver la página publicada</a>}
      </header>
      <ErrorBox error={err} />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="business-kpis">
        <Tile label="Visitas (30 días)" value={<CountUp value={a.visits30} />} />
        <Tile label="Clics a WhatsApp (30 días)" value={<CountUp value={a.whatsapp30} />} hint={a.visits30 > 0 ? `${((a.whatsapp30 / a.visits30) * 100).toFixed(1)}% de las visitas` : undefined} />
        <Tile label="Pedidos (30 días)" value={<CountUp value={a.orders30} />} hint={`${data.counts.orders} en total`} />
        <Tile label="Vendido por la página" value={<CountUp value={Math.round(a.orders_total)} format={(n) => Money(n)} />} hint="Pedidos no cancelados" />
        <Tile label="Productos" value={<CountUp value={data.counts.products} />} hint={`${data.view.available_products} disponibles`} />
      </dl>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section aria-labelledby="owner-title" className={card} data-testid="business-owner">
            <h2 id="owner-title" className="mb-3 font-semibold">Dueño y contacto</h2>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">Nombre</dt><dd className="font-medium">{fullName(o)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="break-all font-medium">{o.email}{!o.emailVerifiedAt && <span className="ml-1.5 rounded bg-amber-100 px-1.5 text-xs text-amber-900">sin confirmar</span>}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Teléfono</dt><dd className="font-medium">{o.phone ? <>{o.phone} {waPhone && <a className="ml-1 text-xs font-semibold text-[#C73E00]" href={waPhone} target="_blank" rel="noopener noreferrer">Escribirle</a>}</> : "No cargado"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">WhatsApp del negocio</dt><dd className="font-medium">{data.contact.whatsapp || "No cargado"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Instagram</dt><dd className="font-medium">{data.contact.instagram || "No cargado"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Dirección</dt><dd className="font-medium">{data.contact.address || "No cargada"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Se registró</dt><dd className="font-medium">{when(o.createdAt)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Último ingreso</dt><dd className="font-medium">{ago(o.lastLoginAt)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Último pedido recibido</dt><dd className="font-medium">{ago(data.view.last_order_at)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Página creada</dt><dd className="font-medium">{when(b.createdAt)}</dd></div>
            </dl>
            {o.blockedAt && <p className="mt-3 rounded-lg bg-destructive/10 p-2 text-sm text-destructive">La cuenta del dueño está bloqueada.</p>}
          </section>
          <Completeness d={data} />
          <section aria-labelledby="pay-title" className={card}>
            <h2 id="pay-title" className="mb-3 font-semibold">Pagos</h2>
            {data.payments.length === 0 ? <p className="text-sm text-muted-foreground">Sin pagos todavía.</p> : (
              <ul className="divide-y text-sm">{data.payments.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><strong>{p.planId}</strong> · {p.months} {p.months === 1 ? "mes" : "meses"} · {Money(p.amount)}</span><span className="text-muted-foreground">{p.status} · {when(p.createdAt)}</span></li>)}</ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <Notes id={id} notes={data.notes} me={me} reload={reload} />
          {manage ? (
            <section className={`${card} space-y-4`} aria-labelledby="acc-title"><h2 id="acc-title" className="font-semibold">Acciones</h2>
              <div className="flex flex-wrap gap-2">
                {b.status !== "suspended" ? <Button size="sm" variant="outline" onClick={() => void act("/suspend")}>Suspender</Button> : <Button size="sm" onClick={() => void act("/reactivate")}>Reactivar</Button>}
                {b.status === "published" && <Button size="sm" variant="outline" onClick={() => void act("/unpublish")}>Despublicar</Button>}
                <Button size="sm" variant="ghost" onClick={() => void act("", "DELETE")}>Eliminar negocio</Button>
              </div>
              {canPlan && <div className="flex flex-wrap items-end gap-2">
                <Field label="Cambiar plan">{(i) => <Select id={i} value={planId} onChange={(e) => setPlanId(e.target.value)}><option value="emprende">Emprende</option><option value="pro">Pro</option><option value="gratis">Gratis</option></Select>}</Field>
                <Field label="Días">{(i) => <TextInput id={i} type="number" min={1} max={3650} value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-24" />}</Field>
                <Button size="sm" variant="outline" onClick={() => void act("/plan", "POST", { planId, ...(planId !== "gratis" ? { days } : {}) })}>Aplicar plan</Button>
              </div>}
            </section>
          ) : <p className="text-sm text-muted-foreground">Tus permisos te dejan ver y dejar notas, no moderar este negocio.</p>}
          <section aria-labelledby="hist-title" className={card}>
            <h2 id="hist-title" className="mb-3 font-semibold">Registro de movimientos</h2>
            {data.history.length === 0 ? <p className="text-sm text-muted-foreground">Sin movimientos.</p> : (
              <ol className="relative space-y-3 border-l border-gray-200 pl-4 text-sm">
                {data.history.map((h) => <li key={h.id}><span aria-hidden className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-[#FC5502]" /><p className="font-medium">{ACTION[h.action] ?? h.action}</p><p className="text-xs text-muted-foreground">{h.actorEmail ? `${h.actorName || h.actorEmail} · ` : "Sistema · "}{when(h.createdAt)}</p></li>)}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
