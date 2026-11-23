"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/fields";
import { api } from "@/lib/authClient";
import { ErrorBox, Pager, useAdmin, when } from "./AdminShell";
import { msg, useLoad } from "./AdminPages";

const MAIL_ERR: Record<string, string> = {
  unknown_variables: "Usaste una variable que no existe en esta plantilla. Mirá la lista de variables disponibles.",
  link_required: "Este mail es para entrar a la cuenta: tiene que incluir {{link}} o nadie podría usarlo.",
  template_locked: "Este mail no se puede apagar: sin él, las cuentas quedan sin acceso.",
  schedule_in_past: "Elegí una fecha y hora futuras.",
  not_editable: "Este comunicado ya se envió o se canceló.",
  not_sendable: "Este comunicado ya se envió o se canceló.",
  not_cancellable: "Este comunicado ya se envió o se canceló.",
  mail_failed: "El servidor de email no respondió. Revisá la configuración SMTP.",
  already_member: "Esa persona ya es parte del equipo.",
};
const err = (code?: string) => MAIL_ERR[code ?? ""] ?? msg(code);

type Tab = "plantillas" | "comunicados" | "automatizacion";
const TABS: { id: Tab; label: string }[] = [
  { id: "plantillas", label: "Plantillas" },
  { id: "comunicados", label: "Comunicados" },
  { id: "automatizacion", label: "Automatizaciones" },
];

export function Emails() {
  const [tab, setTab] = useState<Tab>("plantillas");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Emails</h1>
        <p className="mt-1 max-w-[62ch] text-muted-foreground">Editá los mails automáticos, mandá comunicados a grupos de usuarios (ahora o programados) y configurá los avisos.</p>
      </div>
      <div role="tablist" aria-label="Secciones de emails" className="flex gap-1 overflow-x-auto border-b border-[#E1EAF3]">
        {TABS.map((t) => (
          <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`min-h-10 shrink-0 px-4 text-sm font-medium ${tab === t.id ? "text-[#0E1B2C] shadow-[inset_0_-2px_0_#2F6FB0]" : "text-muted-foreground hover:text-foreground"}`}>{t.label}</button>
        ))}
      </div>
      {tab === "plantillas" && <Templates />}
      {tab === "comunicados" && <Campaigns />}
      {tab === "automatizacion" && <Automation />}
    </div>
  );
}

// ───────────── Plantillas ─────────────
interface Tpl {
  key: string; name: string; group: string; description: string; trigger: string; locked: boolean; hasButton: boolean;
  vars: { name: string; example: string; help: string }[]; subject: string; body: string; enabled: boolean; customized: boolean; defaultSubject: string; defaultBody: string; updatedAt: string | null;
}
const GROUPS: Record<string, string> = { cuenta: "Cuenta y acceso", planes: "Planes y pagos", turnos: "Turnos", soporte: "Soporte", equipo: "Equipo" };

function Templates() {
  const me = useAdmin();
  const canEdit = me.can("emails", "manage");
  const { data, error, reload } = useLoad<{ templates: Tpl[] }>("/admin/emails/templates");
  const [sel, setSel] = useState<string>("verify");
  const groups = useMemo(() => {
    const out: Record<string, Tpl[]> = {};
    for (const t of data?.templates ?? []) (out[t.group] ??= []).push(t);
    return out;
  }, [data]);
  const current = data?.templates.find((t) => t.key === sel);
  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <nav aria-label="Plantillas" className="space-y-4">
        <ErrorBox error={error} />
        {Object.entries(groups).map(([g, list]) => (
          <div key={g}>
            <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{GROUPS[g] ?? g}</p>
            <ul className="space-y-0.5">
              {list.map((t) => (
                <li key={t.key}>
                  <button type="button" onClick={() => setSel(t.key)} aria-current={sel === t.key ? "true" : undefined}
                    className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm ${sel === t.key ? "bg-[#EAF4FC] font-semibold text-[#0E1B2C]" : "hover:bg-muted"}`}>
                    <span>{t.name}</span>
                    <span className="flex gap-1">
                      {!t.enabled && <span className="rounded bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">APAGADO</span>}
                      {t.customized && <span className="rounded bg-[#2F6FB0]/15 px-1.5 text-[10px] font-semibold text-[#2F6FB0]">EDITADO</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      {current && <TemplateEditor key={current.key} tpl={current} canEdit={canEdit} onSaved={reload} />}
    </div>
  );
}

function TemplateEditor({ tpl, canEdit, onSaved }: { tpl: Tpl; canEdit: boolean; onSaved: () => void }) {
  const [subject, setSubject] = useState(tpl.subject);
  const [body, setBody] = useState(tpl.body);
  const [enabled, setEnabled] = useState(tpl.enabled);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [html, setHtml] = useState<string>("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const dirty = subject !== tpl.subject || body !== tpl.body || enabled !== tpl.enabled;

  // Vista previa en vivo (con datos de ejemplo), un poco después de la última tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      void api<{ html: string }>(`/admin/emails/templates/${tpl.key}/preview`, { body: { subject, body } }).then((r) => { if (r.ok) setHtml(r.data.html); });
    }, 350);
    return () => clearTimeout(t);
  }, [subject, body, tpl.key]);

  function insert(v: string) {
    const el = bodyRef.current;
    const tag = `{{${v}}}`;
    if (!el) return setBody((b) => b + tag);
    const [a, z] = [el.selectionStart, el.selectionEnd];
    setBody(body.slice(0, a) + tag + body.slice(z));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + tag.length, a + tag.length); });
  }
  async function save() {
    const r = await api(`/admin/emails/templates/${tpl.key}`, { method: "PUT", body: { subject, body, enabled } });
    if (r.ok) { setStatus({ kind: "ok", text: "Guardado. Los próximos mails ya salen así." }); onSaved(); }
    else setStatus({ kind: "error", text: err(r.data.error) + (Array.isArray(r.data.variables) ? ` (${(r.data.variables as string[]).map((v) => `{{${v}}}`).join(", ")})` : "") });
  }
  async function restore() {
    if (!window.confirm("¿Volver al texto original de MiShowo? Perdés tus cambios de esta plantilla.")) return;
    const r = await api(`/admin/emails/templates/${tpl.key}`, { method: "DELETE" });
    if (r.ok) { setSubject(tpl.defaultSubject); setBody(tpl.defaultBody); setEnabled(true); setStatus({ kind: "ok", text: "Volvió al texto original." }); onSaved(); } else setStatus({ kind: "error", text: err(r.data.error) });
  }
  async function test() {
    const r = await api<{ to: string }>(`/admin/emails/templates/${tpl.key}/test`, { body: {} });
    setStatus(r.ok ? { kind: "ok", text: `Te mandamos una prueba a ${r.data.to}.` } : { kind: "error", text: err(r.data.error) });
  }

  return (
    <section aria-labelledby="tpl-title" className="min-w-0 space-y-4">
      <div>
        <h2 id="tpl-title" className="text-xl font-bold">{tpl.name}</h2>
        <p className="text-sm text-muted-foreground">{tpl.description} <span className="block sm:inline">Se manda: {tpl.trigger}</span></p>
      </div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <Field label="Asunto" counter={{ value: subject, max: 150 }}>{(id) => <TextInput id={id} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!canEdit} maxLength={150} />}</Field>
          <Field label="Mensaje" hint="Una línea en blanco separa los párrafos." counter={{ value: body, max: 5000 }}>
            {(id, d) => <TextArea id={id} aria-describedby={d} ref={bodyRef} rows={10} value={body} onChange={(e) => setBody(e.target.value)} disabled={!canEdit} maxLength={5000} />}
          </Field>
          {tpl.vars.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Variables (tocá para insertar en el mensaje)</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {tpl.vars.map((v) => (
                  <button key={v.name} type="button" disabled={!canEdit} onClick={() => insert(v.name)} title={`${v.help}. Ej.: ${v.example}`}
                    className="min-h-9 rounded-full border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50">{`{{${v.name}}}`}</button>
                ))}
              </div>
            </div>
          )}
          {!tpl.locked && (
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" className="mt-1 size-4" checked={enabled} disabled={!canEdit} onChange={(e) => setEnabled(e.target.checked)} />
              <span><span className="font-medium">Enviar este mail automáticamente</span><span className="block text-xs text-muted-foreground">Si lo apagás, no se manda a nadie.</span></span>
            </label>
          )}
          {tpl.locked && <p className="text-xs text-muted-foreground">Este mail no se puede apagar: lo necesitan las cuentas para funcionar o lo exige la ley.</p>}
          {status && <p role={status.kind === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${status.kind === "error" ? "bg-destructive/10 text-destructive" : "bg-[#EAF4FC]"}`}>{status.text}</p>}
          <div className="flex flex-wrap gap-2">
            {canEdit && <Button onClick={() => void save()} disabled={!dirty}>Guardar cambios</Button>}
            <Button variant="outline" onClick={() => void test()}>Mandarme una prueba</Button>
            {canEdit && tpl.customized && <Button variant="ghost" onClick={() => void restore()}>Volver al original</Button>}
          </div>
          {!canEdit && <p className="text-xs text-muted-foreground">Con tus permisos podés ver y probar las plantillas, pero no editarlas.</p>}
        </div>
        <div className="min-w-0">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Vista previa (con datos de ejemplo)</p>
          <iframe title={`Vista previa de ${tpl.name}`} sandbox="" srcDoc={html} className="h-[34rem] w-full rounded-xl border bg-white" />
        </div>
      </div>
    </section>
  );
}

// ───────────── Comunicados ─────────────
interface Segment { key: string; label: string; help: string; count: number }
interface Campaign { id: string; subject: string; body: string; kind: "servicio" | "novedades"; segment: string; status: string; scheduledAt: string | null; sentAt: string | null; recipients: number; failed: number; createdAt: string }
const STATUS: Record<string, string> = { borrador: "Borrador", programado: "Programado", enviando: "Enviando…", enviado: "Enviado", cancelado: "Cancelado" };

/** Valor para <input type="datetime-local"> (hora local del navegador) → ISO. */
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

function Campaigns() {
  const me = useAdmin();
  const canEdit = me.can("emails", "manage");
  const camps = useLoad<{ campaigns: Campaign[] }>("/admin/emails/campaigns");
  const segs = useLoad<{ segments: Segment[] }>("/admin/emails/segments");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [mode, setMode] = useState<"now" | "later">("now");
  const [segment, setSegment] = useState("gratis");
  const [kind, setKind] = useState<"servicio" | "novedades">("novedades");
  const count = segs.data?.segments.find((x) => x.key === segment)?.count;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const when = mode === "later" ? toIso(String(f.get("at"))) : null;
    if (mode === "later" && !when) return setStatus({ kind: "error", text: "Elegí cuándo se envía." });
    const r = await api<{ id: string }>("/admin/emails/campaigns", { body: { subject: String(f.get("subject")), body: String(f.get("body")), kind, segment, scheduledAt: when } });
    if (!r.ok) return setStatus({ kind: "error", text: err(r.data.error) });
    if (mode === "now") {
      if (!window.confirm(`Se va a enviar a ${count ?? "todos los"} destinatarios ahora. ¿Confirmás?`)) { setStatus({ kind: "ok", text: "Quedó guardado como borrador." }); camps.reload(); return; }
      const s = await api<{ sent: number; failed: number }>(`/admin/emails/campaigns/${r.data.id}/send`, { body: {} });
      setStatus(s.ok ? { kind: "ok", text: `Enviado a ${s.data.sent} personas${s.data.failed ? ` (${s.data.failed} fallaron)` : ""}.` } : { kind: "error", text: err(s.data.error) });
    } else setStatus({ kind: "ok", text: "Programado. Sale solo a la hora indicada." });
    form.reset(); camps.reload(); segs.reload();
  }
  async function act(id: string, what: "send" | "cancel") {
    if (what === "send" && !window.confirm("¿Enviar este comunicado ahora?")) return;
    const r = await api(`/admin/emails/campaigns/${id}/${what}`, { body: {} });
    if (!r.ok) setStatus({ kind: "error", text: err(r.data.error) });
    camps.reload();
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <form onSubmit={(e) => void submit(e)} className="space-y-4 rounded-2xl border p-4 sm:p-5" data-testid="campaign-form">
          <h2 className="text-lg font-bold">Nuevo comunicado</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Para quién" hint={count !== undefined ? `${count} ${count === 1 ? "persona" : "personas"} hoy. ${segs.data?.segments.find((x) => x.key === segment)?.help ?? ""}` : undefined}>
              {(id, d) => <Select id={id} aria-describedby={d} value={segment} onChange={(e) => setSegment(e.target.value)}>{segs.data?.segments.map((s) => <option key={s.key} value={s.key}>{s.label} ({s.count})</option>)}</Select>}
            </Field>
            <Field label="Tipo" hint={kind === "novedades" ? "Lleva enlace para darse de baja; quien se dio de baja no lo recibe." : "Aviso del servicio (cambios, mantenimiento): llega a todos."}>
              {(id, d) => <Select id={id} aria-describedby={d} value={kind} onChange={(e) => setKind(e.target.value as "servicio" | "novedades")}><option value="novedades">Novedades y promociones</option><option value="servicio">Aviso del servicio</option></Select>}
            </Field>
          </div>
          <Field label="Asunto" required>{(id) => <TextInput id={id} name="subject" required minLength={3} maxLength={150} />}</Field>
          <Field label="Mensaje" required hint="Podés usar {{name}} para el nombre de cada persona. Una línea en blanco separa los párrafos.">{(id, d) => <TextArea id={id} aria-describedby={d} name="body" rows={7} required minLength={10} maxLength={8000} />}</Field>
          <fieldset className="flex flex-wrap items-end gap-4">
            <legend className="sr-only">Cuándo se envía</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="when" checked={mode === "now"} onChange={() => setMode("now")} className="size-4" />Enviar ahora</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="when" checked={mode === "later"} onChange={() => setMode("later")} className="size-4" />Programar</label>
            {mode === "later" && <Field label="Fecha y hora">{(id) => <TextInput id={id} name="at" type="datetime-local" required className="w-60" />}</Field>}
          </fieldset>
          {status && <p role={status.kind === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${status.kind === "error" ? "bg-destructive/10 text-destructive" : "bg-[#EAF4FC]"}`}>{status.text}</p>}
          <Button type="submit">{mode === "now" ? "Enviar comunicado" : "Programar comunicado"}</Button>
        </form>
      )}
      <ErrorBox error={camps.error} />
      <div>
        <h2 className="mb-2 text-lg font-bold">Historial</h2>
        {camps.data?.campaigns.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Todavía no mandaste ningún comunicado.</p>}
        <ul className="divide-y rounded-xl border" data-testid="campaigns">
          {camps.data?.campaigns.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold">{c.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {STATUS[c.status] ?? c.status} · {segs.data?.segments.find((x) => x.key === c.segment)?.label ?? c.segment} · {c.kind === "novedades" ? "Novedades" : "Servicio"}
                  {c.status === "programado" && ` · sale el ${when(c.scheduledAt)}`}
                  {c.status === "enviado" && ` · ${c.recipients} enviados${c.failed ? `, ${c.failed} fallaron` : ""} · ${when(c.sentAt)}`}
                </p>
              </div>
              {canEdit && (c.status === "borrador" || c.status === "programado") && (
                <span className="flex gap-2"><Button size="sm" onClick={() => void act(c.id, "send")}>Enviar ahora</Button><Button size="sm" variant="ghost" onClick={() => void act(c.id, "cancel")}>Cancelar</Button></span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Los programados los manda la tarea <code>send-campaigns</code> (cada 5 minutos). Tope: 2.000 destinatarios por comunicado.</p>
      </div>
    </div>
  );
}

// ───────────── Automatizaciones ─────────────
function Automation() {
  const me = useAdmin();
  const { data, error, reload } = useLoad<{ remindDays: number }>("/admin/emails/automation");
  const tpls = useLoad<{ templates: Tpl[] }>("/admin/emails/templates");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const canEdit = me.can("emails", "manage");
  const automatic = tpls.data?.templates.filter((t) => t.group === "planes" || t.group === "turnos" || t.key === "welcome" || t.key === "lead_nudge") ?? [];
  async function toggle(t: Tpl) {
    const r = await api(`/admin/emails/templates/${t.key}`, { method: "PUT", body: { subject: t.subject, body: t.body, enabled: !t.enabled } });
    if (r.ok) tpls.reload(); else setStatus({ kind: "error", text: err(r.data.error) });
  }
  return (
    <div className="space-y-6">
      <ErrorBox error={error} />
      <section className="space-y-3 rounded-2xl border p-4 sm:p-5">
        <h2 className="text-lg font-bold">Aviso de vencimiento del plan</h2>
        <form className="flex flex-wrap items-end gap-3" onSubmit={async (e) => {
          e.preventDefault();
          const days = Number(new FormData(e.currentTarget).get("days"));
          const r = await api("/admin/emails/automation", { method: "PUT", body: { remindDays: days } });
          if (r.ok) { setStatus({ kind: "ok", text: `Listo: se avisa ${days} ${days === 1 ? "día" : "días"} antes.` }); reload(); } else setStatus({ kind: "error", text: err(r.data.error) });
        }}>
          <Field label="Avisar con cuántos días de anticipación" hint="Entre 1 y 30. Se manda una sola vez por vencimiento.">{(id, d) => <TextInput id={id} aria-describedby={d} name="days" type="number" min={1} max={30} defaultValue={data?.remindDays ?? 7} key={data?.remindDays} className="w-40" disabled={!canEdit} required />}</Field>
          {canEdit && <Button type="submit">Guardar</Button>}
        </form>
        {status && <p role={status.kind === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${status.kind === "error" ? "bg-destructive/10 text-destructive" : "bg-[#EAF4FC]"}`}>{status.text}</p>}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Mails automáticos</h2>
        <p className="text-sm text-muted-foreground">Los prendés o apagás acá; el texto se edita en <strong>Plantillas</strong>. Los de acceso a la cuenta no se pueden apagar.</p>
        <ul className="divide-y rounded-xl border">
          {automatic.map((t) => (
            <li key={t.key} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <span className="min-w-0"><span className="font-semibold">{t.name}</span><span className="block text-xs text-muted-foreground">{t.trigger}</span></span>
              <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={t.enabled} disabled={!canEdit || t.locked} onChange={() => void toggle(t)} />{t.enabled ? "Activo" : "Apagado"}</label>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ───────────── Consultas y arrepentimientos (bandeja de soporte) ─────────────
interface Inbox { page: number; pageSize: number; total: number; counts: { nuevo: number; resuelto: number }; items: Item[] }
interface Item { id: string; code: string; kind: "arrepentimiento" | "contacto"; name: string; email: string; reference: string | null; message: string | null; status: string; internalNote: string | null; repliedAt: string | null; createdAt: string }

export function Consultas() {
  const [status, setStatus] = useState<"nuevo" | "resuelto">("nuevo");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const { data, error, reload } = useLoad<Inbox>(`/admin/contact?status=${status}&page=${page}&q=${encodeURIComponent(query)}`);
  const [open, setOpen] = useState<string | null>(null);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [msgState, setMsg] = useState<{ id: string; kind: "ok" | "error"; text: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function send(it: Item) {
    const r = await api(`/admin/contact/${it.id}/reply`, { body: { message: reply[it.id] ?? "" } });
    // La consulta sale de "Pendientes" al resolverse, así que la confirmación va arriba de la lista y no dentro de su tarjeta.
    if (r.ok) { setNotice(`Respuesta enviada a ${it.email}. La consulta quedó resuelta.`); setMsg(null); setOpen(null); setReply((x) => ({ ...x, [it.id]: "" })); reload(); }
    else setMsg({ id: it.id, kind: "error", text: err(r.data.error) });
  }
  async function mark(it: Item, to: "nuevo" | "resuelto") {
    const r = await api(`/admin/contact/${it.id}`, { method: "PATCH", body: { status: to } });
    if (r.ok) { setNotice(to === "resuelto" ? "Marcada como resuelta." : "Reabierta: volvió a Pendientes."); reload(); } else setMsg({ id: it.id, kind: "error", text: err(r.data.error) });
  }
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Consultas</h1>
        <p className="mt-1 max-w-[62ch] text-muted-foreground">Lo que escribe la gente desde Contacto y los pedidos de arrepentimiento. Los de arrepentimiento tienen plazo legal: atendelos primero.</p>
      </div>
      <form role="search" className="flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q.trim()); }}>
        <label className="sr-only" htmlFor="inbox-q">Buscar por email, nombre o código</label>
        <TextInput id="inbox-q" type="search" placeholder="Buscar por email, nombre o código" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" variant="outline">Buscar</Button>
      </form>
      <div role="group" aria-label="Estado" className="flex gap-1">
        {(["nuevo", "resuelto"] as const).map((s) => (
          <button key={s} type="button" aria-pressed={status === s} onClick={() => { setStatus(s); setPage(1); }} className={`min-h-10 rounded-full px-4 text-sm ${status === s ? "bg-[#2F6FB0] text-white" : "border hover:bg-muted"}`}>
            {s === "nuevo" ? "Pendientes" : "Resueltas"}{data ? ` (${data.counts[s]})` : ""}
          </button>
        ))}
      </div>
      <ErrorBox error={error} />
      {notice && <p role="status" className="rounded-lg bg-[#EAF4FC] p-3 text-sm" data-testid="inbox-notice">{notice}</p>}
      {data?.items.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{status === "nuevo" ? "No hay consultas pendientes. 🎉" : "Todavía no resolviste ninguna."}</p>}
      <ul className="space-y-3" data-testid="inbox">
        {data?.items.map((it) => (
          <li key={it.id} className="rounded-2xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">
                  {it.name} <span className="font-normal text-muted-foreground">· {it.email}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className={`mr-2 rounded px-1.5 py-0.5 font-semibold ${it.kind === "arrepentimiento" ? "bg-amber-100 text-amber-900" : "bg-muted"}`}>{it.kind === "arrepentimiento" ? "Arrepentimiento" : "Consulta"}</span>
                  #{it.code} · {when(it.createdAt)}{it.repliedAt ? ` · respondida ${when(it.repliedAt)}` : ""}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setOpen(open === it.id ? null : it.id)}>{open === it.id ? "Cerrar" : "Atender"}</Button>
            </div>
            {it.reference && <p className="mt-2 text-sm"><span className="text-muted-foreground">Referencia:</span> {it.reference}</p>}
            {it.message && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">{it.message}</p>}
            {open === it.id && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <Field label={`Respuesta para ${it.email}`} hint="Sale desde el mail de MiShowo, con el código de seguimiento. La consulta pasa a resuelta.">
                  {(id, d) => <TextArea id={id} aria-describedby={d} rows={5} maxLength={3000} value={reply[it.id] ?? ""} onChange={(e) => setReply((x) => ({ ...x, [it.id]: e.target.value }))} />}
                </Field>
                {msgState?.id === it.id && <p role={msgState.kind === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${msgState.kind === "error" ? "bg-destructive/10 text-destructive" : "bg-[#EAF4FC]"}`}>{msgState.text}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={(reply[it.id] ?? "").trim().length < 5} onClick={() => void send(it)}>Enviar respuesta</Button>
                  {it.status === "nuevo" ? <Button size="sm" variant="ghost" onClick={() => void mark(it, "resuelto")}>Marcar resuelta sin responder</Button> : <Button size="sm" variant="ghost" onClick={() => void mark(it, "nuevo")}>Reabrir</Button>}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {data && <Pager page={page} total={data.total} size={data.pageSize} onPage={setPage} />}
    </div>
  );
}
