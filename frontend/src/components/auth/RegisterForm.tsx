"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/fields";
import { api, authErrorMessage, safeNext, type PublicUser } from "@/lib/authClient";
import { FormError } from "./AuthShell";
import { setUser } from "./authStore";

export function RegisterForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const r = await api<{ user: PublicUser }>("/auth/register", {
      body: { email: String(f.get("email")), password: String(f.get("password")), name: String(f.get("name") ?? "") || undefined },
    });
    if (!r.ok) { setError(authErrorMessage(r.data.error)); setBusy(false); return; }
    setUser(r.data.user);
    router.push(next);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Tu nombre (opcional)">
        {(id) => <TextInput id={id} name="name" autoComplete="name" maxLength={80} />}
      </Field>
      <Field label="Email" required>
        {(id) => <TextInput id={id} name="email" type="email" autoComplete="email" required />}
      </Field>
      <Field label="Contraseña" required hint="Mínimo 8 caracteres">
        {(id, d) => <TextInput id={id} aria-describedby={d} name="password" type="password" autoComplete="new-password" minLength={8} required />}
      </Field>
      <FormError message={error} />
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Creando tu cuenta…" : "Crear mi cuenta"}</Button>
      <p className="text-center text-sm text-muted-foreground">
        ¿Preferís no usar contraseña? <Link className="underline" href={`/ingresar?next=${encodeURIComponent(next)}`}>Entrá con un enlace a tu email</Link>
      </p>
    </form>
  );
}
