"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Wordmark } from "@/components/brand/Wordmark";
import { AppShell, type NavGroup, type NavItem } from "@/components/brand/AppShell";
import { IconCard, IconChat, IconEdit, IconFlag, IconHome, IconMail, IconSparkle, IconServer, IconShield, IconStore, IconTag, IconUsers } from "@/components/marketing/Doodles";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/fields";
import { api } from "@/lib/authClient";
import { logout } from "@/components/auth/authStore";

export type AdminRole = "owner" | "admin" | "support";
interface Me { user: { id: string; email: string; role: AdminRole }; totpEnabled: boolean; verified: boolean }
const Ctx = createContext<Me["user"] | null>(null);
export const useAdmin = () => useContext(Ctx)!;

const ADMIN_GROUPS: { label: string; items: { href: string; label: string; Icon: NavItem["Icon"]; exact?: boolean; roles?: AdminRole[] }[] }[] = [
  { label: "General", items: [
    { href: "/admin", label: "Resumen", Icon: IconHome, exact: true },
    { href: "/admin/pagos", label: "Pagos", Icon: IconCard, roles: ["owner", "admin"] },
    { href: "/admin/negocios", label: "Negocios", Icon: IconStore },
    { href: "/admin/leads", label: "Leads", Icon: IconSparkle },
    { href: "/admin/usuarios", label: "Usuarios", Icon: IconUsers },
  ] },
  { label: "Moderación y contenido", items: [
    { href: "/admin/consultas", label: "Consultas", Icon: IconChat },
    { href: "/admin/denuncias", label: "Denuncias", Icon: IconFlag },
    { href: "/admin/emails", label: "Emails", Icon: IconMail },
    { href: "/admin/contenido", label: "Contenido", Icon: IconEdit },
    { href: "/admin/rubros", label: "Rubros", Icon: IconStore },
    { href: "/admin/planes", label: "Planes", Icon: IconTag, roles: ["owner", "admin"] },
  ] },
  { label: "Sistema", items: [
    { href: "/admin/sistema", label: "Estado", Icon: IconServer },
    { href: "/admin/auditoria", label: "Auditoría", Icon: IconShield, roles: ["owner", "admin"] },
    { href: "/admin/admins", label: "Equipo", Icon: IconUsers, roles: ["owner"] },
  ] },
];

const CODE_ERR: Record<string, string> = { invalid_code: "Ese código no es correcto o venció. Probá con el que muestra ahora tu app.", rate_limited: "Demasiados intentos. Esperá un minuto." };

function Box({ children }: { children: ReactNode }) {
  return <main className="mx-auto my-10 max-w-md space-y-5 rounded-3xl border border-[#D6E4F2] bg-white p-7 shadow-[0_30px_60px_-35px_rgba(47,111,176,0.5)] sm:my-16"><Wordmark className="text-2xl" />{children}</main>;
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
export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [me, setMe] = useState<Me | null | "denied" | "anon">(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    api<Me>("/admin/me").then((r) => { if (alive) setMe(r.ok ? r.data : r.status === 401 ? "anon" : "denied"); });
    return () => { alive = false; };
  }, [tick]);

  useEffect(() => { if (me === "anon") router.replace(`/ingresar?next=${encodeURIComponent(path)}`); }, [me, path, router]);

  if (me === null || me === "anon") return <main className="p-6 text-muted-foreground">Cargando…</main>;
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
  const can = (roles?: AdminRole[]) => !roles || roles.includes(role);
  const groups: NavGroup[] = ADMIN_GROUPS.map((g) => ({ label: g.label, items: g.items.filter((n) => can(n.roles)).map(({ href, label, Icon, exact }) => ({ href, label, Icon, exact })) })).filter((g) => g.items.length > 0);
  return (
    <Ctx.Provider value={me.user}>
      <AppShell groups={groups} areaLabel="Administración" homeHref="/admin" userLabel={`${me.user.email} · ${roleLabel}`} onLogout={async () => { await logout(); router.replace("/ingresar"); }}>
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
