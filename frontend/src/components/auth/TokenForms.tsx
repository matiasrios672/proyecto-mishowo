"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/fields";
import { api, authErrorMessage, type PublicUser } from "@/lib/authClient";
import { FormError, FormNotice } from "./AuthShell";
import { refreshUser, setUser } from "./authStore";

export function ForgotForm() {
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email"));
    setBusy(true);
    setError(null);
    const r = await api("/auth/forgot", { body: { email } });
    setBusy(false);
    if (!r.ok) return setError(authErrorMessage(r.data.error));
    setSent(email);
  }

  if (sent) return <FormNotice>Si <strong>{sent}</strong> tiene una cuenta, te mandamos un enlace para elegir una contraseña nueva. Vale 1 hora.</FormNotice>;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Email" required>{(id) => <TextInput id={id} name="email" type="email" autoComplete="email" required />}</Field>
      <FormError message={error} />
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Enviando…" : "Enviarme el enlace"}</Button>
    </form>
  );
}

export function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api("/auth/reset", { body: { token, password: String(new FormData(e.currentTarget).get("password")) } });
    setBusy(false);
    if (!r.ok) return setError(authErrorMessage(r.data.error));
    setUser(null); // el servidor cerró todas las sesiones
    setDone(true);
  }

  if (!token) return <FormError message={authErrorMessage("invalid_token")} />;
  if (done) return (
    <div className="space-y-3">
      <FormNotice>Listo, ya cambiaste tu contraseña. Por seguridad cerramos tus otras sesiones.</FormNotice>
      <Button render={<Link href="/ingresar" />} size="lg" className="w-full">Ingresar</Button>
    </div>
  );
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Contraseña nueva" required hint="Mínimo 8 caracteres">
        {(id, d) => <TextInput id={id} aria-describedby={d} name="password" type="password" autoComplete="new-password" minLength={8} required />}
      </Field>
      <FormError message={error} />
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Guardando…" : "Guardar contraseña"}</Button>
    </form>
  );
}

/** Confirma el email al abrir el enlace. Se hace con POST desde la página: los escáneres de links de los mails no lo gastan. */
export function VerifyEmail() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"working" | "ok" | "error">(token ? "working" : "error");

  useEffect(() => {
    if (!token) return;
    let alive = true;
    api("/auth/verify", { body: { token } }).then((r) => {
      if (!alive) return;
      setState(r.ok ? "ok" : "error");
      if (r.ok) void refreshUser();
    });
    return () => { alive = false; };
  }, [token]);

  if (state === "working") return <p role="status" className="text-muted-foreground">Confirmando tu email…</p>;
  if (state === "error") return (
    <div className="space-y-3">
      <FormError message={authErrorMessage("invalid_token")} />
      <p className="text-sm">Ingresá a tu cuenta y pedí un enlace nuevo desde el editor.</p>
      <Button render={<Link href="/ingresar" />} variant="outline">Ingresar</Button>
    </div>
  );
  return (
    <div className="space-y-3">
      <FormNotice>¡Listo! Tu email quedó confirmado.</FormNotice>
      <Button render={<Link href="/editor" />} size="lg" className="w-full">Ir a mi página</Button>
    </div>
  );
}

/** El enlace mágico exige un clic: así un escáner que abra el link no gasta el acceso. */
export function MagicConsume() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [error, setError] = useState<string | null>(token ? null : authErrorMessage("invalid_token"));
  const [busy, setBusy] = useState(false);

  async function enter() {
    setBusy(true);
    const r = await api<{ user: PublicUser }>("/auth/magic/consume", { body: { token } });
    if (!r.ok) { setError(authErrorMessage(r.data.error)); setBusy(false); return; }
    setUser(r.data.user);
    router.push("/editor");
  }

  if (error) return (
    <div className="space-y-3">
      <FormError message={error} />
      <Button render={<Link href="/ingresar" />} variant="outline">Pedir otro enlace</Button>
    </div>
  );
  return <Button size="lg" className="w-full" onClick={enter} disabled={busy}>{busy ? "Entrando…" : "Entrar a MiShowo"}</Button>;
}
