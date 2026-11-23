"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/ui/fields";
import { api } from "@/lib/authClient";
import { sameAs, type AreaInfo, type Level, type Permissions } from "@/lib/permissions";
import { ErrorBox, useAdmin, when } from "./AdminShell";
import { msg, useLoad } from "./AdminPages";

type Role = "admin" | "support";
interface Member { id: string; email: string; name: string | null; role: string; totpEnabled: boolean; lastLoginAt: string | null; permissions: Permissions; customPermissions: boolean }
interface TeamData { admins: Member[]; areas: AreaInfo[]; presets: Record<Role, Permissions> }

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", support: "Soporte" };
const TEAM_ERR: Record<string, string> = { already_member: "Esa persona ya es parte del equipo.", is_owner: "Esa persona es Owner: tiene todo y no se le cambian los permisos." };
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

function MemberRow({ m, data, me, reload }: { m: Member; data: TeamData; me: { id: string }; reload: () => void }) {
  const [open, setOpen] = useState(false);
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
        {editable && (
          <span className="flex gap-1">
            <Button size="sm" variant="outline" aria-expanded={open} onClick={() => { setOpen((v) => !v); setStatus(null); setRole(m.role as Role); setPerms({ ...m.permissions }); }}>Permisos</Button>
            <Button size="sm" variant="ghost" onClick={async () => { const r = await api(`/admin/admins/${m.id}`, { method: "DELETE" }); if (r.ok) reload(); else setStatus({ kind: "error", text: errText(r.data.error) }); }}>Quitar acceso</Button>
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{m.role === "owner" ? "Owner: tiene todo, y es la única persona que administra el equipo y los datos de cobro." : summary(m.permissions, data.areas)}</p>
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
      <h1 className="text-2xl font-bold">Equipo</h1>
      <p className="max-w-[64ch] text-muted-foreground">Sumá personas y elegí qué puede hacer cada una, área por área. Solo vos (Owner) administrás el equipo y los datos de cobro.</p>
      <ErrorBox error={error} />
      {data && (
        <>
          <ul className="divide-y rounded-xl border" data-testid="team">
            {data.admins.map((m) => <MemberRow key={m.id} m={m} data={data} me={me} reload={reload} />)}
          </ul>
          <AddMember data={data} onDone={reload} />
        </>
      )}
    </div>
  );
}
