/* eslint-disable @next/next/no-img-element -- las fotos ya salen del backend en WebP con srcset propio */
import { ProductIllustration } from "./illustrations";
import type { CSSProperties } from "react";
import type { SiteCategory, SiteModel, SiteProduct } from "@/lib/site";
import { Brand } from "./Brand";
import { formatPrice, normalizeSearch, priceLabel } from "@/lib/format";
import { discountPercent } from "@/lib/draftOps";
import { installmentLine, type Installments } from "@/lib/installments";
import { whatsappLink } from "@/lib/whatsapp";
import { AddToCart } from "./cart/AddToCart";
import { HoursList } from "./HoursList";
import { IconInstagram, IconPin, IconWhatsApp } from "./icons";
import { OpenBadge } from "./OpenBadge";

export interface Orderable { slug: string }

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const hash = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};

const btnPrimary = "inline-flex items-center justify-center gap-2 bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const btnOutline = "inline-flex items-center justify-center gap-2 border-2 border-primary px-6 py-3 text-base font-semibold text-primary transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const radius: CSSProperties = { borderRadius: "var(--btn-radius)" };
const container = "mx-auto w-full max-w-6xl px-5 @2xl:px-8";

const Example = () => (
  <span className="ml-1.5 rounded-full border border-dashed px-1.5 py-0.5 align-middle text-[10px] font-normal text-muted-foreground">Ejemplo</span>
);
const Leader = () => <span aria-hidden className="mb-[0.35em] min-w-4 flex-1 self-end border-b-2 border-dotted border-current opacity-25" />;

function Price({ p }: { p: SiteProduct }) {
  const off = discountPercent({ price: p.price, comparePrice: p.comparePrice });
  const label = priceLabel(p.price, p.options);
  if (!label && !off) return null;
  return (
    <span className="whitespace-nowrap font-semibold tabular-nums">
      {p.comparePrice !== null && off !== null && <s className="mr-1.5 text-xs font-normal text-muted-foreground">{formatPrice(p.comparePrice)}</s>}
      {label}
      {off !== null && <span className="ml-1.5 rounded bg-primary px-1 py-0.5 text-[10px] font-medium text-primary-foreground">-{off}%</span>}
    </span>
  );
}

/** Foto del producto o, sin foto, una pieza de color del tema con la inicial (cada nombre tiene su ángulo). */
function Art({ name, image, imageSet, className }: { name: string; image: string | null; imageSet?: string | null; className: string }) {
  if (image)
    return <img src={image} srcSet={imageSet ?? undefined} sizes="(min-width: 1024px) 24rem, 90vw" alt={name} loading="lazy" decoding="async" className={`object-cover ${className}`} />;
  return (
    <div
      aria-hidden
      className={`grid place-items-center overflow-hidden ${className}`}
      style={{ backgroundImage: `linear-gradient(${hash(name) % 360}deg, color-mix(in oklab, var(--primary) 24%, var(--card)), color-mix(in oklab, var(--primary) 7%, var(--card)))` }}
    >
      <ProductIllustration name={name} />
    </div>
  );
}

/** Miniatura para los layouts de texto (mostrador y servicios): la foto solo aparece si el negocio la subió. */
function Thumb({ p, name, dim }: { p: SiteProduct; name: string; dim: boolean }) {
  if (!p.image) return null;
  return <img src={p.image} srcSet={p.imageSet ?? undefined} sizes="96px" alt={name} loading="lazy" decoding="async" className={`size-20 shrink-0 rounded-xl object-cover @xl:size-24 ${dim ? "opacity-50" : ""}`} />;
}

const Soldout = () => <span className="text-xs font-medium text-destructive">Agotado</span>;

/** Precio más bajo del producto (el "desde" cuando hay variantes). */
const basePrice = (p: SiteProduct): number | null => {
  const all = [p.price, ...p.options.map((o) => o.price)].filter((n): n is number => n !== null);
  return all.length ? Math.min(...all) : null;
};

function Card({ p, layout, preview, order, showQuantities, consultHref, inst }: { p: SiteProduct; layout: string; preview: boolean; order?: Orderable; showQuantities: boolean; consultHref?: string | null; inst?: Installments }) {
  const name = p.name || "Producto sin nombre";
  const instText = p.available ? installmentLine(basePrice(p), inst) : null;
  const instEl = instText && (
    <p className="mt-1 text-xs font-semibold text-primary" data-testid="installments-line">
      {p.options.length > 0 && p.options.some((o) => o.price !== null) ? "Desde " : ""}{instText}
    </p>
  );
  const ex = preview && p.isExample ? <Example /> : null;
  const search = normalizeSearch(`${name} ${p.description}`);
  const dim = p.available ? "" : "text-muted-foreground";
  const artDim = p.available ? "" : " opacity-50";
  const consult = consultHref ? (
    <a href={consultHref} target="_blank" rel="noopener noreferrer" aria-label={`Consultar por ${name} por WhatsApp`}
      className="mt-2.5 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary/40 px-3.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      <IconWhatsApp className="size-4" /> Consultar
    </a>
  ) : null;
  const add = order ? <AddToCart slug={order.slug} product={p} showQuantities={showQuantities} /> : consult;
  const opts = p.options.length > 0 && <p className="mt-0.5 text-xs text-muted-foreground">{p.options.map((o) => o.label).join(" · ")}</p>;
  const soldout = !p.available && <div className="mt-1.5"><Soldout /></div>;

  if (layout === "vidriera")
    return (
      <li data-search={search} data-product-id={p.id} className={`site-card flex gap-3.5 @xl:block ${dim}`}>
        {/* En celular: foto chica a la izquierda y el detalle al lado (se recorre mucho más rápido). En pantallas anchas: tarjeta con foto grande. */}
        <div className="site-artwrap w-24 shrink-0 self-start overflow-hidden rounded-xl @xl:w-auto @xl:rounded-[1.25rem]"><Art name={name} image={p.image} imageSet={p.imageSet} className={`site-art aspect-square w-full @xl:aspect-[4/3]${artDim}`} /></div>
        <div className="min-w-0 flex-1 @xl:pt-3.5">
          <div className="flex items-baseline justify-between gap-4">
            <h4 className="site-display text-lg font-semibold leading-snug">{name}{ex}</h4>
            <Price p={p} />
          </div>
          {p.description && <p className="mt-1 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">{p.description}</p>}
          {opts}{instEl}{soldout}{add}
        </div>
      </li>
    );

  if (layout === "grilla")
    return (
      <li data-search={search} data-product-id={p.id} className={`site-card ${dim}`}>
        <div className="site-artwrap overflow-hidden rounded-2xl"><Art name={name} image={p.image} imageSet={p.imageSet} className={`site-art aspect-square w-full${artDim}`} /></div>
        <div className="pt-3">
          <h4 className="text-sm font-semibold leading-snug @2xl:text-base">{name}{ex}</h4>
          <div className="mt-0.5 text-sm"><Price p={p} /></div>
          {instEl}{soldout}{add}
        </div>
      </li>
    );

  if (layout === "servicios")
    return (
      <li data-search={search} data-product-id={p.id} className={`flex gap-4 border-l-4 border-primary py-1 pl-4 ${dim}`}>
        <Thumb p={p} name={name} dim={!p.available} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-4">
            <h4 className="site-display text-lg font-semibold">{name}{ex}</h4>
            <Price p={p} />
          </div>
          {p.description && <p className="mt-1 max-w-[56ch] text-sm leading-relaxed text-muted-foreground">{p.description}</p>}
          {opts}{instEl}{soldout}{add}
        </div>
      </li>
    );

  // mostrador: la carta de un bar, con puntos guía hasta el precio
  return (
    <li data-search={search} data-product-id={p.id} className={`flex gap-3 border-b border-border py-3.5 ${dim}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h4 className="font-medium leading-snug">{name}{ex}</h4>
          <Leader />
          <Price p={p} />
        </div>
        {p.description && <p className="mt-0.5 max-w-[56ch] text-sm text-muted-foreground">{p.description}</p>}
        {opts}{instEl}{soldout}{add}
      </div>
      <Thumb p={p} name={name} dim={!p.available} />
    </li>
  );
}

const LIST: Record<string, string> = {
  vidriera: "grid gap-x-6 gap-y-10 @xl:grid-cols-2 @4xl:grid-cols-3",
  grilla: "grid grid-cols-2 gap-x-4 gap-y-8 @2xl:grid-cols-3 @4xl:grid-cols-4",
  mostrador: "grid gap-x-14 @3xl:grid-cols-2",
  servicios: "grid gap-x-10 gap-y-7 @2xl:grid-cols-2",
};

export function Catalog({ site, cats, preview, order }: { site: SiteModel; cats: SiteCategory[]; preview: boolean; order?: Orderable }) {
  const layout = site.design.layout;
  const services = layout === "servicios";
  // Sin pedidos: cada producto ofrece "Consultar" por WhatsApp con su nombre ya escrito.
  const consultFor = (p: SiteProduct) => (site.ordersEnabled || !site.whatsapp || !p.name.trim() ? null : whatsappLink(site.whatsapp, `Hola! Quería consultarles por "${p.name}".`));
  return (
    <main id="catalog" className={`${container} scroll-mt-20 pb-6 pt-4 @4xl:pt-10`}>
      <h2 className="site-display text-3xl font-bold tracking-tight @4xl:text-4xl">{services ? "Nuestros servicios" : layout === "mostrador" ? "Nuestra carta" : "Nuestros productos"}</h2>
      {/* Saltar a una sección: en la carta de un local con muchos rubros se llega al postre sin recorrer toda la lista. Son links comunes (sin JS). */}
      {cats.length >= 3 && (
        <nav aria-label={layout === "mostrador" ? "Secciones de la carta" : "Categorías"} className="sticky top-14 z-10 -mx-5 mt-4 overflow-x-auto border-y border-border/60 bg-background/90 px-5 py-2 backdrop-blur @2xl:-mx-8 @2xl:px-8" data-testid="catalog-chips">
          <ul className="flex w-max gap-2">
            {cats.map((c) => (
              <li key={c.id}><a href={`#sec-${slugify(c.name)}`} className="inline-flex min-h-9 items-center whitespace-nowrap rounded-full border border-border bg-card px-3.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{c.name}</a></li>
            ))}
          </ul>
        </nav>
      )}
      {cats.length === 0 && <p className="py-12 text-muted-foreground">Todavía no hay {services ? "servicios" : "productos"} cargados.</p>}
      {cats.map((c) => (
        <section key={c.id} id={`sec-${slugify(c.name)}`} data-section className="scroll-mt-28 pt-8">
          <h3 className={layout === "mostrador"
            ? "mb-3 border-b-2 border-foreground/80 pb-2 site-display text-lg font-bold uppercase tracking-[0.16em] @4xl:text-xl" // carta de bar: títulos de sección en mayúsculas con regla
            : "mb-5 site-display text-xl font-semibold @4xl:text-2xl"}>{c.name}{layout !== "mostrador" && <span className="ml-2 text-sm font-normal text-muted-foreground">{c.products.length} {c.products.length === 1 ? (services ? "servicio" : "opción") : (services ? "servicios" : "opciones")}</span>}</h3>
          <ul className={LIST[layout] ?? LIST.vidriera}>
            {c.products.map((p) => <Card key={p.id} p={p} layout={layout} preview={preview} order={order} showQuantities={site.showQuantities} consultHref={consultFor(p)} inst={site.installments} />)}
          </ul>
        </section>
      ))}
    </main>
  );
}

/** La comanda: el menú del negocio impreso en un ticket. Es lo primero que se ve y se "imprime" al cargar. */
function Ticket({ site, items }: { site: SiteModel; items: SiteProduct[] }) {
  const services = site.design.layout === "servicios";
  return (
    <aside aria-label={services ? "Algunos de nuestros servicios" : "Algunos de nuestros productos"} className="mx-auto w-full max-w-sm @4xl:mx-0 @4xl:ml-auto">
      <div className="ticket-tilt" style={{ "--tilt": "-1.6deg" } as CSSProperties}>
        <div className="ticket-edge bg-card px-6 pb-9 pt-6 text-card-foreground shadow-xl" style={{ borderRadius: "0.5rem 0.5rem 0 0" }}>
          <p className="site-display text-xl font-bold leading-tight">{site.name || "Tu negocio"}</p>
          <p className="text-sm text-muted-foreground">{services ? "Algunos de nuestros servicios" : "Algunos de nuestros productos"}</p>
          <div className="my-4 border-t-2 border-dashed border-border" />
          <div className="space-y-2.5">
            {items.map((p, i) => (
              <div key={p.id} className="site-print flex items-baseline gap-2 text-[0.95rem]" style={{ "--d": `${650 + i * 230}ms` } as CSSProperties}>
                <span className="min-w-0 truncate font-medium">{p.name}</span>
                <Leader />
                <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums">{formatPrice(p.price)}</span>
              </div>
            ))}
          </div>
          <div className="my-4 border-t-2 border-dashed border-border" />
          <p className="site-print text-sm" style={{ "--d": `${650 + items.length * 230 + 100}ms` } as CSSProperties}>
            Pedí por WhatsApp y lo coordinamos con vos.
          </p>
        </div>
      </div>
    </aside>
  );
}

export function Hero({ site, preview, items, whatsappHref }: { site: SiteModel; preview: boolean; items: SiteProduct[]; whatsappHref: string | null }) {
  const services = site.design.layout === "servicios";
  const long = site.name.length > 24;
  // En una vista previa (demo de la landing, editor) el título no puede ser un segundo h1 de la página.
  const Title = preview ? "h2" : "h1";
  const ig = site.instagram.replace(/^@/, "").trim();
  const showAddress = site.address.trim() !== "" && site.address.trim() !== site.deliveryZone.trim();
  const rise = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;
  return (
    <section id="top">
      <div className={`${container} grid grid-cols-[minmax(0,1fr)] items-center gap-12 pb-14 pt-6 @4xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] @4xl:gap-10 @4xl:pb-24 @4xl:pt-14`}>
        <div>
          {site.logo && <div className="site-rise mb-5" style={rise(0)}><Brand name={site.name} logo={site.logo} logoSet={site.logoSet} size="lg" /></div>}
          {site.hours && <div className="site-rise mb-4" style={rise(0)}><OpenBadge hours={site.hours} /></div>}
          <Title
            data-testid="site-name"
            className={`site-rise site-display font-bold leading-[0.98] tracking-tight [text-wrap:balance] ${long ? "text-[clamp(2.1rem,6.5cqw,3.9rem)]" : "text-[clamp(2.7rem,9cqw,5.6rem)]"}`}
            style={rise(80)}
          >
            {site.name || "Tu negocio"}
            {preview && site.exampleName && <Example />}
          </Title>
          {site.tagline && (
            <p className="site-rise mt-5 max-w-[34ch] text-xl leading-snug text-muted-foreground @4xl:text-2xl" style={rise(180)}>
              {site.tagline}
              {preview && site.exampleTexts && <Example />}
            </p>
          )}
          {site.description && <p className="site-rise mt-4 max-w-[56ch] leading-relaxed" style={rise(260)}>{site.description}</p>}

          <div className="site-rise mt-8 flex flex-col gap-3 @md:flex-row @md:flex-wrap" style={rise(340)}>
            <a href="#catalog" className={`${btnPrimary} @md:w-auto`} style={radius}>{services ? "Ver servicios y precios" : site.ordersEnabled ? "Hacer mi pedido" : "Ver el catálogo"}</a>
            {whatsappHref && (
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={btnOutline} style={radius}>
                <IconWhatsApp className="size-5" /> Escribinos por WhatsApp
              </a>
            )}
          </div>

          {(site.deliveryZone || showAddress || ig) && (
            <div className="site-rise mt-8 grid gap-2.5 text-sm text-muted-foreground" style={rise(420)}>
              {site.deliveryZone && <p className="flex items-start gap-2.5"><IconPin className="mt-0.5 size-4 shrink-0 text-primary" />{site.deliveryZone}</p>}
              {showAddress && <p className="flex items-start gap-2.5"><IconPin className="mt-0.5 size-4 shrink-0 text-primary" />{site.address}</p>}
              {ig && (
                <a className="flex items-center gap-2.5 hover:underline" href={`https://instagram.com/${encodeURIComponent(ig)}`} target="_blank" rel="noopener noreferrer">
                  <IconInstagram className="size-4 shrink-0 text-primary" />@{ig}
                </a>
              )}
            </div>
          )}
        </div>

        {site.cover ? (
          <div className="site-cover relative">
            <div aria-hidden className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-primary/15 blur-2xl" />
            <img src={site.cover} srcSet={site.coverSet ?? undefined} sizes="(min-width: 1024px) 32rem, 90vw" alt={`Portada de ${site.name}`} fetchPriority="high" className="aspect-[4/5] w-full rounded-[2rem] object-cover shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)]" />
            <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-2xl border border-white/40 bg-black/35 p-3 text-white backdrop-blur-md">
              <Brand name={site.name} logo={site.logo} logoSet={site.logoSet} size="sm" />
              <p className="min-w-0 text-sm leading-snug"><strong className="block truncate">{site.name}</strong>{site.tagline && <span className="block truncate opacity-85">{site.tagline}</span>}</p>
            </div>
          </div>
        ) : site.video ? (
          <video src={site.video} controls muted playsInline preload="metadata" aria-label={`Video de ${site.name}`} className="aspect-[4/5] w-full rounded-[2rem] bg-black object-cover" />
        ) : (
          items.length > 0 && <Ticket site={site} items={items} />
        )}
      </div>
    </section>
  );
}

/** Cinta de productos en movimiento. Decorativa (repite el catálogo): fuera del orden de lectura. */
export function Ticker({ items }: { items: SiteProduct[] }) {
  const loop = Array.from({ length: Math.max(1, Math.ceil(8 / items.length)) }, () => items).flat();
  const group = (dup: boolean) => (
    <div className={`flex shrink-0 items-center gap-8 pr-8 ${dup ? "site-marquee-dup" : ""}`}>
      {loop.map((p, i) => (
        <span key={`${p.id}-${i}`} className="flex items-center gap-8 whitespace-nowrap">
          <span>{p.name}<span className="ml-2 font-bold tabular-nums">{formatPrice(p.price)}</span></span>
          <span className="size-1.5 rounded-full bg-current opacity-50" />
        </span>
      ))}
    </div>
  );
  return (
    <div aria-hidden className="site-marquee overflow-hidden bg-primary py-3.5 text-sm font-medium text-primary-foreground">
      <div className="site-marquee-track flex w-max" style={{ "--dur": `${Math.max(30, loop.length * 5)}s` } as CSSProperties}>
        {group(false)}{group(true)}
      </div>
    </div>
  );
}

export function HowTo({ services, name, orders = true }: { services: boolean; name: string; orders?: boolean }) {
  const steps = orders ? [
    { t: services ? "Elegí lo que necesitás" : "Elegí lo que querés", d: services ? "Mirá los servicios y tocá Agregar." : "Mirá el catálogo y tocá Agregar." },
    { t: "Armá tu pedido", d: "Revisá las cantidades, sumá aclaraciones y tocá Enviar." },
    { t: "Lo coordinamos por WhatsApp", d: `${name || "El negocio"} recibe tu pedido y coordinan el pago y la entrega o el retiro.` },
  ] : [
    { t: services ? "Mirá los servicios" : "Mirá el catálogo", d: "Precios y fotos siempre al día, a cualquier hora." },
    { t: "Consultá lo que te interese", d: "Tocá Consultar y se abre WhatsApp con el producto ya escrito." },
    { t: "Lo coordinamos con vos", d: `${name || "El negocio"} te responde y coordinan el pago y la entrega o el retiro.` },
  ];
  return (
    <section aria-labelledby="como-pedir" className={`${container} py-14 @4xl:py-20`}>
      <h2 id="como-pedir" className="site-display text-3xl font-bold tracking-tight @4xl:text-4xl">{orders ? "Pedir es fácil" : "Consultar es fácil"}</h2>
      <ol className="mt-8 grid gap-8 @3xl:grid-cols-3 @3xl:gap-10">
        {steps.map((s, i) => (
          <li key={s.t} className="flex gap-4">
            <span aria-hidden className="site-display text-5xl font-bold leading-none text-primary/40 tabular-nums">{i + 1}</span>
            <div>
              <h3 className="site-display text-lg font-semibold">{s.t}</h3>
              <p className="mt-1 text-muted-foreground">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function InfoSection({ site, whatsappHref }: { site: SiteModel; whatsappHref: string | null }) {
  const ig = site.instagram.replace(/^@/, "").trim();
  const showAddress = site.address.trim() !== "" && site.address.trim() !== site.deliveryZone.trim();
  const hasPlace = !!(site.deliveryZone || showAddress || ig);
  if (!site.hours && !hasPlace) return null;
  const mapHref = site.address ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(site.address)}` : null;
  return (
    <section aria-labelledby="info-title" className={`${container} py-12 @4xl:py-16`}>
      <h2 id="info-title" className="site-display text-3xl font-bold tracking-tight @4xl:text-4xl">Horarios y cómo llegar</h2>
      <div className="mt-8 grid gap-10 @3xl:grid-cols-2">
        {site.hours && (
          <div>
            <h3 className="mb-3 site-display text-lg font-semibold">Cuándo atendemos</h3>
            <HoursList hours={site.hours} />
          </div>
        )}
        {hasPlace && (
          <div className="rounded-3xl bg-[color-mix(in_oklab,var(--primary)_9%,var(--card))] p-6 @4xl:p-8">
            <h3 className="mb-3 site-display text-lg font-semibold">Dónde y cómo</h3>
            <div className="space-y-3 text-sm">
              {site.deliveryZone && <p className="flex items-start gap-2.5"><IconPin className="mt-0.5 size-4 shrink-0 text-primary" />{site.deliveryZone}</p>}
              {showAddress && <p className="flex items-start gap-2.5"><IconPin className="mt-0.5 size-4 shrink-0 text-primary" />{site.address}</p>}
              {mapHref && <a className="inline-block " href={mapHref} target="_blank" rel="noopener noreferrer">Ver en el mapa</a>}
              {ig && (
                <a className="flex items-center gap-2.5 hover:underline" href={`https://instagram.com/${encodeURIComponent(ig)}`} target="_blank" rel="noopener noreferrer">
                  <IconInstagram className="size-4 shrink-0 text-primary" />@{ig}
                </a>
              )}
            </div>
            {whatsappHref && (
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={`${btnPrimary} mt-6`} style={radius}>
                <IconWhatsApp className="size-5" /> Escribinos por WhatsApp
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export function CtaBand({ whatsapp, services, orders = true }: { whatsapp: string; services: boolean; orders?: boolean }) {
  const href = whatsappLink(whatsapp, "Hola! Quería consultarles algo.");
  if (!href) return null;
  return (
    <section aria-labelledby="cta-title" className="bg-primary text-primary-foreground">
      <div className={`${container} flex flex-col gap-6 py-12 @3xl:flex-row @3xl:items-center @3xl:justify-between @4xl:py-16`}>
        <div>
          <h2 id="cta-title" className="site-display text-3xl font-bold leading-tight tracking-tight @4xl:text-4xl">{orders ? "Hacé tu pedido por WhatsApp" : "Consultanos por WhatsApp"}</h2>
          <p className="mt-2 max-w-[44ch] opacity-90">{services || !orders ? "Contanos qué necesitás y lo coordinamos con vos." : "Elegí lo que querés y lo coordinamos con vos."}</p>
        </div>
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 bg-primary-foreground px-7 py-4 text-base font-semibold text-primary transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground" style={radius}>
          <IconWhatsApp className="size-5" /> Abrir WhatsApp
        </a>
      </div>
    </section>
  );
}
