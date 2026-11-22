"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/fields";
import { api, authErrorMessage, safeNext, type PublicUser } from "@/lib/authClient";
import { FormError, FormNotice } from "./AuthShell";
import { setUser } from "./authStore";

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    setBusy(true);
    setError(null);
    if (mode === "password") {
      const r = await api<{ user: PublicUser }>("/auth/login", { body: { email, password: String(f.get("password")) } });
      if (!r.ok) { setError(authErrorMessage(r.data.error)); setBusy(false); return; }
      setUser(r.data.user);
      router.push(next);
    } else {
      const r = await api("/auth/magic", { body: { email } });
      setBusy(false);
      if (!r.ok) return setError(authErrorMessage(r.data.error));
      setSentTo(email);
    }
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Forma de ingresar" className="flex gap-2">
        {([["password", "Con contraseña"], ["magic", "Con un enlace al email"]] as const).map(([m, label]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); setSentTo(null); }}
            className={`rounded-full border px-3 py-1.5 text-sm ${mode === m ? "bg-primary text-primary-foreground" : ""}`}>{label}</button>
        ))}
      </div>

      {sentTo ? (
        <FormNotice>Te mandamos un enlace a <strong>{sentTo}</strong>. Revisá tu casilla (y el spam): vale 15 minutos.</FormNotice>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Email" required>
            {(id) => <TextInput id={id} name="email" type="email" autoComplete="email" required />}
          </Field>
          {mode === "password" && (
            <Field label="Contraseña" required>
              {(id) => <TextInput id={id} name="password" type="password" autoComplete="current-password" required />}
            </Field>
          )}
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Un momento…" : mode === "password" ? "Ingresar" : "Enviarme el enlace"}
          </Button>
          {mode === "password" && <p className="text-center text-sm"><Link className="underline" href="/recuperar">Olvidé mi contraseña</Link></p>}
        </form>
      )}
    </div>
  );
}
