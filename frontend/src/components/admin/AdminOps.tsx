"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, TextArea, TextInput } from "@/components/ui/fields";
import { api } from "@/lib/authClient";
import { siteUrl } from "@/lib/siteUrl";
import { DEFAULT_FAQ } from "@/content/faq";
import { ErrorBox, Pager, useAdmin, when } from "./AdminShell";
import { msg, useLoad } from "./AdminPages";

const REASON: Record<string, string> = { contenido_ilegal: "Contenido ilegal", estafa: "Estafa", ofensivo: "Contenido ofensivo", otro: "Otro motivo" };
const ACTION_LABEL: Record<string, string> = { "report.dismiss": "Descartada", "report.unpublish": "Despublicó el negocio", "report.suspend": "Suspendió el negocio", "report.note": "Nota" };

// ───────────── Denuncias ─────────────
interface Report {
  id: string; reason: string; detail: string | null; status: string; createdAt: string;
  business: { id: string; name: string; slug: string; status: string; deleted: boolean };
  history: { action: string; note: string | null; at: string; by: string | null }[];
}
interface ReportList { page: number; pageSize: number; total: number; counts: Record<string, number>; reports: Report[] }

export function Reports() {
  const me = useAdmin();
  const manage = me.role !== "support";
  const [status, setStatus] = useState("nuevo");
  const [page, setPage] = useState(1);
  const { data, error, reload } = useLoad<ReportList>(`/admin/reports?status=${status}&page=${page}`);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: "note" | "dismiss" | "unpublish" | "suspend") {
    setBusy(id); setErr(null);
    const text = (note[id] ?? "").trim();
    const r = await api(`/admin/reports/${id}/resolve`, { body: { action, ...(text ? { note: text } : {}) } });
    setBusy(null);
    if (!r.ok) return setErr(r.data.error === "not_published" ? "Esa página ya no está publicada." : msg(r.data.error));
    setNote((n) => ({ ...n, [id]: "" }));
    reload();
  }

  const tabs: [string, string][] = [["nuevo", "Nuevas"], ["revisado", "Descartadas"], ["accion_tomada", "Con acción"], ["todas", "Todas"]];
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Denuncias</h1>
      <div role="tablist" aria-label="Estado" className="flex flex-wrap gap-1">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={status === k} onClick={() => { setStatus(k); setPage(1); }}
            className={`rounded-full px-3 py-1.5 text-sm ${status === k ? "bg-[#2F6FB0] text-white" : "hover:bg-muted"}`}>
            {label}{k !== "todas" && data ? ` (${data.counts[k] ?? 0})` : ""}
          </button>
        ))}
      </div>
      <ErrorBox error={error ?? err} />
      {data?.reports.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground" data-testid="reports-empty">No hay denuncias en esta lista.</p>}
      <ul className="space-y-3">
        {data?.reports.map((r) => (
          <li key={r.id} className="rounded-xl border p-4" data-testid="admin-report">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{REASON[r.reason] ?? r.reason} · <Link className="underline underline-offset-4" href={`/admin/negocios/${r.business.id}`}>{r.business.name}</Link></p>
                <p className="text-sm text-muted-foreground">{when(r.createdAt)} · página {r.business.deleted ? "eliminada" : r.business.status === "published" ? "publicada" : r.business.status === "suspended" ? "suspendida" : "en borrador"}</p>
              </div>
              {r.business.status === "published" && <a className="rounded-md border px-3 py-1.5 text-sm" href={siteUrl(r.business.slug)} target="_blank" rel="noopener noreferrer">Ver la página</a>}
            </div>
            {r.detail && <p className="mt-2 rounded-lg bg-muted p-3 text-sm">“{r.detail}”</p>}
            {r.history.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {r.history.map((h, i) => <li key={i}>{when(h.at)} · {h.by ?? "Sistema"} · {ACTION_LABEL[h.action] ?? h.action}{h.note ? `: ${h.note}` : ""}</li>)}
              </ul>
            )}
            {r.status === "nuevo" ? (
              <div className="mt-3 space-y-2">
                <TextInput aria-label="Nota (opcional para resolver, obligatoria para dejar solo una nota)" placeholder="Nota interna" maxLength={500} value={note[r.id] ?? ""} onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busy === r.id || !(note[r.id] ?? "").trim()} onClick={() => void act(r.id, "note")}>Guardar nota</Button>
                  {manage ? (
                    <>
                      <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => void act(r.id, "dismiss")}>Descartar</Button>
                      {r.business.status === "published" && <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => void act(r.id, "unpublish")}>Despublicar</Button>}
                      {r.business.status !== "suspended" && <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => void act(r.id, "suspend")}>Suspender negocio</Button>}
                    </>
                  ) : <span className="self-center text-xs text-muted-foreground">Tu rol (Soporte) permite dejar notas; la decisión la toma Admin u Owner.</span>}
                </div>
              </div>
            ) : <p className="mt-3 text-sm font-medium">{r.status === "revisado" ? "Descartada" : "Se tomó una acción"}</p>}
          </li>
        ))}
      </ul>
      {data && <Pager page={page} total={data.total} size={data.pageSize} onPage={setPage} />}
    </div>
  );
}

// ───────────── Sistema ─────────────
interface Sys {
  version: string; node: string; env: string; uptimeSeconds: number; db: { ok: boolean; latencyMs: number };
  uploads: { bytes: number; files: number; truncated: boolean; disk: { freeBytes: number; totalBytes: number } | null };
  cron: { lastRun: string | null; lastPlanExpiry: string | null }; maintenance: { enabled: boolean; message: string }; reservedCount: number;
}
const mb = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${(b / 1024 ** 2).toFixed(1)} MB`);
const uptime = (s: number) => (s >= 86400 ? `${Math.floor(s / 86400)} d ${Math.floor((s % 86400) / 3600)} h` : s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min` : `${Math.floor(s / 60)} min`);

export function System() {
  const me = useAdmin();
  const { data, error, reload } = useLoad<Sys>("/admin/system");
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!data) return <ErrorBox error={error ?? "Cargando…"} />;
  const manage = me.role !== "support";
  const m = data.maintenance;

  async function setMaintenance(enabled: boolean) {
    setErr(null);
    const r = await api("/admin/system/maintenance", { method: "PUT", body: { enabled, message: (text ?? m.message).trim() } });
    if (!r.ok) return setErr(msg(r.data.error));
    setText(null); reload();
  }
  const tiles: [string, string, boolean | null][] = [
    ["Base de datos", data.db.ok ? `Funcionando · ${data.db.latencyMs} ms` : "Sin respuesta", data.db.ok],
    ["Espacio de fotos", `${mb(data.uploads.bytes)} en ${data.uploads.files}${data.uploads.truncated ? "+" : ""} archivos${data.uploads.disk ? ` · libre ${mb(data.uploads.disk.freeBytes)}` : ""}`, data.uploads.disk ? data.uploads.disk.freeBytes > 1024 ** 3 : null],
    ["Última corrida de tareas", data.cron.lastRun ? when(data.cron.lastRun) : "Sin registro todavía", data.cron.lastRun ? true : null],
    ["Último vencimiento de planes", data.cron.lastPlanExpiry ? when(data.cron.lastPlanExpiry) : "Todavía ninguno", null],
    ["Versión", `${data.version} · Node ${data.node} · activo hace ${uptime(data.uptimeSeconds)}`, null],
    ["Slugs reservados extra", String(data.reservedCount), null],
  ];
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Estado del sistema</h1>
      <ErrorBox error={err} />
      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2" data-testid="system-tiles">
        {tiles.map(([k, v, ok]) => (
          <div key={k} className="border-t pt-2">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="flex items-center gap-2 font-semibold">{ok !== null && <span aria-hidden className={`size-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500"}`} />}{v}</dd>
          </div>
        ))}
      </dl>
      <section className={`rounded-xl border-2 p-5 ${m.enabled ? "border-amber-400 bg-amber-50" : ""}`} aria-labelledby="mant-title" data-testid="maintenance-card">
        <h2 id="mant-title" className="text-lg font-semibold">Modo mantenimiento {m.enabled && <span className="ml-2 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold text-amber-950">ACTIVO</span>}</h2>
        <p className="mt-1 max-w-[62ch] text-sm text-muted-foreground">Muestra un aviso en la landing y frena los registros y los pedidos nuevos con un mensaje claro. Los negocios, el panel, el ingreso y este admin siguen funcionando.</p>
        {manage ? (
          <div className="mt-4 space-y-3">
            <Field label="Mensaje para el público" hint="Si lo dejás vacío, se usa uno por defecto.">{(id, d) => <TextInput id={id} aria-describedby={d} maxLength={200} value={text ?? m.message} onChange={(e) => setText(e.target.value)} />}</Field>
            {m.enabled
              ? <div className="flex gap-2"><Button onClick={() => void setMaintenance(false)}>Desactivar mantenimiento</Button>{text !== null && <Button variant="outline" onClick={() => void setMaintenance(true)}>Guardar mensaje</Button>}</div>
              : <Button variant="destructive" onClick={() => void setMaintenance(true)}>Activar mantenimiento</Button>}
          </div>
        ) : <p className="mt-3 text-sm">Solo Admin u Owner pueden cambiarlo.</p>}
      </section>
    </div>
  );
}

// ───────────── Contenido: slugs reservados, FAQ y aviso ─────────────
interface Cms { faq: { q: string; a: string }[]; banner: { enabled: boolean; text: string; link: string } }

export function Content() {
  const me = useAdmin();
  const manage = me.role !== "support";
  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold">Contenido</h1>
      <Banner manage={manage} />
      <Faq manage={manage} />
      <Reserved manage={manage} />
    </div>
  );
}

function useCms() {
  const { data, error, reload } = useLoad<Cms>("/admin/settings/cms");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  async function save(next: Cms) {
    setErr(null); setOk(false);
    const r = await api("/admin/settings/cms", { method: "PUT", body: next });
    if (!r.ok) return setErr(r.data.error === "banner_text_required" ? "Escribí el texto del aviso para poder activarlo." : r.data.error === "invalid_request" ? "Revisá los textos: algo es muy largo o el link no es válido (tiene que empezar con / o https://)." : msg(r.data.error));
    setOk(true); reload();
  }
  return { data, error, err, ok, save };
}

function Banner({ manage }: { manage: boolean }) {
  const { data, error, err, ok, save } = useCms();
  if (!data) return <ErrorBox error={error} />;
  return (
    <form className="space-y-3 rounded-xl border p-5" data-testid="banner-form" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      void save({ faq: data.faq, banner: { enabled: f.get("enabled") === "on", text: String(f.get("text")).trim(), link: String(f.get("link")).trim() } });
    }}>
      <h2 className="text-lg font-semibold">Aviso global de la landing</h2>
      <p className="text-sm text-muted-foreground">Una franja arriba de todo en mishowo.com. Sirve para novedades o avisos puntuales.</p>
      <Field label="Texto">{(id) => <TextInput id={id} name="text" maxLength={160} defaultValue={data.banner.text} disabled={!manage} />}</Field>
      <Field label="Link (opcional)" hint="Una ruta interna como /ayuda o un link que empiece con https://">{(id, d) => <TextInput id={id} aria-describedby={d} name="link" maxLength={200} defaultValue={data.banner.link} disabled={!manage} />}</Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={data.banner.enabled} disabled={!manage} /> Mostrar el aviso</label>
      <ErrorBox error={err} />{ok && <p role="status" className="text-sm">Guardado. Se ve en la landing en unos segundos.</p>}
      {manage && <Button type="submit" size="sm">Guardar aviso</Button>}
    </form>
  );
}

function Faq({ manage }: { manage: boolean }) {
  const { data, error, err, ok, save } = useCms();
  const [items, setItems] = useState<{ q: string; a: string }[] | null>(null);
  if (!data) return <ErrorBox error={error} />;
  const list = items ?? data.faq;
  const custom = list.length > 0;
  const edit = (i: number, k: "q" | "a", v: string) => setItems(list.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <section className="space-y-3 rounded-xl border p-5" aria-labelledby="faq-admin" data-testid="faq-form">
      <h2 id="faq-admin" className="text-lg font-semibold">Preguntas frecuentes</h2>
      <p className="text-sm text-muted-foreground">{custom ? "La landing muestra estas preguntas." : "Hoy la landing usa las preguntas de siempre. Si agregás las tuyas, las reemplazan."}</p>
      {!custom && manage && <Button size="sm" variant="outline" onClick={() => setItems(DEFAULT_FAQ.map((x) => ({ ...x })))}>Empezar desde las actuales</Button>}
      <ul className="space-y-4">
        {list.map((f, i) => (
          <li key={i} className="space-y-2 rounded-lg bg-muted/50 p-3">
            <Field label={`Pregunta ${i + 1}`}>{(id) => <TextInput id={id} value={f.q} maxLength={140} disabled={!manage} onChange={(e) => edit(i, "q", e.target.value)} />}</Field>
            <Field label="Respuesta">{(id) => <TextArea id={id} rows={3} value={f.a} maxLength={900} disabled={!manage} onChange={(e) => edit(i, "a", e.target.value)} />}</Field>
            {manage && <Button size="sm" variant="ghost" onClick={() => setItems(list.filter((_, j) => j !== i))}>Quitar</Button>}
          </li>
        ))}
      </ul>
      <ErrorBox error={err} />{ok && <p role="status" className="text-sm">Guardado.</p>}
      {manage && (
        <div className="flex flex-wrap gap-2">
          {list.length < 20 && <Button size="sm" variant="outline" onClick={() => setItems([...list, { q: "", a: "" }])}>Agregar pregunta</Button>}
          <Button size="sm" onClick={() => void save({ faq: list.filter((x) => x.q.trim() && x.a.trim()), banner: data.banner }).then(() => setItems(null))}>{list.length === 0 ? "Volver a las de siempre" : "Guardar preguntas"}</Button>
        </div>
      )}
    </section>
  );
}

function Reserved({ manage }: { manage: boolean }) {
  const { data, error, reload } = useLoad<{ slugs: string[]; builtin: string[] }>("/admin/settings/reserved-slugs");
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  if (!data) return <ErrorBox error={error} />;
  async function save() {
    setErr(null); setInfo(null);
    const slugs = (text ?? data!.slugs.join("\n")).split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    const r = await api<{ inUse: string[] }>("/admin/settings/reserved-slugs", { method: "PUT", body: { slugs } });
    if (!r.ok) return setErr(r.data.error === "invalid_request" ? "Hay un link con formato inválido: solo letras minúsculas, números y guiones (hasta 30)." : msg(r.data.error));
    setText(null); setInfo(r.data.inUse.length ? `Guardado. Ya los usan (siguen funcionando): ${r.data.inUse.join(", ")}.` : "Guardado."); reload();
  }
  return (
    <section className="space-y-3 rounded-xl border p-5" aria-labelledby="res-title" data-testid="reserved-form">
      <h2 id="res-title" className="text-lg font-semibold">Links reservados</h2>
      <p className="max-w-[62ch] text-sm text-muted-foreground">Nadie va a poder elegir estos links para su página (se suman a los que MiShowo ya reserva: {data.builtin.slice(0, 8).join(", ")}…). Los negocios que ya los usan no se tocan.</p>
      <Field label="Un link por línea (o separados por coma)">{(id) => <TextArea id={id} rows={5} value={text ?? data.slugs.join("\n")} disabled={!manage} onChange={(e) => setText(e.target.value)} />}</Field>
      <ErrorBox error={err} />{info && <p role="status" className="text-sm">{info}</p>}
      {manage && <Button size="sm" onClick={() => void save()}>Guardar links reservados</Button>}
    </section>
  );
}
