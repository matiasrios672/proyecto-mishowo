"use client";

import { useState } from "react";
import { TextInput } from "@/components/ui/fields";
import { parsePrice } from "@/lib/bulk";

/**
 * Campo numérico con formato argentino. Mientras se escribe conserva el texto tal cual ("1.", "1800,5")
 * y confirma el número en cada cambio válido; al salir muestra el valor normalizado.
 */
export function NumberInput({
  value, onChange, id, label, placeholder, integer = false,
}: {
  value: number | null; onChange: (v: number | null) => void; id?: string; label?: string; placeholder?: string; integer?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === null ? "" : String(value).replace(".", ","));
  return (
    <TextInput
      id={id} aria-label={label} inputMode={integer ? "numeric" : "decimal"} placeholder={placeholder} value={shown}
      onFocus={() => setText(value === null ? "" : String(value).replace(".", ","))}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        if (v.trim() === "") return onChange(null);
        const n = parsePrice(v);
        if (n !== null) onChange(integer ? Math.floor(n) : n);
      }}
      onBlur={() => setText(null)}
    />
  );
}
