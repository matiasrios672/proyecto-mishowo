// Modelo único para dibujar la página de un negocio. Lo usan la vista previa del editor (desde el
// borrador) y la página pública (desde la API), para que se vean idénticas.
import type { Draft } from "./draft";
import type { PublicSite } from "./api";
import { isAvailable } from "./draftOps";
import { defaultHours, type Hours } from "./hours";

export interface SiteOption { id: string; label: string; price: number | null; soldOut: boolean }
export interface SiteProduct {
  id: string; name: string; description: string; price: number | null; comparePrice: number | null;
  available: boolean; isExample: boolean; options: SiteOption[];
  /** URL de la foto principal (llega con la subida de fotos). */
  image: string | null;
  imageSet?: string | null;
}
export interface SiteCategory { id: string; name: string; products: SiteProduct[] }
export interface SiteDesign { layout: string; theme: string; fontPair: string; brandColor: string | null; buttonShape: string }
export interface SiteModel {
  name: string; tagline: string; description: string;
  whatsapp: string; instagram: string; address: string; deliveryZone: string;
  hours: Hours | null; announcement: string;
  design: SiteDesign;
  categories: SiteCategory[];
  showQuantities: boolean; askEventDate: boolean; whatsappGreeting: string;
  hideBranding: boolean;
  exampleName: boolean; exampleTexts: boolean;
  /** URL de la foto de portada (llega con la subida de fotos). */
  cover: string | null;
  coverSet?: string | null;
  /** URL del video de portada (MP4/WebM), si el negocio subió uno. */
  video?: string | null;
}

export function draftToSite(d: Draft): SiteModel {
  return {
    name: d.name, tagline: d.tagline, description: d.description,
    whatsapp: d.whatsapp, instagram: d.instagram, address: d.address, deliveryZone: d.deliveryZone,
    hours: d.hours.some((h) => h.open) ? d.hours : null, announcement: d.announcement,
    design: d.design,
    categories: d.categories.map((c) => ({
      id: c.id, name: c.name,
      products: c.products.map((p) => ({
        id: p.id, name: p.name, description: p.description, price: p.price, comparePrice: p.comparePrice,
        available: isAvailable(p), isExample: p.isExample, image: null,
        options: p.options.map((o) => ({ id: o.id, label: o.label, price: o.price, soldOut: o.soldOut })),
      })),
    })),
    showQuantities: d.showQuantities, askEventDate: d.askEventDate, whatsappGreeting: d.whatsappGreeting,
    hideBranding: false,
    exampleName: d.nameIsExample, exampleTexts: d.textsAreExample, cover: null,
  };
}

type Loose = Record<string, unknown>;
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export function publicToSite(site: PublicSite): SiteModel {
  const b = site.business!;
  const settings = (b.settings ?? {}) as Loose;
  const design = (b.design ?? {}) as Loose;
  const cats = site.categories ?? [];
  const prods = site.products ?? [];
  const toProduct = (p: (typeof prods)[number]): SiteProduct => ({
    id: p.id, name: p.name, description: p.description, price: num(p.price), comparePrice: num(p.comparePrice),
    available: p.available, isExample: false, image: p.image?.src ?? null, imageSet: p.image?.srcSet ?? null,
    options: p.options.map((o) => ({ id: o.id, label: o.label, price: num(o.price), soldOut: o.soldOut })),
  });
  const categories: SiteCategory[] = cats.map((c) => ({ id: c.id, name: c.name, products: prods.filter((p) => p.categoryId === c.id).map(toProduct) }));
  const loose = prods.filter((p) => !p.categoryId || !cats.some((c) => c.id === p.categoryId));
  if (loose.length) categories.push({ id: "sin-categoria", name: "Productos", products: loose.map(toProduct) });

  const rawHours = b.hours as unknown;
  const hours = Array.isArray(rawHours) && rawHours.length === 7 && (rawHours as Hours).some((h) => h.open) ? (rawHours as Hours) : null;
  return {
    name: b.name, tagline: b.tagline ?? "", description: b.description,
    whatsapp: b.whatsapp ?? "", instagram: b.instagram ?? "", address: b.address ?? "", deliveryZone: b.deliveryZone ?? "",
    hours, announcement: str(settings.announcement),
    design: {
      layout: str(design.layout, "vidriera"), theme: str(design.theme, "blanco"), fontPair: str(design.fontPair, "moderna"),
      brandColor: typeof design.brandColor === "string" ? design.brandColor : null, buttonShape: str(design.buttonShape, "redondeado"),
    },
    categories,
    showQuantities: settings.showQuantities !== false, askEventDate: settings.askEventDate === true,
    whatsappGreeting: str(settings.whatsappGreeting, "Hola! Quiero hacer este pedido:"),
    hideBranding: b.planId === "pro",
    exampleName: false, exampleTexts: false, cover: site.cover?.src ?? null, coverSet: site.cover?.srcSet ?? null, video: site.video ?? null,
  };
}

export { defaultHours };
