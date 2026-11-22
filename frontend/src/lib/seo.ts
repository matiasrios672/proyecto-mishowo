import type { SiteModel } from "./site";
import { isValidTime } from "./hours";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const MAX_OFFERS = 20;

/** Datos estructurados (schema.org) para que Google entienda el negocio: LocalBusiness con su catálogo. */
export function localBusinessJsonLd(site: SiteModel, url: string, image?: string | null): Record<string, unknown> {
  const phone = site.whatsapp.replace(/\D/g, "");
  const offers = site.categories.flatMap((c) => c.products)
    .filter((p) => p.name.trim() && p.price !== null && p.price >= 0 && !p.isExample)
    .slice(0, MAX_OFFERS)
    .map((p) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Product", name: p.name, ...(p.description ? { description: p.description } : {}), ...(p.image ? { image: p.image } : {}) },
      price: p.price, priceCurrency: "ARS",
      availability: p.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    }));
  const hours = (site.hours ?? []).flatMap((h, i) => (h.open && isValidTime(h.from) && isValidTime(h.to)
    ? [{ "@type": "OpeningHoursSpecification", dayOfWeek: DAYS[i], opens: h.from, closes: h.to }] : []));
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: site.name, url,
    ...(site.description ? { description: site.description } : {}),
    ...(image ? { image } : {}),
    ...(site.logo ? { logo: site.logo } : {}),
    ...(phone ? { telephone: `+${phone}` } : {}),
    ...(site.address ? { address: { "@type": "PostalAddress", streetAddress: site.address, addressCountry: "AR" } } : {}),
    ...(hours.length ? { openingHoursSpecification: hours } : {}),
    ...(offers.length ? { hasOfferCatalog: { "@type": "OfferCatalog", name: "Catálogo", itemListElement: offers } } : {}),
  };
}

/**
 * Serializa para meterlo dentro de <script type="application/ld+json">. El texto lo escribe el dueño del negocio:
 * sin escapar "<", un nombre como `</script><script>…` rompería la etiqueta y ejecutaría código en la página.
 */
export const safeJsonLd = (data: unknown) =>
  JSON.stringify(data).replace(/</g, "\\u003c").replaceAll(String.fromCharCode(0x2028), "\\u2028").replaceAll(String.fromCharCode(0x2029), "\\u2029");

/** Descripción para buscadores y redes: la del negocio, o armada con lo que vende; máximo ~160 caracteres. */
export function seoDescription(site: SiteModel): string {
  const base = site.description.trim() || site.tagline.trim();
  const text = base || `Mirá el catálogo de ${site.name} y hacé tu pedido por WhatsApp.`;
  const flat = text.replace(/\s+/g, " ");
  return flat.length <= 160 ? flat : `${flat.slice(0, 157).trimEnd()}…`;
}
