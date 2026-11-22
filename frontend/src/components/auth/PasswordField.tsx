"use client";

import { useState } from "react";
import { Field, TextInput } from "@/components/ui/fields";
import { IconEye, IconEyeOff } from "@/components/marketing/Doodles";

/** Campo de contraseña con botón para mostrarla u ocultarla (ayuda a quien escribe desde el celular y a quien usa lector de pantalla). */
export function PasswordField({ label = "Contraseña", name = "password", hint, autoComplete, minLength }: {
  label?: string; name?: string; hint?: string; autoComplete: "current-password" | "new-password"; minLength?: number;
}) {
  const [shown, setShown] = useState(false);
  return (
    <Field label={label} required hint={hint}>
      {(id, d) => (
        <div className="relative">
          <TextInput id={id} aria-describedby={d} name={name} type={shown ? "text" : "password"} autoComplete={autoComplete} minLength={minLength} required className="pr-12" />
          <button type="button" aria-pressed={shown} aria-label={shown ? "Ocultar la contraseña" : "Mostrar la contraseña"} onClick={() => setShown((v) => !v)}
            className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-[#47566A] hover:bg-[#EAF4FC] focus-visible:outline-2 focus-visible:outline-ring">
            {shown ? <IconEyeOff className="size-5" /> : <IconEye className="size-5" />}
          </button>
        </div>
      )}
    </Field>
  );
}
