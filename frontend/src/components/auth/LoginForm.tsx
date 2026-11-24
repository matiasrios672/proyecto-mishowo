"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/fields";
import { api, authErrorMessage, landingAfterLogin, type PublicUser } from "@/lib/authClient";
import { FormError, FormNotice } from "./AuthShell";
import { PasswordField } from "./PasswordField";
import { setUser, useUser } from "./authStore";

export function LoginForm() {
  const router = useRouter();
  const nextParam = useSearchParams().get("next");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const user = useUser();

  // Una sola puerta para todos: con la sesión iniciada, cada cuenta va a lo suyo según su rol
  // (el equipo de MiShowo a la administración; un negocio a su panel o, si todavía no armó su página, al editor).
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void landingAfterLogin(nextParam, user.role).then((to) => { if (alive) router.replace(to); });
    return () => { alive = false; };
  }, [user, nextParam, router]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    setBusy(true);
    setError(null);
    if (mode === "password") {
      const r = await api<{ user: PublicUser }>("/auth/login", { body: { email, password: String(f.get("password")) } });
      if (!r.ok) { setError(authErrorMessage(r.data.error)); setBusy(false); return; }
      setUser(r.data.user); // el efecto de arriba lleva a cada cuenta a su lugar
    } else {
      const r = await api("/auth/magic", { body: { email } });
      setBusy(false);
      if (!r.ok) return setError(authErrorMessage(r.data.error));
      setSentTo(email);
    }
  }

  if (user) return <p role="status" className="flex items-center gap-3 py-6 text-[#0E1B2C]" data-testid="login-redirect"><span aria-hidden className="size-5 rounded-full border-2 border-[#F5D9C8] border-t-[#C73E00] motion-safe:animate-spin" />Entrando a tu panel…</p>;

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Forma de ingresar" className="grid grid-cols-2 gap-1 rounded-xl bg-[#FFEFE6] p-1"
        onKeyDown={(e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); const m = mode === "password" ? "magic" : "password"; setMode(m); setError(null); setSentTo(null); document.getElementById(`tab-${m}`)?.focus(); } }}>
        {([["password", "Con contraseña"], ["magic", "Con un enlace al email"]] as const).map(([m, label]) => (
          <button key={m} id={`tab-${m}`} type="button" role="tab" aria-selected={mode === m} aria-controls="login-panel" tabIndex={mode === m ? 0 : -1}
            onClick={() => { setMode(m); setError(null); setSentTo(null); }}
            className={`min-h-11 rounded-lg px-2 text-[15px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${mode === m ? "bg-white text-[#C73E00] shadow-sm" : "text-[#47566A] hover:text-[#0E1B2C]"}`}>{label}</button>
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
          {mode === "password" && <p className="text-center text-[15px]"><Link className="font-semibold text-[#C73E00] " href="/recuperar">Olvidé mi contraseña</Link></p>}
        </form>
      )}
      </div>
    </div>
  );
}
