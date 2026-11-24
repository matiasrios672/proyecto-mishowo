"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CountUp, PanelSkeleton } from "@/components/feedback/CountUp";
import { toast } from "@/components/feedback/toastStore";
import { ErrorBox, Money, PageHeader } from "./AdminShell";
import { useLoad } from "./AdminPages";

interface Stats {
  days: number; finance: boolean;
  totals: { signups: number; signups_prev: number; published: number; published_prev: number; visits: number; visits_prev: number; orders: number; orders_prev: number };
  funnel: { key: string; label: string; count: number }[];
  channels: { source: string; signups: number; verified: number; published: number; paid: number | null; revenue: number | null }[];
  daily: { day: string; signups: number; published: number; visits: number; whatsapp: number; orders: number }[];
  revenue: { revenue: number; revenue_prev: number; payments: number; pending: number; rejected: number; paid_active: number; mrr: number; expiring7: number; churned: number } | null;
  byPlan: { plan: string; payments: number; revenue: number }[];
  activity: { visits: number; visitors: number; product_views: number; whatsapp: number; orders: number; orders_total: number; appointments: number; pages_with_visits: number; pages_published: number };
  topPages: { id: string; name: string; slug: string; industry: string; plan: string; visits: number; whatsapp: number; orders: number }[];
  industries: { industry: string; pages: number; newPublished: number; visits: number; orders: number }[];
  visitSources: { source: string; visits: number }[];
  accounts: { active7: number; active30: number; total: number; referred: number };
  campaigns: { sent: number; recipients: number };
}

const PERIODS = [{ d: 7, label: "7 días" }, { d: 30, label: "30 días" }, { d: 90, label: "90 días" }, { d: 365, label: "1 año" }];
const SERIES = [
  { key: "visits", label: "Visitas a las páginas", color: "#1F2937" }, { key: "signups", label: "Registros", color: "#FC5502" },
  { key: "published", label: "Publicaciones", color: "#15803D" }, { key: "orders", label: "Pedidos", color: "#6D28D9" }, { key: "whatsapp", label: "Clics a WhatsApp", color: "#0E7490" },
] as const;
type SeriesKey = (typeof SERIES)[number]["key"];

const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(a / b >= 0.1 ? 0 : 1)}%` : "—");
const card = "rounded-2xl border bg-white p-5";

/** Variación contra el período anterior: flecha, porcentaje y un texto para lectores de pantalla. */
function Delta({ now, prev }: { now: number; prev: number }) {
  if (prev === 0 && now === 0) return <span className="text-xs text-muted-foreground">Sin movimiento</span>;
  if (prev === 0) return <span className="text-xs font-semibold text-emerald-700">Nuevo (antes 0)</span>;
  const p = ((now - prev) / prev) * 100;
  const up = p >= 0;
  return <span className={`text-xs font-semibold ${up ? "text-emerald-700" : "text-rose-700"}`}><span aria-hidden>{up ? "▲" : "▼"}</span> {Math.abs(p).toFixed(0)}% <span className="font-normal text-muted-foreground">vs. período anterior ({prev.toLocaleString("es-AR")})</span><span className="sr-only">{up ? " subió" : " bajó"}</span></span>;
}

function Kpi({ label, value, now, prev, format }: { label: string; value: number; now?: number; prev?: number; format?: (n: number) => string }) {
  return (
    <div className="rounded-xl border bg-white p-4"><dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-3xl font-extrabold tabular-nums"><CountUp value={value} {...(format ? { format } : {})} /></dd>
      {now !== undefined && prev !== undefined && <p className="mt-1"><Delta now={now} prev={prev} /></p>}
    </div>
  );
}

/** Embudo: cada barra es un paso, con el % que pasó desde el paso anterior y el % acumulado sobre los registros. */
function Funnel({ steps }: { steps: Stats["funnel"] }) {
  const top = Math.max(1, steps[0]?.count ?? 1);
  return (
    <ol className="space-y-3" data-testid="funnel">
      {steps.map((st, i) => {
        const prev = i === 0 ? null : steps[i - 1]!.count;
        return (
          <li key={st.key}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm"><span className="font-semibold">{st.label}</span>
              <span className="tabular-nums"><strong className="text-lg">{st.count.toLocaleString("es-AR")}</strong>
                {prev !== null && <span className="ml-2 text-xs text-muted-foreground">{pct(st.count, prev)} del paso anterior · {pct(st.count, top)} del total</span>}</span></div>
            <div className="mt-1 h-3 overflow-hidden rounded-full bg-gray-100" role="presentation"><div className="h-full rounded-full bg-[#FC5502] transition-[width] duration-700" style={{ width: `${Math.max(st.count > 0 ? 2 : 0, (st.count / top) * 100)}%`, opacity: 1 - i * 0.1 }} /></div>
          </li>
        );
      })}
    </ol>
  );
}

/** Serie diaria en SVG: una línea por métrica elegida, con la tabla accesible debajo. */
function Trend({ daily }: { daily: Stats["daily"] }) {
  const [on, setOn] = useState<Record<SeriesKey, boolean>>({ visits: true, signups: true, published: false, orders: false, whatsapp: false });
  const active = SERIES.filter((s) => on[s.key]);
  const W = 720, H = 220, pad = 8;
  const max = Math.max(1, ...active.flatMap((s) => daily.map((d) => d[s.key])));
  const x = (i: number) => pad + (i / Math.max(1, daily.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  return (
    <div>
      <div role="group" aria-label="Qué mostrar en el gráfico" className="mb-3 flex flex-wrap gap-2">
        {SERIES.map((s) => (
          <button key={s.key} type="button" aria-pressed={on[s.key]} onClick={() => setOn((p) => ({ ...p, [s.key]: !p[s.key] }))}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold ${on[s.key] ? "border-gray-800 bg-gray-800 text-white" : "bg-white hover:bg-gray-50"}`}>
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: s.color }} />{s.label}</button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full" role="img" aria-label={`Evolución diaria de ${active.map((s) => s.label).join(", ") || "nada seleccionado"}. Máximo ${max}.`}>
        {[0, 0.5, 1].map((g) => <line key={g} x1={pad} x2={W - pad} y1={y(max * g)} y2={y(max * g)} stroke="#E5E7EB" strokeDasharray="4 4" />)}
        {active.map((s) => <polyline key={s.key} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" points={daily.map((d, i) => `${x(i)},${y(d[s.key])}`).join(" ")} />)}
      </svg>
      <p className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{daily[0]?.day}</span><span>Pico: {max.toLocaleString("es-AR")}</span><span>{daily.at(-1)?.day}</span></p>
    </div>
  );
}

function exportChannels(rows: Stats["channels"], finance: boolean) {
  const head = ["canal", "registros", "confirmados", "publicaron", ...(finance ? ["pagaron", "ingresos"] : []), "conversion_a_publicacion"];
  const lines = rows.map((r) => [r.source, r.signups, r.verified, r.published, ...(finance ? [r.paid ?? 0, r.revenue ?? 0] : []), r.signups ? ((r.published / r.signups) * 100).toFixed(1) + "%" : ""]
    .map((v) => { let t = String(v); if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; return `"${t.replace(/"/g, '""')}"`; }).join(","));
  const blob = new Blob([`﻿${[head.join(","), ...lines].join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "canales-mishowo.csv"; a.click();
  URL.revokeObjectURL(a.href);
  toast.success("Descargamos los canales en CSV.");
}

export function Estadisticas() {
  const [days, setDays] = useState(30);
  const { data: d, error } = useLoad<Stats>(`/admin/stats?days=${days}`);
  return (
    <div className="space-y-8">
      <PageHeader title="Estadísticas">
        <div role="group" aria-label="Período" className="flex flex-wrap gap-2 pt-1">
          {PERIODS.map((p) => (
            <button key={p.d} type="button" aria-pressed={days === p.d} onClick={() => setDays(p.d)}
              className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${days === p.d ? "border-gray-800 bg-gray-800 text-white" : "bg-white hover:bg-gray-50"}`}>Últimos {p.label}</button>
          ))}
        </div>
      </PageHeader>
      <ErrorBox error={error} />
      {!d && !error && <PanelSkeleton />}
      {d && (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="stats-kpis">
            <Kpi label="Registros nuevos" value={d.totals.signups} now={d.totals.signups} prev={d.totals.signups_prev} />
            <Kpi label="Páginas publicadas" value={d.totals.published} now={d.totals.published} prev={d.totals.published_prev} />
            <Kpi label="Visitas a las páginas" value={d.totals.visits} now={d.totals.visits} prev={d.totals.visits_prev} />
            <Kpi label="Pedidos recibidos" value={d.totals.orders} now={d.totals.orders} prev={d.totals.orders_prev} />
            {d.revenue && <Kpi label="Ingresos confirmados" value={Math.round(d.revenue.revenue)} now={d.revenue.revenue} prev={d.revenue.revenue_prev} format={(n) => Money(n)} />}
            {d.revenue && <Kpi label="Ingreso mensual recurrente" value={Math.round(d.revenue.mrr)} format={(n) => Money(n)} />}
            <Kpi label="Cuentas activas (7 días)" value={d.accounts.active7} />
            <Kpi label="Registros por invitación" value={d.accounts.referred} />
          </dl>

          <section aria-labelledby="funnel-title" className={card}>
            <h2 id="funnel-title" className="text-lg font-bold">Embudo de conversión</h2>
            <p className="mb-4 text-sm text-muted-foreground">De las personas que se registraron en este período, cuántas llegaron a cada paso. Ayuda a ver dónde se caen.</p>
            <Funnel steps={d.funnel} />
          </section>

          <section aria-labelledby="trend-title" className={card}>
            <h2 id="trend-title" className="mb-3 text-lg font-bold">Evolución día por día</h2>
            <Trend daily={d.daily} />
          </section>

          <section aria-labelledby="chan-title" className={card} data-testid="channels">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><h2 id="chan-title" className="text-lg font-bold">Canales de adquisición</h2>
              <Button size="sm" variant="outline" onClick={() => exportChannels(d.channels, d.finance)}>Descargar CSV</Button></div>
            <p className="mb-3 text-sm text-muted-foreground">De dónde llegaron los registros (el <code>utm_source</code> del link, el sitio de origen, «referido» o directo). Armá tus links con <code>?utm_source=instagram</code> para medir cada campaña.</p>
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><caption className="sr-only">Canales de adquisición</caption>
              <thead><tr>{["Canal", "Registros", "Confirmaron", "Publicaron", ...(d.finance ? ["Pagaron", "Ingresos"] : []), "Registro → publicación"].map((h, i) => <th key={h} scope="col" className={`px-3 py-2 text-xs font-medium text-muted-foreground ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>)}</tr></thead>
              <tbody>{d.channels.map((c) => (
                <tr key={c.source} className="border-t"><th scope="row" className="px-3 py-2 text-left font-semibold">{c.source}</th>
                  <td className="px-3 py-2 text-right tabular-nums">{c.signups}</td><td className="px-3 py-2 text-right tabular-nums">{c.verified}</td><td className="px-3 py-2 text-right tabular-nums">{c.published}</td>
                  {d.finance && <><td className="px-3 py-2 text-right tabular-nums">{c.paid}</td><td className="px-3 py-2 text-right tabular-nums">{Money(c.revenue ?? 0)}</td></>}
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{pct(c.published, c.signups)}</td></tr>
              ))}{d.channels.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Todavía no hay registros en este período.</td></tr>}</tbody></table></div>
          </section>

          {d.revenue && (
            <section aria-labelledby="rev-title" className={card} data-testid="revenue">
              <h2 id="rev-title" className="mb-3 text-lg font-bold">Ingresos y planes</h2>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
                {([["Pagos confirmados", d.revenue.payments], ["Ticket promedio", d.revenue.payments ? Money(d.revenue.revenue / d.revenue.payments) : "—"], ["Pagos por confirmar", d.revenue.pending], ["Rechazados", d.revenue.rejected], ["Páginas con plan pago", d.revenue.paid_active], ["Vencen en 7 días", d.revenue.expiring7], ["Volvieron a gratis", d.revenue.churned]] as const).map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-xl font-bold tabular-nums">{v}</dd></div>)}
              </dl>
              {d.byPlan.length > 0 && <ul className="mt-4 divide-y text-sm">{d.byPlan.map((p) => <li key={p.plan} className="flex justify-between py-2"><span className="font-semibold">{p.plan}</span><span>{p.payments} {p.payments === 1 ? "pago" : "pagos"} · {Money(p.revenue)}</span></li>)}</ul>}
              <p className="mt-3 text-xs text-muted-foreground">El cobro es por página: cada página cuenta con su propio plan y vencimiento.</p>
            </section>
          )}

          <section aria-labelledby="act-title" className={card} data-testid="activity">
            <h2 id="act-title" className="mb-3 text-lg font-bold">Actividad de las páginas de tus clientes</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              {([["Visitas", d.activity.visits], ["Visitantes únicos (por día)", d.activity.visitors], ["Productos vistos", d.activity.product_views], ["Clics a WhatsApp", d.activity.whatsapp], ["Pedidos", d.activity.orders], ["Vendido por las páginas", Money(d.activity.orders_total)], ["Turnos reservados", d.activity.appointments], ["Páginas con visitas", `${d.activity.pages_with_visits} de ${d.activity.pages_published}`]] as const).map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-xl font-bold tabular-nums">{typeof v === "number" ? v.toLocaleString("es-AR") : v}</dd></div>)}
            </dl>
            <p className="mt-3 text-sm text-muted-foreground">De cada 100 visitas, <strong>{d.activity.visits ? ((d.activity.whatsapp / d.activity.visits) * 100).toFixed(1) : "0"}</strong> terminan en un clic a WhatsApp.</p>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="top-title" className={card}>
              <h2 id="top-title" className="mb-3 text-lg font-bold">Páginas con más visitas</h2>
              {d.topPages.length === 0 ? <p className="text-sm text-muted-foreground">Sin visitas en este período.</p> : (
                <ol className="divide-y text-sm">{d.topPages.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 py-2"><Link href={`/admin/negocios/${p.id}`} className="min-w-0 truncate font-semibold hover:underline">{p.name}<span className="ml-2 text-xs font-normal text-muted-foreground">{p.industry} · {p.plan}</span></Link><span className="shrink-0 tabular-nums text-muted-foreground">{p.visits} visitas · {p.whatsapp} WA · {p.orders} ped.</span></li>)}</ol>
              )}
            </section>
            <section aria-labelledby="src-title" className={card}>
              <h2 id="src-title" className="mb-3 text-lg font-bold">De dónde llegan las visitas</h2>
              {d.visitSources.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos todavía.</p> : (
                <ul className="space-y-2 text-sm">{d.visitSources.map((s) => { const top = d.visitSources[0]!.visits; return <li key={s.source}><div className="flex justify-between"><span className="font-semibold">{s.source}</span><span className="tabular-nums">{s.visits.toLocaleString("es-AR")}</span></div><div className="mt-1 h-1.5 rounded-full bg-gray-100" aria-hidden><div className="h-full rounded-full bg-gray-700" style={{ width: `${Math.max(3, (s.visits / top) * 100)}%` }} /></div></li>; })}</ul>
              )}
            </section>
          </div>

          <section aria-labelledby="ind-title" className={card}>
            <h2 id="ind-title" className="mb-3 text-lg font-bold">Rendimiento por rubro</h2>
            <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><caption className="sr-only">Rendimiento por rubro</caption>
              <thead><tr>{["Rubro", "Páginas publicadas", "Nuevas en el período", "Visitas", "Pedidos"].map((h, i) => <th key={h} scope="col" className={`px-3 py-2 text-xs font-medium text-muted-foreground ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>)}</tr></thead>
              <tbody>{d.industries.map((r) => <tr key={r.industry} className="border-t"><th scope="row" className="px-3 py-2 text-left font-semibold">{r.industry}</th><td className="px-3 py-2 text-right tabular-nums">{r.pages}</td><td className="px-3 py-2 text-right tabular-nums">{r.newPublished}</td><td className="px-3 py-2 text-right tabular-nums">{r.visits}</td><td className="px-3 py-2 text-right tabular-nums">{r.orders}</td></tr>)}</tbody></table></div>
          </section>

          <section aria-labelledby="eng-title" className={card}>
            <h2 id="eng-title" className="mb-3 text-lg font-bold">Retención y comunicación</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              {([["Cuentas totales", d.accounts.total], ["Entraron en 30 días", d.accounts.active30], ["Entraron en 7 días", d.accounts.active7], ["Comunicados enviados", `${d.campaigns.sent} (${d.campaigns.recipients} destinatarios)`]] as const).map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-xl font-bold tabular-nums">{typeof v === "number" ? v.toLocaleString("es-AR") : v}</dd></div>)}
            </dl>
            <p className="mt-3 text-sm text-muted-foreground">Retención a 30 días: <strong>{pct(d.accounts.active30, d.accounts.total)}</strong> de las cuentas entró en el último mes.</p>
          </section>
        </>
      )}
    </div>
  );
}
