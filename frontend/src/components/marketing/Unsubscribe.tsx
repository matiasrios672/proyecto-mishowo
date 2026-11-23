"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/authClient";
import { Wordmark } from "@/components/brand/Wordmark";

/** Baja de novedades con el enlace firmado del mail. No pide ingresar: se confirma con un toque. */
export function Unsubscribe() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  return (
    <main className="mx-auto my-12 max-w-md space-y-5 rounded-3xl border border-[#D6E4F2] bg-white p-7 text-[#0E1B2C] shadow-[0_30px_60px_-35px_rgba(47,111,176,0.5)]">
      <Wordmark className="text-2xl" />
      {state === "done" ? (
        <>
          <h1 className="text-2xl font-bold">Listo, no te mandamos más novedades</h1>
          <p className="text-[#47566A]">Los avisos de tu cuenta (pagos, seguridad, pedidos) se siguen enviando porque son parte del servicio.</p>
          <Link href="/" className="inline-block font-semibold text-[#2F6FB0]">Volver a MiShowo</Link>
        </>
      ) : !token ? (
        <p role="alert">Este enlace está incompleto. Abrilo de nuevo desde el mail.</p>
      ) : (
        <>
          <h1 className="text-2xl font-bold">¿Querés dejar de recibir novedades?</h1>
          <p className="text-[#47566A]">Dejamos de mandarte promociones y noticias de MiShowo. Los avisos de tu cuenta siguen llegando.</p>
          {state === "error" && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">Este enlace no es válido o ya venció. Escribinos desde Contacto y lo resolvemos.</p>}
          <Button className="w-full" disabled={state === "busy"} onClick={async () => { setState("busy"); const r = await api("/public/unsubscribe", { body: { token } }); setState(r.ok ? "done" : "error"); }}>
            {state === "busy" ? "Un momento…" : "Sí, darme de baja"}
          </Button>
        </>
      )}
    </main>
  );
}
