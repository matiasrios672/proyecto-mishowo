import { cacheLife, cacheTag } from "next/cache";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface PublicProduct {
  id: string; categoryId: string | null; name: string; description: string;
  price: string | null; comparePrice: string | null; available: boolean;
  options: { id: string; label: string; price: string | null; soldOut: boolean }[];
}
export interface PublicSite {
  status: "published" | "suspended";
  name?: string;
  business?: {
    slug: string; name: string; industry: string; description: string; tagline: string | null;
    whatsapp: string | null; instagram: string | null; address: string | null; deliveryZone: string | null;
    hours: unknown; design: { layout: string; theme: string; fontPair: string; brandColor: string | null };
    settings: unknown; planId: string;
  };
  categories?: { id: string; name: string }[];
  products?: PublicProduct[];
}

/** Datos públicos de un negocio. Cacheados por slug; se invalidan con la etiqueta `site:<slug>`. */
export async function getSite(slug: string): Promise<PublicSite | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`site:${slug}`);
  const res = await fetch(`${API_URL}/public/sites/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API respondió ${res.status}`);
  return (await res.json()) as PublicSite;
}
