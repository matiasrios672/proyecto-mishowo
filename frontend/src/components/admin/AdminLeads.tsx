"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/fields";
import { api, API_URL } from "@/lib/authClient";
import { ErrorBox, Pager, useAdmin, when } from "./AdminShell";
import { msg, useLoad } from "./AdminPages";

type Stage = "sin_verificar" | "sin_pagina" | "borrador" | "publicado";
interface Lead {
  id: string; email: string; name: string | null; createdAt: string; lastLoginAt: string | null; verified: boolean; stage: Stage; stageLabel: string;
  businessName: string | null; slug: string | null; industry: string | null; planId: string | null; source: string | null; lastNudgeAt: string | null; optedOut: boolean; blocked: boolean;
}
interface LeadList { page: number; pageSize: number; total: number; counts: Record<Stage, number>; sources: { source: string; n: number }[]; stages: { key: Stage; label: string }[]; items: Lead[] }

const ERR: Record<string, string> = {
  too_soon: "Ya le escribimos hace menos de 3 días.", opted_out: "Se dio de baja de los mails: no le escribimos.", already_published: "Ya publicó su página.",
  blocked: "La cuenta está bloqueada.", mail_off_or_failed: "El mail «Retomar tu página» está apagado (o falló el envío). Prendelo en Emails → Plantillas.",
};
const STAGE_TONE: Record<Stage, string> = { sin_verificar: "text-muted-foreground", sin_pagina: "text-[#B45309]", borrador: "text-[#2F6FB0]", publicado: "text-[#15803D]" };
const days = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

interface Referrers { totalReferred: number; top: { id: string; email: string; name: string | null; invited: number; published: number; paid: number }[] }

/** Quiénes traen más gente con su link de invitación. */
function TopReferrers() {
  const { data } = useLoad<Referrers>("/admin/referrals");
  if (!data || data.top.length === 0) return null;
  return (
    <section aria-labelledby="ref-title" className="border-t border-[#E1EAF3] pt-5" data-testid="top-referrers">
      <h2 id="ref-title" className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Quiénes más invitan</h2>
      <p className="mb-3 text-xs text-muted-foreground">{data.totalReferred} {data.totalReferred === 1 ? "persona llegó" : "personas llegaron"} con un link de invitación. El premio por invitar lo definís vos: acá ves a quién corresponde.</p>
      <ul className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
        {data.top.slice(0, 10).map((r) => (
          <li key={r.id} className="flex justify-between gap-3 border-b border-[#E1EAF3] py-1.5"><span className="min-w-0 truncate">{r.email}</span><span className="shrink-0 tabular-nums text-muted-foreground">{r.invited} · {r.published} publicaron · {r.paid} con plan pago</span></li>
        ))}
      </ul>
    </section>
  );
}

export function Leads() {
  const me = useAdmin();
  const manage = me.can("leads", "manage");
  const [stage, setStage] = useState<Stage | "">("");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const path = `/admin/leads?page=${page}&q=${encodeURIComponent(query)}${stage ? `&stage=${stage}` : ""}`;
  const { data, error, reload } = useLoad<LeadList>(path);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function nudge(l: Lead) {
    setBusy(l.id); setNotice(null);
    const r = await api(`/admin/leads/${l.id}/nudge`, { body: {} });
    setBusy(null);
    if (r.ok) { setNotice({ kind: "ok", text: `Le escribimos a ${l.email} para que retome su página.` }); reload(); }
    else setNotice({ kind: "error", text: ERR[r.data.error ?? ""] ?? msg(r.data.error) });
  }

  const total = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0;
  const pending = data ? data.counts.sin_verificar + data.counts.sin_pagina + data.counts.borrador : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="mt-1 max-w-[64ch] text-muted-foreground">Toda persona que se registró, con la etapa en la que quedó. Sirve para volver a escribirles a quienes no terminaron de publicar su página.</p>
        </div>
        {manage && <a href={`${API_URL}/admin/leads.csv?q=${encodeURIComponent(query)}${stage ? `&stage=${stage}` : ""}`} download className="inline-flex min-h-10 items-center border border-input px-4 text-sm font-semibold hover:bg-muted">Descargar CSV</a>}
      </div>
      <ErrorBox error={error} />

      {data && (
        <section aria-label="Embudo" className="grid border-y border-[#E1EAF3] py-4 sm:grid-cols-4 sm:divide-x sm:divide-[#E1EAF3]" data-testid="funnel">
          {data.stages.map((s) => (
            <div key={s.key} className="px-4 py-2 first:pl-0">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-3xl font-extrabold tabular-nums ${STAGE_TONE[s.key]}`}>{data.counts[s.key]}</p>
              {total > 0 && <p className="text-xs text-muted-foreground">{Math.round((data.counts[s.key] / total) * 100)}% del total</p>}
            </div>
          ))}
        </section>
      )}
      {data && pending > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-[#F4F9FE] p-3 text-sm">
          <strong>{pending}</strong> {pending === 1 ? "persona se registró" : "personas se registraron"} y todavía no publicó.
          {manage && <Link href="/admin/emails" className="font-semibold text-[#2F6FB0]">Mandar un comunicado a «Todavía sin publicar» →</Link>}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Etapa" className="flex flex-wrap gap-1">
          {[{ key: "" as const, label: "Todas" }, ...(data?.stages ?? [])].map((s) => (
            <button key={s.key || "todas"} type="button" aria-pressed={stage === s.key} onClick={() => { setStage(s.key); setPage(1); }}
              className={`min-h-10 px-3 text-sm ${stage === s.key ? "bg-[#2F6FB0] text-white" : "border hover:bg-muted"}`}>{s.key === "" ? "Todas" : s.label}</button>
          ))}
        </div>
        <form role="search" className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q.trim()); }}>
          <label className="sr-only" htmlFor="leads-q">Buscar por email, nombre o negocio</label>
          <TextInput id="leads-q" type="search" placeholder="Email, nombre o negocio" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          <Button type="submit" variant="outline">Buscar</Button>
        </form>
      </div>

      {notice && <p role={notice.kind === "error" ? "alert" : "status"} className={`p-3 text-sm ${notice.kind === "error" ? "bg-destructive/10 text-destructive" : "bg-[#EAF4FC]"}`}>{notice.text}</p>}

      <div className="overflow-x-auto border">
        <table className="w-full min-w-[820px] border-collapse text-sm" data-testid="leads-table">
          <thead><tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Contacto</th><th className="px-3 py-2 font-medium">Etapa</th><th className="px-3 py-2 font-medium">Negocio</th>
            <th className="px-3 py-2 font-medium">Registro</th><th className="px-3 py-2 font-medium">Origen</th><th className="px-3 py-2 font-medium">Último aviso</th><th className="px-3 py-2" />
          </tr></thead>
          <tbody>
            {data?.items.map((l) => (
              <tr key={l.id} className="border-b align-top last:border-0" data-testid="lead-row">
                <td className="px-3 py-2.5"><span className="block font-semibold">{l.email}</span><span className="block text-xs text-muted-foreground">{l.name ?? "Sin nombre"}{!l.verified && " · email sin confirmar"}{l.optedOut && " · se dio de baja"}</span></td>
                <td className={`px-3 py-2.5 font-medium ${STAGE_TONE[l.stage]}`}>{l.stageLabel}</td>
                <td className="px-3 py-2.5">{l.businessName ?? "—"}{l.industry && <span className="block text-xs text-muted-foreground">{l.industry}</span>}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{when(l.createdAt)}<span className="block text-xs text-muted-foreground">hace {days(l.createdAt)} {days(l.createdAt) === 1 ? "día" : "días"}</span></td>
                <td className="px-3 py-2.5">{l.source ?? "directo"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{l.lastNudgeAt ? when(l.lastNudgeAt) : "—"}</td>
                <td className="px-3 py-2.5 text-right">
                  {manage && l.stage !== "publicado" && !l.optedOut && !l.blocked && (
                    <Button size="sm" variant="outline" disabled={busy === l.id} onClick={() => void nudge(l)}>{busy === l.id ? "Enviando…" : "Escribirle"}</Button>
                  )}
                </td>
              </tr>
            ))}
            {data?.items.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No hay personas con ese filtro.</td></tr>}
          </tbody>
        </table>
      </div>
      {data && <Pager page={page} total={data.total} size={data.pageSize} onPage={setPage} />}

      <TopReferrers />

      {data && data.sources.length > 0 && (
        <section aria-labelledby="src-title" className="border-t border-[#E1EAF3] pt-5">
          <h2 id="src-title" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">De dónde llegan</h2>
          <ul className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {data.sources.map((s) => <li key={s.source} className="flex justify-between border-b border-[#E1EAF3] py-1"><span>{s.source}</span><span className="font-semibold tabular-nums">{s.n}</span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
