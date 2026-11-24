"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/fields";
import { api, authErrorMessage, safeNext, type PublicUser } from "@/lib/authClient";
import { FormError } from "./AuthShell";
import { PasswordField } from "./PasswordField";
import { setUser } from "./authStore";
import { readRef, readSource } from "@/components/marketing/SourceCapture";

export function RegisterForm({ onDone, nameRequired = false }: { onDone?: () => void; nameRequired?: boolean } = {}) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (nameRequired && !String(f.get("name") ?? "").trim()) { setError("Contanos tu nombre para armar tu cuenta."); return; }
    setBusy(true);
    setError(null);
    const r = await api<{ user: PublicUser }>("/auth/register", {
      body: { email: String(f.get("email")), password: String(f.get("password")), name: String(f.get("name") ?? "") || undefined, source: readSource(), ref: readRef() },
    });
    if (!r.ok) { setError(authErrorMessage(r.data.error)); setBusy(false); return; }
    setUser(r.data.user);
    if (onDone) onDone(); else router.push(next);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label={nameRequired ? "Tu nombre" : "Tu nombre (opcional)"} required={nameRequired}>
        {(id) => <TextInput id={id} name="name" autoComplete="name" maxLength={80} required={nameRequired} />}
      </Field>
      <Field label="Email" required>
        {(id) => <TextInput id={id} name="email" type="email" autoComplete="email" required />}
      </Field>
      <PasswordField autoComplete="new-password" minLength={8} hint="Mínimo 8 caracteres" />
      <FormError message={error} />
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Creando tu cuenta…" : "Crear mi cuenta"}</Button>
      <p className="text-center text-[15px] text-[#47566A]">
        ¿Preferís no usar contraseña? <Link className="font-semibold text-[#C73E00] " href={`/ingresar?next=${encodeURIComponent(onDone ? "/crear" : next)}`}>Entrá con un enlace a tu email</Link>
      </p>
    </form>
  );
}
