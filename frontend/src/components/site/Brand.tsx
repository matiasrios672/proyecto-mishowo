/* eslint-disable @next/next/no-img-element -- el logo ya sale del backend en WebP con srcset propio */
import type { CSSProperties } from "react";

/** Primera letra con contenido del nombre, para el fallback cuando no hay logo. */
export const initialOf = (name: string) => (name.trim().match(/[\p{L}\p{N}]/u)?.[0] ?? "•").toUpperCase();

/**
 * Marca del negocio: su logo o, sin logo, una inicial sobre el color del tema.
 * El logo va sobre una pastilla clara translúcida: un logo oscuro o con fondo transparente se lee igual en un tema oscuro.
 * `object-contain` + ancho máximo: sirve para logos cuadrados, redondos u horizontales sin deformarlos.
 */
export function Brand({ name, logo, logoSet, size = "md" }: { name: string; logo?: string | null; logoSet?: string | null; size?: "sm" | "md" | "lg" }) {
  const box = { sm: "h-9 max-w-[7.5rem]", md: "h-11 max-w-[9rem]", lg: "h-20 max-w-[14rem] @4xl:h-24" }[size];
  const initial = { sm: "size-9 text-base", md: "size-11 text-lg", lg: "size-20 text-3xl @4xl:size-24 @4xl:text-4xl" }[size];
  if (!logo)
    return (
      <span aria-hidden className={`site-display grid shrink-0 place-items-center rounded-2xl bg-primary font-bold text-primary-foreground ${initial}`}>
        {initialOf(name)}
      </span>
    );
  return (
    <span className={`inline-flex shrink-0 items-center rounded-2xl bg-white/85 p-1.5 shadow-sm ring-1 ring-black/5 backdrop-blur ${box}`} style={{ "--logo": 1 } as CSSProperties}>
      <img src={logo} srcSet={logoSet ?? undefined} sizes="224px" alt={`Logo de ${name || "el negocio"}`} decoding="async" className="size-full object-contain" />
    </span>
  );
}
