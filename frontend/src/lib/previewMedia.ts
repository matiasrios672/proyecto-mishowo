import type { SiteModel } from "./site";

/** Archivo subido por el negocio, tal como lo devuelve `GET /me/media`. `productId` es el id del producto en el borrador. */
export interface MediaItem { id: string; kind: "image" | "video" | "logo"; productId: string | null; src: string; srcSet: string | null }

/** Suma a la vista previa el logo, la portada, el video y la foto de cada producto (el borrador no los trae: viven en la cuenta). */
export function withMedia(site: SiteModel, media: MediaItem[]): SiteModel {
  if (media.length === 0) return site;
  const logo = media.find((m) => m.kind === "logo");
  const cover = media.find((m) => m.kind === "image" && m.productId === null);
  const video = media.find((m) => m.kind === "video" && m.productId === null);
  const firstOf = new Map<string, MediaItem>();
  for (const m of media) if (m.kind === "image" && m.productId && !firstOf.has(m.productId)) firstOf.set(m.productId, m);
  return {
    ...site,
    logo: logo?.src ?? site.logo ?? null, logoSet: logo?.srcSet ?? site.logoSet ?? null,
    cover: cover?.src ?? site.cover, coverSet: cover?.srcSet ?? site.coverSet ?? null,
    video: video?.src ?? site.video ?? null,
    categories: site.categories.map((c) => ({
      ...c,
      products: c.products.map((p) => {
        const m = firstOf.get(p.id);
        return m ? { ...p, image: m.src, imageSet: m.srcSet } : p;
      }),
    })),
  };
}
