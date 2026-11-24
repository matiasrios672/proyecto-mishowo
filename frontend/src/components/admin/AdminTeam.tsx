"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/fields";
import { api } from "@/lib/authClient";
import { sameAs, type AreaInfo, type Level, type Permissions } from "@/lib/permissions";
import { ErrorBox, useAdmin, when, PageHeader } from "./AdminShell";
import { msg, useLoad } from "./AdminPages";
import { confirmAction } from "@/components/feedback/confirm";

type Role = "admin" | "support";
interface Member { id: string; email: string; name: string | null; role: string; totpEnabled: boolean; lastLoginAt: string | null; permissions: Permissions; customPermissions: boolean }
interface TeamData { admins: Member[]; areas: AreaInfo[]; presets: Record<Role, Permissions> }

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", support: "Soporte" };
const TEAM_ERR: Record<string, string> = { mail_failed: "No se pudo enviar el mail (revisá el SMTP en Estado). Probá de nuevo.", no_recipients: "No hay a quién mandarle.", already_member: "Esa persona ya es parte del equipo.", is_owner: "Esa persona es Owner: tiene todo y no se le cambian los permisos." };
const errText = (code?: string) => TEAM_ERR[code ?? ""] ?? msg(code);
const LEVELS: { value: Level | ""; label: string }[] = [{ value: "", label: "Sin acceso" }, { value: "view", label: "Ver" }, { value: "manage", label: "Gestionar" }];

/** Resumen en una línea de lo que puede hacer alguien: «Gestiona: Pagos, Consultas · Ve: Negocios». */
function summary(p: Permissions, areas: readonly AreaInfo[]) {
  const manage = areas.filter((a) => p[a.key] === "manage").map((a) => a.label);
  const view = areas.filter((a) => p[a.key] === "view").map((a) => a.label);
  if (!manage.length && !view.length) return "Sin acceso a ninguna área";
  return [manage.length && `Gestiona: ${manage.join(", ")}`, view.length && `Ve: ${view.join(", ")}`].filter(Boolean).join(" · ");
}

/** Tabla de permisos: una fila por área con tres opciones (sin acceso / ver / gestionar). Cada fila es un grupo de radios. */
export function PermissionMatrix({ areas, value, onChange, name }: { areas: readonly AreaInfo[]; value: Permissions; onChange: (p: Permissions) => void; name: string }) {
  const set = (key: AreaInfo["key"], level: Level | "") => {
    const next = { ...value };
    if (level) next[key] = level; else delete next[key];
    onChange(next);
  };
  return (
    <div className="overflow-x-auto rounded-xl border" data-testid="permission-matrix">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <caption className="sr-only">Permisos por área</caption>
        <thead className="bg-muted/50">
          <tr>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Área</th>
            {LEVELS.map((l) => <th key={l.label} scope="col" className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">{l.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {areas.map((a) => {
            const current = value[a.key] ?? "";
            return (
              <tr key={a.key} className="border-t">
                <th scope="row" className="px-3 py-2 text-left align-top font-medium">
                  {a.label}
                  <span className="block text-xs font-normal text-muted-foreground">{current === "manage" ? a.manage : current === "view" ? a.view : "No ve esta sección"}</span>
                </th>
                {LEVELS.map((l) => (
                  <td key={l.label} className="px-3 py-2 text-center">
                    <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                      <input type="radio" name={`${name}-${a.key}`} className="size-5 accent-[var(--primary)]" checked={current === l.value}
                        aria-label={`${a.label}: ${l.label}`} onChange={() => set(a.key, l.value)} />
                    </label>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Rol (plantilla) + matriz. Cambiar la plantilla carga sus permisos; después se pueden ajustar a mano. */
function RoleAndPermissions({ data, role, setRole, perms, setPerms, name }: { data: TeamData; role: Role; setRole: (r: Role) => void; perms: Permissions; setPerms: (p: Permissions) => void; name: string }) {
  const custom = !sameAs(perms, data.presets[role], data.areas);
  return (
    <div className="space-y-3">
      <Field label="Plantilla" hint="Soporte atiende consultas y mira; Admin gestiona todo menos el equipo y los datos de cobro. Después ajustás área por área.">
        {(id, d) => (
          <Select id={id} aria-describedby={d} value={role} onChange={(e) => { const r = e.target.value as Role; setRole(r); setPerms({ ...data.presets[r] }); }}>
            <option value="support">Soporte</option><option value="admin">Admin</option>
          </Select>
        )}
      </Field>
      <PermissionMatrix areas={data.areas} value={perms} onChange={setPerms} name={name} />
      <p className="text-xs text-muted-foreground" data-testid="permissions-state">{custom ? "Permisos personalizados: distintos de la plantilla." : "Son los de la plantilla."} Gestionar incluye ver.</p>
    </div>
  );
}

/** Redactar un mail: a una persona (`to`) o a todo el equipo. Mismo formato de marca que los mails automáticos. */
function ComposeMail({ endpoint, who, onDone }: { endpoint: string; who: string; onDone?: () => void }) {
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-3 rounded-xl bg-muted/30 p-3" data-testid="compose-mail" onSubmit={async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const f = new FormData(form);
      if (!(await confirmAction({ title: endpoint.endsWith("/admins/email") ? "¿Mandar el mail a todo el equipo?" : "¿Enviar el mail?", message: endpoint.endsWith("/admins/email") ? "Le llega a todas las personas del equipo, incluido vos." : `Le llega a ${who}.`, confirmLabel: "Enviar mail" }))) return;
      setBusy(true); setStatus(null);
      const r = await api<{ sent?: number; failed?: number }>(endpoint, { body: { subject: String(f.get("subject")), body: String(f.get("body")) } });
      setBusy(false);
      if (!r.ok) return setStatus({ kind: "error", text: errText(r.data.error) });
      form.reset();
      setStatus({ kind: "ok", text: r.data.sent !== undefined ? `Enviado a ${r.data.sent} ${r.data.sent === 1 ? "persona" : "personas"}${r.data.failed ? ` (falló con ${r.data.failed})` : ""}.` : `Mail enviado a ${who}.` });
      onDone?.();
    }}>
      <Field label="Asunto" required>{(id) => <TextInput id={id} name="subject" required minLength={3} maxLength={150} />}</Field>
      <Field label="Mensaje" required hint="Texto simple. Se manda con el diseño de MiShowo.">{(id, d) => <TextArea id={id} aria-describedby={d} name="body" required minLength={5} maxLength={5000} rows={5} />}</Field>
      {status && <p role={status.kind === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${status.kind === "error" ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>{status.text}</p>}
      <Button type="submit" size="sm" disabled={busy}>{busy ? "Enviando…" : "Enviar mail"}</Button>
    </form>
  );
}

function MemberRow({ m, data, me, reload }: { m: Member; data: TeamData; me: { id: string }; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [role, setRole] = useState<Role>(m.role as Role);
  const [perms, setPerms] = useState<Permissions>({ ...m.permissions });
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const editable = m.role !== "owner" && m.id !== me.id;
  async function save() {
    const r = await api(`/admin/admins/${m.id}/permissions`, { method: "PUT", body: { role, permissions: perms } });
    if (r.ok) { setStatus({ kind: "ok", text: "Guardado. Ya rige: no hace falta que cierre sesión." }); reload(); }
    else setStatus({ kind: "error", text: errText(r.data.error) });
  }
  return (
    <li className="space-y-2 p-3 text-sm" data-testid="team-member">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong>{m.email}</strong>{m.name && <> ({m.name})</>} · {ROLE_LABEL[m.role] ?? m.role}{m.customPermissions && " · permisos a medida"} · 2FA {m.totpEnabled ? "activo" : "pendiente"} · último ingreso {when(m.lastLoginAt)}
        </span>
        {m.role !== "owner" && (
          <span className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" aria-expanded={mailOpen} onClick={() => setMailOpen((v) => !v)}>Enviar mail</Button>
            <Button size="sm" variant="outline" onClick={async () => { if (!(await confirmAction({ title: "¿Reenviar la invitación?", message: `Le mandamos un mail nuevo a ${m.email} y el enlace anterior deja de servir.`, confirmLabel: "Reenviar" }))) return; const r = await api<{ emailSent?: boolean }>(`/admin/admins/${m.id}/resend-invite`, { body: {} }); setStatus(r.ok ? { kind: "ok", text: r.data.emailSent ? "Le mandamos otra invitación (la anterior ya no sirve)." : "Se generó el enlace pero el envío de mails está apagado o falló." } : { kind: "error", text: errText(r.data.error) }); }}>Reenviar invitación</Button>
            {m.totpEnabled && m.id !== me.id && <Button size="sm" variant="outline" onClick={async () => { if (!(await confirmAction({ title: "¿Reiniciar el 2FA?", message: `A ${m.email} se le cierran las sesiones y al entrar configura uno nuevo.`, confirmLabel: "Reiniciar 2FA", danger: true }))) return; const r = await api(`/admin/admins/${m.id}/reset-2fa`, { body: {} }); setStatus(r.ok ? { kind: "ok", text: "2FA reiniciado: al volver a entrar va a configurar uno nuevo." } : { kind: "error", text: errText(r.data.error) }); if (r.ok) reload(); }}>Reiniciar 2FA</Button>}
          </span>
        )}
        {editable && (
          <span className="flex gap-1">
            <Button size="sm" variant="outline" aria-expanded={open} onClick={() => { setOpen((v) => !v); setStatus(null); setRole(m.role as Role); setPerms({ ...m.permissions }); }}>Permisos</Button>
            <Button size="sm" variant="ghost" onClick={async () => { if (!(await confirmAction({ title: "¿Quitar el acceso?", message: `${m.email} deja de ser parte del equipo y pierde el acceso al admin.`, confirmLabel: "Quitar acceso", danger: true }))) return; const r = await api(`/admin/admins/${m.id}`, { method: "DELETE" }); if (r.ok) reload(); else setStatus({ kind: "error", text: errText(r.data.error) }); }}>Quitar acceso</Button>
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{m.role === "owner" ? "Owner: tiene todo, y es la única persona que administra el equipo y los datos de cobro." : summary(m.permissions, data.areas)}</p>
      {mailOpen && m.role !== "owner" && <ComposeMail endpoint={`/admin/admins/${m.id}/email`} who={m.email} />}
      {open && editable && (
        <div className="space-y-3 rounded-xl bg-muted/30 p-3">
          <RoleAndPermissions data={data} role={role} setRole={setRole} perms={perms} setPerms={setPerms} name={`perm-${m.id}`} />
          <Button size="sm" onClick={() => void save()}>Guardar permisos</Button>
        </div>
      )}
      {status && <p role={status.kind === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${status.kind === "error" ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>{status.text}</p>}
    </li>
  );
}

/** Alta de una persona nueva (le creamos la cuenta y le mandamos un mail) o de una cuenta que ya existe, con sus permisos. */
function AddMember({ data, onDone }: { data: TeamData; onDone: () => void }) {
  const [existing, setExisting] = useState(false);
  const [role, setRole] = useState<Role>("support");
  const [perms, setPerms] = useState<Permissions>({ ...data.presets.support });
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  return (
    <form className="space-y-4 rounded-xl border p-4" data-testid="invite-form" onSubmit={async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const f = new FormData(form);
      const email = String(f.get("email"));
      if (!(await confirmAction({ title: existing ? "¿Dar acceso al equipo?" : "¿Crear la cuenta y mandar la invitación?", message: existing ? `${email} pasa a ser parte del equipo y va a tener que configurar el 2FA.` : `Le llega un mail a ${email} para elegir su contraseña.`, confirmLabel: existing ? "Dar acceso" : "Invitar" }))) return;
      const r = existing
        ? await api("/admin/admins", { body: { email, role, permissions: perms } })
        : await api<{ emailSent: boolean }>("/admin/admins/invite", { body: { name: String(f.get("name")), email, role, permissions: perms } });
      if (r.ok) {
        const sent = !existing && (r.data as { emailSent?: boolean }).emailSent;
        setStatus({ kind: "ok", text: existing ? "Listo: ya tiene acceso. Va a tener que volver a ingresar y configurar su 2FA." : sent ? "Listo: le llegó un mail para elegir su contraseña." : "Se creó la cuenta, pero el mail de invitación está apagado o falló. Pedile que use «Olvidé mi contraseña»." });
        form.reset(); setRole("support"); setPerms({ ...data.presets.support }); onDone();
      } else setStatus({ kind: "error", text: errText(r.data.error) });
    }}>
      <div>
        <h2 className="font-semibold">Sumar a una persona al equipo</h2>
        <p className="text-sm text-muted-foreground">
          {existing ? "Le damos acceso a una cuenta que ya existe." : "Le creamos la cuenta y le mandamos un mail para que elija su contraseña."} Al entrar al panel va a tener que configurar la verificación en dos pasos.
        </p>
      </div>
      <div className="flex gap-4 text-sm" role="radiogroup" aria-label="Tipo de alta">
        <label className="flex min-h-11 items-center gap-2"><input type="radio" name="kind" checked={!existing} onChange={() => setExisting(false)} className="size-5 accent-[var(--primary)]" />Persona nueva</label>
        <label className="flex min-h-11 items-center gap-2"><input type="radio" name="kind" checked={existing} onChange={() => setExisting(true)} className="size-5 accent-[var(--primary)]" />Cuenta que ya existe</label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {!existing && <Field label="Nombre" required>{(id) => <TextInput id={id} name="name" required minLength={2} maxLength={80} />}</Field>}
        <Field label="Email" required>{(id) => <TextInput id={id} name="email" type="email" required />}</Field>
      </div>
      <RoleAndPermissions data={data} role={role} setRole={setRole} perms={perms} setPerms={setPerms} name="perm-new" />
      {status && <p role={status.kind === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${status.kind === "error" ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>{status.text}</p>}
      <Button type="submit">{existing ? "Dar acceso" : "Invitar"}</Button>
    </form>
  );
}

// ───────────── Equipo (solo Owner) ─────────────
export function Team() {
  const me = useAdmin();
  const { data, error, reload } = useLoad<TeamData>("/admin/admins");
  return (
    <div className="space-y-6">
      <PageHeader title="Equipo" />
      <ul className="grid gap-3 sm:grid-cols-3" aria-label="Qué hace cada rol" data-testid="role-guide">
        {[["Owner", "Tiene todo. Es la única persona que administra el equipo y los datos de cobro."], ["Admin", "Gestiona casi todo (pagos, planes, negocios…) menos el equipo. Se le ajustan los permisos área por área."], ["Soporte", "Atiende consultas y denuncias y mira lo demás. No ve plata ni cambia planes."]].map(([r, d]) => (
          <li key={r} className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4"><strong className="block">{r}</strong><span className="text-sm text-muted-foreground">{d}</span></li>
        ))}
      </ul>
      <ErrorBox error={error} />
      {data && (
        <>
          <ul className="divide-y rounded-xl border" data-testid="team">
            {data.admins.map((m) => <MemberRow key={m.id} m={m} data={data} me={me} reload={reload} />)}
          </ul>
          <AddMember data={data} onDone={reload} />
          <section className="space-y-3 rounded-xl border p-4" aria-labelledby="mail-all-title" data-testid="mail-team">
            <div>
              <h2 id="mail-all-title" className="font-semibold">Mail a todo el equipo</h2>
              <p className="text-sm text-muted-foreground">Para avisos internos: un cambio de horario, una novedad, una reunión. Le llega a todas las personas del equipo, incluido vos.</p>
            </div>
            <ComposeMail endpoint="/admin/admins/email" who="el equipo" />
          </section>
        </>
      )}
    </div>
  );
}
