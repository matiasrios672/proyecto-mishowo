import type { Draft } from "./draft";

export const LAYOUTS = [
  { id: "vidriera", name: "Vidriera", blurb: "Fotos grandes. Ideal para pocos productos que se lucen." },
  { id: "mostrador", name: "Mostrador", blurb: "Lista compacta. Ideal para catálogos largos o comidas." },
  { id: "grilla", name: "Grilla", blurb: "Tienda de a dos columnas. Ideal para ropa y accesorios." },
  { id: "servicios", name: "Servicios", blurb: "Tarjetas con descripción. Ideal para servicios y turnos." },
] as const;

export type LayoutId = (typeof LAYOUTS)[number]["id"];

const SERVICE_INDUSTRIES = new Set(["gimnasio", "oficios", "belleza", "salud", "otro-servicios"]);

/** Recomendación según rubro y cantidad/tipo de productos. Es solo una sugerencia, no cambia nada sola. */
export function recommendLayout(d: Draft): LayoutId {
  const products = d.categories.flatMap((c) => c.products);
  if (SERVICE_INDUSTRIES.has(d.industryId)) return "servicios";
  if (products.length > 20) return "mostrador";
  const withOptions = products.filter((p) => p.options.length > 0).length;
  if (d.industryId === "ropa" || (products.length >= 4 && withOptions / products.length >= 0.5)) return "grilla";
  return products.length <= 12 ? "vidriera" : "mostrador";
}

export const THEME_SUGGESTION_NOTE = "Podés cambiar el diseño cuando quieras: no se pierde nada de lo que cargaste.";
