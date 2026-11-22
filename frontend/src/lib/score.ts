// Checklist de publicación y score de calidad ("Tu página está al 80%").
import type { Draft } from "./draft";
import { isValidWhatsapp } from "./whatsapp";

export type EditorTab = "negocio" | "textos" | "fotos" | "productos" | "pedidos" | "diseno" | "seo" | "publicar";

export interface ChecklistItem {
  id: string;
  label: string;       // lo que ve la persona cuando está pendiente
  doneLabel: string;
  required: boolean;   // bloquea la publicación
  weight: number;
  done: boolean;
  tab: EditorTab;      // a dónde lleva el botón "Completar"
}

const realProducts = (d: Draft) => d.categories.flatMap((c) => c.products).filter((p) => !p.isExample && p.name.trim());

export function buildChecklist(d: Draft): ChecklistItem[] {
  const products = realProducts(d);
  const priced = products.filter((p) => p.price !== null).length;
  const anyHours = d.hours.some((h) => h.open);
  return [
    { id: "name", required: true, weight: 15, tab: "negocio", done: !d.nameIsExample && d.name.trim().length >= 2,
      label: "Poné el nombre de tu negocio", doneLabel: "Nombre del negocio" },
    { id: "whatsapp", required: true, weight: 20, tab: "negocio", done: isValidWhatsapp(d.whatsapp),
      label: "Agregá tu WhatsApp para recibir pedidos", doneLabel: "WhatsApp cargado" },
    { id: "products", required: true, weight: 20, tab: "productos", done: products.length >= 1,
      label: "Cargá al menos un producto o servicio tuyo", doneLabel: "Productos propios cargados" },
    { id: "texts", required: false, weight: 10, tab: "textos", done: !d.textsAreExample && d.description.trim().length >= 30,
      label: "Escribí una descripción de tu negocio (mínimo 30 letras)", doneLabel: "Descripción propia" },
    { id: "prices", required: false, weight: 10, tab: "productos", done: products.length > 0 && priced === products.length,
      label: products.length > 0 ? `Poné precio a ${products.length - priced} producto${products.length - priced === 1 ? "" : "s"}` : "Poné precio a tus productos",
      doneLabel: "Todos los productos con precio" },
    { id: "three", required: false, weight: 10, tab: "productos", done: products.length >= 3,
      label: `Sumá ${Math.max(0, 3 - products.length)} producto${3 - products.length === 1 ? "" : "s"} más (con 3 o más se ve mejor)`, doneLabel: "3 o más productos" },
    { id: "hours", required: false, weight: 5, tab: "negocio", done: anyHours,
      label: "Cargá tus horarios", doneLabel: "Horarios cargados" },
    { id: "where", required: false, weight: 5, tab: "negocio", done: d.deliveryZone.trim().length > 0 || d.address.trim().length > 0,
      label: "Contá dónde retiran o entregás", doneLabel: "Zona de entrega o dirección" },
    { id: "instagram", required: false, weight: 5, tab: "negocio", done: d.instagram.trim().length > 0,
      label: "Agregá tu Instagram", doneLabel: "Instagram" },
  ];
}

export interface Quality {
  score: number;            // 0..100
  items: ChecklistItem[];
  missingRequired: ChecklistItem[];
  canPublish: boolean;
  tip: string | null;       // el próximo paso más valioso
}

export function quality(d: Draft): Quality {
  const items = buildChecklist(d);
  const total = items.reduce((s, i) => s + i.weight, 0);
  const got = items.filter((i) => i.done).reduce((s, i) => s + i.weight, 0);
  const missingRequired = items.filter((i) => i.required && !i.done);
  const pending = items.filter((i) => !i.done).sort((a, b) => b.weight - a.weight);
  return {
    score: Math.round((got / total) * 100),
    items,
    missingRequired,
    canPublish: missingRequired.length === 0,
    tip: pending[0]?.label ?? null,
  };
}
