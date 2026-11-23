"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/fields";
import { api, authErrorMessage, landingAfterLogin, type PublicUser } from "@/lib/authClient";
import { FormError, FormNotice } from "./AuthShell";
import { PasswordField } from "./PasswordField";
import { setUser } from "./authStore";

export function LoginForm() {
  const router = useRouter();
  const nextParam = useSearchParams().get("next");
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
      router.push(await landingAfterLogin(nextParam, r.data.user.role));
    } else {
      const r = await api("/auth/magic", { body: { email } });
      setBusy(false);
      if (!r.ok) return setError(authErrorMessage(r.data.error));
      setSentTo(email);
    }
  }

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Forma de ingresar" className="grid grid-cols-2 gap-1 rounded-xl bg-[#EAF4FC] p-1"
        onKeyDown={(e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); const m = mode === "password" ? "magic" : "password"; setMode(m); setError(null); setSentTo(null); document.getElementById(`tab-${m}`)?.focus(); } }}>
        {([["password", "Con contraseña"], ["magic", "Con un enlace al email"]] as const).map(([m, label]) => (
          <button key={m} id={`tab-${m}`} type="button" role="tab" aria-selected={mode === m} aria-controls="login-panel" tabIndex={mode === m ? 0 : -1}
            onClick={() => { setMode(m); setError(null); setSentTo(null); }}
            className={`min-h-11 rounded-lg px-2 text-[15px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${mode === m ? "bg-white text-[#2F6FB0] shadow-sm" : "text-[#47566A] hover:text-[#0E1B2C]"}`}>{label}</button>
        ))}
      </div>

      <div id="login-panel" role="tabpanel" aria-labelledby={`tab-${mode}`}>
      {sentTo ? (
        <FormNotice>Te mandamos un enlace a <strong>{sentTo}</strong>. Revisá tu casilla (y el spam): vale 15 minutos.</FormNotice>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Email" required>
            {(id) => <TextInput id={id} name="email" type="email" autoComplete="email" required />}
          </Field>
          {mode === "password" && (
            <PasswordField autoComplete="current-password" />
          )}
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Un momento…" : mode === "password" ? "Ingresar" : "Enviarme el enlace"}
          </Button>
          {mode === "password" && <p className="text-center text-[15px]"><Link className="font-semibold text-[#2F6FB0] " href="/recuperar">Olvidé mi contraseña</Link></p>}
        </form>
      )}
      </div>
    </div>
  );
}
