import type { CSSProperties } from "react";
import type { SiteModel, SiteProduct } from "@/lib/site";
import { themeStyle } from "@/lib/themes";
import { FONT_PAIRS, fontPairStyle } from "@/lib/fonts";
import { buttonRadius } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";
import { CartDrawer } from "./cart/CartDrawer";
import { CatalogSearch } from "./CatalogSearch";
import { ReportButton } from "./ReportButton";
import { SiteNav } from "./SiteNav";
import { Brand } from "./Brand";
import { SiteTracker } from "./SiteTracker";
import { BookingBlock } from "./BookingBlock";
import { Catalog, CtaBand, Hero, HowTo, InfoSection, Ticker, slugify, type Orderable } from "./parts";

export type { Orderable };

/**
 * Página de un negocio. La raíz es un contenedor (`@container`): el diseño responde al ancho de la página,
 * no al de la pantalla, así se ve igual de bien en el marco de celular de la vista previa del editor,
 * en una computadora y en un celular real.
 */
export function SiteView({ site, preview = false, orderable }: { site: SiteModel; preview?: boolean; orderable?: Orderable }) {
  const d = site.design;
  const pair = FONT_PAIRS.find((p) => p.id === d.fontPair) ?? FONT_PAIRS[1]!;
  const style = {
    ...themeStyle(d.theme, d.brandColor),
    ...fontPairStyle(d.fontPair),
    "--btn-radius": buttonRadius(d.buttonShape),
  } as CSSProperties;

  const cats = site.categories.filter((c) => c.products.length > 0);
  const all = cats.flatMap((c) => c.products);
  const totalProducts = all.length;
  const priced = (p: SiteProduct) => p.available && p.price !== null && p.name.trim().length > 0;
  const ticketItems = all.filter(priced).slice(0, 4);
  const tickerItems = all.filter(priced).slice(0, 14);
  const whatsappHref = site.whatsapp ? whatsappLink(site.whatsapp, "Hola! Quería consultarles algo.") : null;
  const services = d.layout === "servicios";
  // Pedidos apagados: sin carrito, sin botones de agregar y sin barra de pedido (la página queda como catálogo).
  const order = site.ordersEnabled ? orderable : undefined;

  return (
    <div className={`${pair.classes} @container relative isolate bg-background text-foreground`} style={style} data-site-layout={d.layout}>
      {/* Fondo de la portada: va en la raíz para pasar por detrás de la barra fija, sin costura. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[48rem]"
        style={{ backgroundImage: "radial-gradient(60% 70% at 88% 6%, color-mix(in oklab, var(--primary) 17%, transparent), transparent 70%), radial-gradient(45% 45% at 0% 38%, color-mix(in oklab, var(--primary) 9%, transparent), transparent 70%)" }}
      />
      {site.announcement.trim() && (
        <div className="bg-primary px-4 py-2 text-center text-sm text-primary-foreground" data-testid="announcement">{site.announcement}</div>
      )}

      {orderable && !preview && <SiteTracker slug={orderable.slug} />}
      <SiteNav
        name={site.name}
        links={cats.map((c) => ({ id: `sec-${slugify(c.name)}`, label: c.name }))}
        orderableSlug={order?.slug}
        whatsappHref={whatsappHref}
        logo={site.logo}
        logoSet={site.logoSet}
      />

      <Hero site={site} preview={preview} items={ticketItems} whatsappHref={whatsappHref} />
      {tickerItems.length >= 3 && <Ticker items={tickerItems} />}
      {/* Sin pedidos y sin WhatsApp no hay forma de consultar: no se explica un paso que no existe. */}
      {totalProducts > 0 && (site.ordersEnabled || site.whatsapp) && <HowTo services={services} name={site.name} orders={site.ordersEnabled} />}

      {totalProducts > 8 && (
        <div className="mx-auto w-full max-w-6xl px-5 pt-2 @2xl:px-8"><CatalogSearch rootId="catalog" /></div>
      )}
      <Catalog site={site} cats={cats} preview={preview} order={order} />

      {orderable && !preview && services && <BookingBlock slug={orderable.slug} whatsapp={site.whatsapp} businessName={site.name} />}
      <InfoSection site={site} whatsappHref={whatsappHref} />
      {site.whatsapp && <CtaBand whatsapp={site.whatsapp} services={services} orders={site.ordersEnabled} />}

      <footer className={`flex flex-col items-center space-y-3 border-t border-border/60 px-5 py-8 text-center ${order ? "pb-28 @2xl:pb-8" : ""}`}>
        <div className="flex items-center gap-2.5">
          <Brand name={site.name} logo={site.logo} logoSet={site.logoSet} size="sm" />
          <span className="site-display font-bold">{site.name}</span>
        </div>
        {!site.hideBranding && <p className="text-xs text-muted-foreground">Hecho con <strong>MiShowo</strong></p>}
        {orderable && <ReportButton slug={orderable.slug} />}
      </footer>

      {order && (
        <CartDrawer slug={order.slug} businessName={site.name} whatsapp={site.whatsapp} greeting={site.whatsappGreeting}
          showQuantities={site.showQuantities} askEventDate={site.askEventDate} />
      )}
    </div>
  );
}
