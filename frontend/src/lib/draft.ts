// Borrador del negocio: vive en localStorage hasta que la persona crea su cuenta (Épica 6).
// Todo el contenido que viene de una plantilla lleva isExample=true hasta que lo edita.
import { defaultHours, type Hours } from "./hours";

export interface DraftOption { id: string; label: string; price: number | null; soldOut: boolean }
export interface DraftProduct {
  id: string; name: string; description: string; price: number | null; comparePrice: number | null;
  available: boolean; stock: number | null; options: DraftOption[]; isExample: boolean;
}
export interface DraftCategory { id: string; name: string; products: DraftProduct[] }
export interface DraftDesign { layout: string; theme: string; fontPair: string; brandColor: string | null; buttonShape: string }
export interface Draft {
  version: 1;
  industryId: string;
  name: string; nameIsExample: boolean;
  tagline: string; description: string; textsAreExample: boolean;
  whatsapp: string; instagram: string; address: string; deliveryZone: string;
  extraWhatsapps: { number: string; role: "ventas" | "soporte" }[];
  hours: Hours;
  announcement: string;
  whatsappGreeting: string;
  showQuantities: boolean;
  /** false = catálogo sin carrito: la página ofrece consultar por WhatsApp. */
  ordersEnabled: boolean;
  askEventDate: boolean;
  design: DraftDesign;
  categories: DraftCategory[];
  updatedAt: number;
}

export interface TemplateInput {
  id: string; businessName: string; tagline: string; description: string; deliveryZone: string;
  eventDate: boolean; layout: string; theme: string; fontPair: string;
  categories: { name: string; products: { name: string; description: string; price: number; options?: { label: string; price?: number }[] }[] }[];
}

export const DRAFT_KEY = "mishowo:draft:v1";

let counter = 0;
const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function createDraftFromTemplate(t: TemplateInput): Draft {
  return {
    version: 1,
    industryId: t.id,
    name: t.businessName, nameIsExample: true,
    tagline: t.tagline, description: t.description, textsAreExample: true,
    whatsapp: "", instagram: "", address: "", deliveryZone: t.deliveryZone,
    extraWhatsapps: [], hours: defaultHours(), announcement: "",
    whatsappGreeting: "Hola! Quiero hacer este pedido:", showQuantities: true, ordersEnabled: true,
    askEventDate: t.eventDate,
    design: { layout: t.layout, theme: t.theme, fontPair: t.fontPair, brandColor: null, buttonShape: "redondeado" },
    categories: t.categories.map((c) => ({
      id: uid(), name: c.name,
      products: c.products.map((p) => ({
        id: uid(), name: p.name, description: p.description, price: p.price, comparePrice: null,
        available: true, stock: null, isExample: true,
        options: (p.options ?? []).map((o) => ({ id: uid(), label: o.label, price: o.price ?? null, soldOut: false })),
      })),
    })),
    updatedAt: Date.now(),
  };
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const defaultStore = (): Store | null => {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
};

export function loadDraft(store: Store | null = defaultStore()): Draft | null {
  try {
    const raw = store?.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return d && d.version === 1 && Array.isArray(d.categories) ? normalizeDraft(d) : null;
  } catch { return null; }
}

/** Completa campos que no existían cuando se guardó el borrador (compatibilidad hacia atrás). */
export function normalizeDraft(d: Draft): Draft {
  return {
    ...d,
    extraWhatsapps: d.extraWhatsapps ?? [],
    hours: Array.isArray(d.hours) && d.hours.length === 7 ? d.hours : defaultHours(),
    announcement: d.announcement ?? "",
    whatsappGreeting: d.whatsappGreeting ?? "Hola! Quiero hacer este pedido:",
    showQuantities: d.showQuantities ?? true,
    ordersEnabled: d.ordersEnabled ?? true,
  };
}

export function saveDraft(draft: Draft, store: Store | null = defaultStore()): boolean {
  try {
    store?.setItem(DRAFT_KEY, JSON.stringify({ ...draft, updatedAt: Date.now() }));
    return !!store;
  } catch { return false; }
}

export function clearDraft(store: Store | null = defaultStore()) {
  try { store?.removeItem(DRAFT_KEY); } catch { /* sin storage */ }
}

export function countExamples(d: Draft): number {
  return d.categories.flatMap((c) => c.products).filter((p) => p.isExample).length;
}

/** Lo que se guarda en el servidor: el borrador sin los campos propios del almacenamiento local. */
export type DraftContent = Omit<Draft, "version" | "updatedAt">;

export function draftToContent(d: Draft): DraftContent {
  const c: Partial<Draft> = { ...d };
  delete c.version;
  delete c.updatedAt;
  return c as DraftContent;
}

export function contentToDraft(c: DraftContent): Draft {
  return normalizeDraft({ ...c, version: 1, updatedAt: Date.now() });
}

/** ¿Tienen el mismo contenido? (ignora la fecha de última modificación). */
export const sameContent = (a: Draft, b: Draft) => JSON.stringify(draftToContent(a)) === JSON.stringify(draftToContent(b));
