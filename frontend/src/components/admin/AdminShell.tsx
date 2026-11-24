"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { LoadingScreen } from "@/components/brand/LoadingScreen";
import { Wordmark } from "@/components/brand/Wordmark";
import { AppShell, type NavGroup, type NavItem } from "@/components/brand/AppShell";
import { IconChart, IconCard, IconChat, IconEdit, IconFlag, IconHome, IconMail, IconSparkle, IconServer, IconShield, IconStore, IconTag, IconUsers } from "@/components/marketing/Doodles";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/fields";
import { api } from "@/lib/authClient";
import { logout } from "@/components/auth/authStore";
import { NotifBell, type NotifItem } from "@/components/brand/NotifBell";
import { AdminCommand } from "./AdminCommand";

import { allows, type AreaKey, type Level, type Permissions } from "@/lib/permissions";

export type AdminRole = "owner" | "admin" | "support";
interface Me { user: { id: string; email: string; role: AdminRole }; permissions: Permissions; totpEnabled: boolean; verified: boolean }
/** La persona del equipo y lo que puede hacer: `can(area, "manage")` para botones, `can(area)` para ver. El Owner puede todo. */
export type AdminUser = Me["user"] & { permissions: Permissions; can: (area: AreaKey, level?: Level) => boolean };
const Ctx = createContext<AdminUser | null>(null);
export const useAdmin = () => useContext(Ctx)!;

const ADMIN_GROUPS: { label: string; items: { href: string; label: string; Icon: NavItem["Icon"]; exact?: boolean; area?: AreaKey; ownerOnly?: boolean; badge?: "pay" | "ctc" | "rep"; keywords?: string }[] }[] = [
  { label: "Atención diaria", items: [
    { href: "/admin", label: "Resumen", Icon: IconHome, exact: true, keywords: "inicio panel hoy pendientes" },
    { href: "/admin/pagos", label: "Pagos", Icon: IconCard, area: "pagos", badge: "pay", keywords: "transferencia comprobante confirmar rechazar cobros" },
    { href: "/admin/consultas", label: "Consultas", Icon: IconChat, area: "consultas", badge: "ctc", keywords: "mensajes contacto formulario responder" },
    { href: "/admin/denuncias", label: "Denuncias", Icon: IconFlag, area: "denuncias", badge: "rep", keywords: "reportes moderación suspender" },
  ] },
  { label: "Clientes", items: [
    { href: "/admin/negocios", label: "Negocios", Icon: IconStore, area: "negocios", keywords: "tiendas comercios páginas link slug plan suspender" },
    { href: "/admin/usuarios", label: "Cuentas", Icon: IconUsers, area: "usuarios", keywords: "usuarios personas email bloquear equipo" },
    { href: "/admin/leads", label: "Leads", Icon: IconSparkle, area: "leads", keywords: "registrados sin publicar oportunidades retomar" },
  ] },
  { label: "Negocio", items: [
    { href: "/admin/estadisticas", label: "Estadísticas", Icon: IconChart, area: "negocios", keywords: "métricas embudo ingresos canales conversión" },
    { href: "/admin/planes", label: "Planes y precios", Icon: IconTag, area: "planes", keywords: "precios cobro alias cbu módulos límites" },
  ] },
  { label: "Contenido", items: [
    { href: "/admin/rubros", label: "Rubros", Icon: IconStore, area: "rubros", keywords: "industrias plantillas estilos" },
    { href: "/admin/contenido", label: "Contenido", Icon: IconEdit, area: "contenido", keywords: "aviso global preguntas frecuentes faq links reservados" },
    { href: "/admin/emails", label: "Emails", Icon: IconMail, area: "emails", keywords: "mails textos plantillas campañas prueba" },
  ] },
  { label: "Sistema", items: [
    { href: "/admin/admins", label: "Equipo", Icon: IconShield, ownerOnly: true, keywords: "permisos roles invitar soporte admin 2fa" },
    { href: "/admin/sistema", label: "Estado del sistema", Icon: IconServer, area: "sistema", keywords: "mantenimiento demos salud" },
    { href: "/admin/auditoria", label: "Auditoría", Icon: IconShield, area: "auditoria", keywords: "registro historial quién hizo qué" },
  ] },
];

/** Qué es cada pantalla y cómo usarla: se muestra bajo el título y se despliega con «¿Cómo se usa?». Editarlo acá no toca la lógica. */
const PAGE_HELP: Record<string, { about: string; steps?: string[] }> = {
  Resumen: { about: "Lo que necesita tu atención hoy y cómo viene el negocio.", steps: ["«Para atender» muestra lo urgente: tocá una tarjeta para ir directo.", "Los números de abajo se calculan solos.", "Si sos Owner, «Primeros pasos» te guía para dejar todo configurado."] },
  Estadísticas: { about: "Cómo se mueve MiShowo: de dónde llegan las personas, cuántas avanzan hasta publicar y pagar, ingresos y actividad de las páginas.", steps: ["Elegí el período arriba; cada número se compara con el período anterior de la misma duración.", "El embudo muestra en qué paso se cae la gente: ahí está la oportunidad.", "Canales de adquisición sale del utm_source del link: armá tus links como mishowo.com/?utm_source=instagram para medir cada campaña.", "Descargá los canales en CSV para armar tus informes."] },
  Negocios: { about: "Todos los negocios creados, con su plan y estado.", steps: ["Buscá por nombre o link y tocá un negocio para ver su ficha.", "Desde la ficha podés cambiar el plan, suspender o ver la página.", "Cada cambio queda en Auditoría."] },
  Cuentas: { about: "Las personas registradas: clientes y equipo. Para sumar o cambiar permisos del equipo andá a «Equipo».", steps: ["Usá los filtros para ver solo clientes, equipo, sin verificar o bloqueadas.", "Bloquear cierra todas sus sesiones al instante."] },
  Leads: { about: "Personas que se registraron pero todavía no publicaron: oportunidades para escribirles.", steps: ["El embudo muestra en qué paso se frenó cada una.", "«Escribirle» manda el mail de retomar (máximo uno cada 3 días)."] },
  Pagos: { about: "Pagos por transferencia que hay que confirmar o rechazar.", steps: ["Abrí el comprobante, compará el monto y confirmá.", "Al confirmar, el plan se activa y le llega un mail a la persona.", "Si no coincide, rechazá y escribile el motivo."] },
  "Planes y precios": { about: "Precios, límites y módulos de cada plan, y los datos para transferir.", steps: ["Editá un plan y guardá: los cambios se ven al instante en la landing.", "Los datos de cobro los ve cada cliente al pagar: revisalos con cuidado."] },
  Consultas: { about: "Mensajes que llegan desde el formulario de contacto de la landing.", steps: ["Respondé desde acá: queda registrado y se manda por mail."] },
  Denuncias: { about: "Páginas que alguien reportó.", steps: ["Revisá la página, anotá qué decidiste y suspendé si corresponde."] },
  Rubros: { about: "Los rubros que se ofrecen al crear una página: nombre, estilo inicial y visibilidad." },
  Contenido: { about: "Aviso global, preguntas frecuentes y links reservados, sin tocar código.", steps: ["El aviso aparece arriba de la landing.", "Si cargás preguntas frecuentes, reemplazan a las de fábrica."] },
  Emails: { about: "Textos de los mails automáticos, avisos y campañas.", steps: ["Probá cada mail con «Enviar prueba» antes de guardar cambios."] },
  "Estado del sistema": { about: "Si todo funciona, modo mantenimiento y los negocios de ejemplo de la landing." },
  Auditoría: { about: "Registro de quién hizo qué en el admin. No se puede editar." },
  Equipo: { about: "Quiénes trabajan en MiShowo y qué puede hacer cada persona, área por área. Solo el Owner lo administra.", steps: ["Sumá a alguien abajo: le crea la cuenta y le llega un mail para elegir su contraseña.", "En cada persona: «Permisos» ajusta lo que ve y gestiona; «Enviar mail» le escribe; «Reenviar invitación» si perdió el mail; «Reiniciar 2FA» si perdió su app.", "«Mail a todo el equipo» manda un aviso a todos a la vez."] },
};

/** Título de cada pantalla del admin, con una explicación corta y una guía plegable. */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  const help = PAGE_HELP[title === "Usuarios" ? "Cuentas" : title];
  return (
    <header className="space-y-2 border-b border-[#E5E8EF] pb-5">
      <h1>{title}</h1>
      {help && <p className="max-w-[68ch] text-muted-foreground">{help.about}</p>}
      {help?.steps && (
        <details className="group max-w-[68ch] text-sm" data-testid="page-help">
          <summary className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg font-semibold text-[#C73E00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">¿Cómo se usa?</summary>
          <ol className="mt-2 list-decimal space-y-1.5 rounded-2xl border border-[#E5E8EF] bg-white py-4 pl-9 pr-5 shadow-sm">{help.steps.map((t) => <li key={t}>{t}</li>)}</ol>
        </details>
      )}
      {children}
    </header>
  );
}

const CODE_ERR: Record<string, string> = { invalid_code: "Ese código no es correcto o venció. Probá con el que muestra ahora tu app.", rate_limited: "Demasiados intentos. Esperá un minuto." };

function Box({ children }: { children: ReactNode }) {
  return <main className="mx-auto my-10 max-w-md space-y-5 rounded-3xl border border-[#E5E7EB] bg-white p-7 shadow-[0_30px_60px_-35px_rgba(252,85,2,0.5)] sm:my-16"><Wordmark className="text-2xl" />{children}</main>;
}

function CodeForm({ label, button, onSubmit }: { label: string; button: string; onSubmit: (code: string) => Promise<string | null> }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(await onSubmit(code)); setBusy(false); }}>
      <Field label={label}>{(id) => <TextInput id={id} inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />}</Field>
      {err && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{err}</p>}
      <Button type="submit" disabled={busy || code.length !== 6} className="w-full">{busy ? "Verificando…" : button}</Button>
    </form>
  );
}

function Setup2fa({ onDone }: { onDone: () => void }) {
  const [info, setInfo] = useState<{ secret: string; otpauthUrl: string; qr: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function start() {
    const r = await api<{ secret: string; otpauthUrl: string }>("/admin/2fa/setup", { body: {} });
    if (!r.ok) return setErr(r.data.error === "admin_not_configured" ? "El servidor todavía no tiene configurada la clave de seguridad del admin (ADMIN_SECRET_KEY)." : "No pudimos preparar el código. Probá de nuevo.");
    setInfo({ ...r.data, qr: await QRCode.toDataURL(r.data.otpauthUrl, { margin: 1, width: 220 }) });
  }
  return (
    <Box>
      <h1 className="text-2xl font-bold">Activá la verificación en dos pasos</h1>
      <p className="text-muted-foreground">Para entrar al panel de administración es obligatoria. Vas a necesitar una app como Google Authenticator, Authy o 1Password.</p>
      {err && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{err}</p>}
      {!info ? <Button onClick={() => void start()} data-testid="setup-start">Generar mi código</Button> : (
        <div className="space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={info.qr} alt="Código QR para la app de autenticación" width={220} height={220} className="mx-auto rounded-lg border" />
          <p className="text-sm">¿No podés escanear? Escribí esta clave en tu app:</p>
          <p className="break-all rounded-lg bg-muted p-3 font-mono text-sm" data-testid="totp-secret">{info.secret}</p>
          <CodeForm label="Código de 6 dígitos de tu app" button="Activar" onSubmit={async (code) => {
            const r = await api("/admin/2fa/enable", { body: { code } });
            if (r.ok) { onDone(); return null; }
            return CODE_ERR[r.data.error ?? ""] ?? "No pudimos activarlo. Probá de nuevo.";
          }} />
        </div>
      )}
    </Box>
  );
}

/** Puerta del admin: sesión, rol de administración y segundo factor. Solo muestra el panel con todo en regla. */
/** Pagos, consultas y denuncias que esperan al equipo (lo mismo que «Para atender» del Resumen). */
async function loadAdminAlerts(): Promise<NotifItem[]> {
  const r = await api<{ alerts: { pendingPayments: number; stalePayments: number; newContacts?: number; newReports: number } }>("/admin/dashboard");
  if (!r.ok) return [];
  const a = r.data.alerts;
  return [
    { id: "pay", label: "Pagos para confirmar", n: a.pendingPayments, href: "/admin/pagos", tone: a.stalePayments > 0 ? "alert" : "info" },
    { id: "ctc", label: "Consultas sin responder", n: a.newContacts ?? 0, href: "/admin/consultas" },
    { id: "rep", label: "Denuncias nuevas", n: a.newReports, href: "/admin/denuncias", tone: "alert" },
  ];
}

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [me, setMe] = useState<Me | null | "denied" | "anon">(null);
  const [tick, setTick] = useState(0);
  const [counts, setCounts] = useState<{ pay: number; ctc: number; rep: number } | null>(null);

  useEffect(() => {
    let alive = true;
    api<Me>("/admin/me").then((r) => { if (alive) setMe(r.ok ? r.data : r.status === 401 ? "anon" : "denied"); });
    return () => { alive = false; };
  }, [tick]);

  // Contadores de pendientes junto a Pagos, Consultas y Denuncias: se vuelven a leer al cambiar de pantalla.
  useEffect(() => {
    if (me === null || me === "anon" || me === "denied") return;
    let alive = true;
    api<{ alerts: { pendingPayments: number; newContacts?: number; newReports: number } }>("/admin/dashboard").then((r) => { if (alive && r.ok) setCounts({ pay: r.data.alerts.pendingPayments, ctc: r.data.alerts.newContacts ?? 0, rep: r.data.alerts.newReports }); });
    return () => { alive = false; };
  }, [me, path]);

  useEffect(() => { if (me === "anon") router.replace(`/ingresar?next=${encodeURIComponent(path)}`); }, [me, path, router]);

  if (me === null || me === "anon") return <LoadingScreen message="Cargando la administración…" />;
  if (me === "denied") return <Box><h1 className="text-2xl font-bold">No tenés acceso</h1><p className="text-muted-foreground">Esta sección es solo para el equipo de MiShowo.</p><Link href="/" className="">Volver al inicio</Link></Box>;
  if (!me.totpEnabled) return <Setup2fa onDone={() => setTick((n) => n + 1)} />;
  if (!me.verified)
    return (
      <Box>
        <h1 className="text-2xl font-bold">Verificación en dos pasos</h1>
        <p className="text-muted-foreground">Ingresá el código que muestra tu app de autenticación.</p>
        <CodeForm label="Código de 6 dígitos" button="Entrar al panel" onSubmit={async (code) => {
          const r = await api("/admin/2fa/verify", { body: { code } });
          if (r.ok) { setTick((n) => n + 1); return null; }
          return r.status === 429 ? CODE_ERR.rate_limited! : CODE_ERR[r.data.error ?? ""] ?? "No pudimos verificarlo.";
        }} />
      </Box>
    );

  const role = me.user.role;
  const roleLabel = role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Soporte";
  const can = (area?: AreaKey, level: Level = "view") => role === "owner" || !area || allows(me.permissions, area, level);
  const admin: AdminUser = { ...me.user, permissions: me.permissions, can };
  const badgeOf = (k?: "pay" | "ctc" | "rep") => (k && counts ? counts[k] : 0) || undefined;
  const groups: NavGroup[] = ADMIN_GROUPS.map((g) => ({ label: g.label, items: g.items.filter((n) => (n.ownerOnly ? role === "owner" : can(n.area))).map(({ href, label, Icon, exact, badge }) => ({ href, label, Icon, exact, badge: badgeOf(badge) })) })).filter((g) => g.items.length > 0);
  const commandItems = ADMIN_GROUPS.flatMap((g) => g.items.filter((n) => (n.ownerOnly ? role === "owner" : can(n.area))).map((n) => ({ href: n.href, label: n.label, group: g.label, keywords: n.keywords })));
  return (
    <Ctx.Provider value={admin}>
      <AppShell groups={groups} areaLabel="Administración" homeHref="/admin" userLabel={`${me.user.email} · ${roleLabel}`} onLogout={async () => { await logout(); router.replace("/ingresar"); }} topLeft={<AdminCommand items={commandItems} canBusinesses={can("negocios")} />} bell={(side) => <NotifBell load={loadAdminAlerts} side={side} empty="Todo al día: no hay pagos, consultas ni denuncias esperando." />}>
        {children}
      </AppShell>
    </Ctx.Provider>
  );
}

export function Pager({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <nav aria-label="Páginas" className="mt-4 flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{total} en total</span>
      <span className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</Button>
        <span>Página {page} de {pages}</span>
        <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>Siguiente</Button>
      </span>
    </nav>
  );
}

export const Money = (n: number) => `$ ${n.toLocaleString("es-AR")}`;
export function ErrorBox({ error }: { error: string | null }) {
  return error ? <p role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null;
}
export const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—");
