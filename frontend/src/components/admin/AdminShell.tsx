"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/fields";
import { api } from "@/lib/authClient";
import { logout } from "@/components/auth/authStore";

export type AdminRole = "owner" | "admin" | "support";
interface Me { user: { id: string; email: string; role: AdminRole }; totpEnabled: boolean; verified: boolean }
const Ctx = createContext<Me["user"] | null>(null);
export const useAdmin = () => useContext(Ctx)!;

const NAV: { href: string; label: string; roles?: AdminRole[] }[] = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/pagos", label: "Pagos", roles: ["owner", "admin"] },
  { href: "/admin/negocios", label: "Negocios" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/planes", label: "Planes", roles: ["owner", "admin"] },
  { href: "/admin/auditoria", label: "Auditoría", roles: ["owner", "admin"] },
  { href: "/admin/admins", label: "Equipo", roles: ["owner"] },
];

const CODE_ERR: Record<string, string> = { invalid_code: "Ese código no es correcto o venció. Probá con el que muestra ahora tu app.", rate_limited: "Demasiados intentos. Esperá un minuto." };

function Box({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-md space-y-5 p-6 pt-16"><Wordmark />{children}</main>;
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
  if (me === "denied") return <Box><h1 className="text-2xl font-bold">No tenés acceso</h1><p className="text-muted-foreground">Esta sección es solo para el equipo de MiShowo.</p><Link href="/" className="underline">Volver al inicio</Link></Box>;
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
  return (
    <Ctx.Provider value={me.user}>
      <div className="mx-auto flex min-h-dvh max-w-7xl flex-col px-4 sm:px-6">
        <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b py-3">
          <Link href="/admin" aria-label="Administración de MiShowo"><Wordmark /></Link>
          <nav aria-label="Administración" className="flex flex-wrap gap-1">
            {NAV.filter((n) => !n.roles || n.roles.includes(role)).map((n) => (
              <Link key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined}
                className={`rounded-full px-3 py-1.5 text-sm ${path === n.href ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{n.label}</Link>
            ))}
          </nav>
          <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span>{me.user.email} · {role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Soporte"}</span>
            <button type="button" className="rounded-md px-2 py-1 hover:bg-muted" onClick={async () => { await logout(); router.replace("/ingresar"); }}>Salir</button>
          </span>
        </header>
        <div className="flex-1 py-6">{children}</div>
      </div>
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
