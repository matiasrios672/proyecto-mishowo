"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextArea, TextInput } from "@/components/ui/fields";
import { api } from "@/lib/authClient";

export function ContactForm({ kind }: { kind: "arrepentimiento" | "contacto" }) {
  const [state, setState] = useState<{ kind: "idle" } | { kind: "sending" } | { kind: "done"; code: string } | { kind: "error"; message: string }>({ kind: "idle" });
  const withdraw = kind === "arrepentimiento";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState({ kind: "sending" });
    const r = await api<{ code: string }>("/public/contact", {
      body: {
        kind, name: String(f.get("name")), email: String(f.get("email")),
        ...(String(f.get("reference") ?? "").trim() ? { reference: String(f.get("reference")) } : {}),
        ...(String(f.get("message") ?? "").trim() ? { message: String(f.get("message")) } : {}),
      },
    });
    if (r.ok) return setState({ kind: "done", code: r.data.code });
    setState({
      kind: "error",
      message: r.status === 429 ? "Enviaste muchos pedidos seguidos. Esperá un minuto y probá de nuevo." : r.data.error === "invalid_request" ? "Revisá el nombre y el email: alguno no está bien escrito." : "No pudimos enviar el formulario. Probá de nuevo en un momento.",
    });
  }

  if (state.kind === "done")
    return (
      <div role="status" className="rounded-2xl bg-muted p-6" data-testid="contact-done">
        <p className="mk-display text-2xl font-bold">{withdraw ? "Recibimos tu solicitud" : "Recibimos tu consulta"}</p>
        <p className="mt-2 text-muted-foreground">Te mandamos un email de confirmación. Tu código de seguimiento es <strong className="text-foreground">{state.code}</strong>.</p>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Field label="Nombre y apellido" required>{(id) => <TextInput id={id} name="name" autoComplete="name" required maxLength={100} />}</Field>
      <Field label="Email" required hint="Te respondemos a este email">{(id, d) => <TextInput id={id} aria-describedby={d} name="email" type="email" autoComplete="email" required />}</Field>
      {withdraw && (
        <Field label="¿Qué querés cancelar?" hint="El email de tu cuenta, el link de tu página o el plan que contrataste">
          {(id, d) => <TextInput id={id} aria-describedby={d} name="reference" maxLength={200} />}
        </Field>
      )}
      <Field label={withdraw ? "Comentarios (opcional)" : "¿En qué te ayudamos?"} required={!withdraw}>
        {(id) => <TextArea id={id} name="message" rows={5} maxLength={1000} required={!withdraw} />}
      </Field>
      {state.kind === "error" && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{state.message}</p>}
      <Button type="submit" size="lg" disabled={state.kind === "sending"} className="bg-[#FC5502] font-bold text-[#0E1B2C] hover:bg-[#FF6A1F]">
        {state.kind === "sending" ? "Enviando…" : withdraw ? "Solicitar arrepentimiento" : "Enviar consulta"}
      </Button>
    </form>
  );
}
