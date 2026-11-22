import type { CSSProperties } from "react";
import type { SiteModel, SiteProduct } from "@/lib/site";
import { themeStyle } from "@/lib/themes";
import { FONT_PAIRS, fontPairStyle } from "@/lib/fonts";
import { buttonRadius, formatPrice, priceLabel } from "@/lib/format";
import { summarizeHours } from "@/lib/hours";
import { whatsappLink } from "@/lib/whatsapp";
import { discountPercent } from "@/lib/draftOps";
import { OpenBadge } from "./OpenBadge";

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function Example() {
  return <span className="ml-1.5 rounded-full border border-dashed px-1.5 py-0.5 align-middle text-[10px] font-normal text-muted-foreground">Ejemplo</span>;
}

function Price({ p }: { p: SiteProduct }) {
  const off = discountPercent({ price: p.price, comparePrice: p.comparePrice });
  const label = priceLabel(p.price, p.options);
  if (!label && !off) return null;
  return (
    <span className="whitespace-nowrap font-semibold">
      {p.comparePrice !== null && off !== null && <s className="mr-1.5 text-xs font-normal text-muted-foreground">{formatPrice(p.comparePrice)}</s>}
      {label}
      {off !== null && <span className="ml-1.5 rounded bg-primary px-1 py-0.5 text-[10px] font-medium text-primary-foreground">-{off}%</span>}
    </span>
  );
}

function Thumb({ name, className }: { name: string; className: string }) {
  return (
    <div aria-hidden className={`grid place-items-center bg-muted text-2xl font-bold text-muted-foreground ${className}`} style={{ fontFamily: "var(--font-heading)" }}>
      {name.trim().charAt(0).toUpperCase() || "·"}
    </div>
  );
}

function Soldout() {
  return <span className="text-xs font-medium text-destructive">Agotado</span>;
}

function Card({ p, layout, preview }: { p: SiteProduct; layout: string; preview: boolean }) {
  const ex = preview && p.isExample ? <Example /> : null;
  const opts = p.options.length > 0 && (
    <p className="mt-0.5 text-xs text-muted-foreground">{p.options.map((o) => o.label).join(" · ")}</p>
  );
  const name = p.name || "Producto sin nombre";
  const dim = p.available ? "" : "opacity-60";

  if (layout === "vidriera")
    return (
      <li className={`overflow-hidden rounded-2xl border bg-card ${dim}`}>
        <Thumb name={name} className="h-40 w-full" />
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold leading-snug" style={{ fontFamily: "var(--font-heading)" }}>{name}{ex}</h3>
            <Price p={p} />
          </div>
          {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
          {opts}
          {!p.available && <div className="mt-2"><Soldout /></div>}
        </div>
      </li>
    );

  if (layout === "grilla")
    return (
      <li className={`overflow-hidden rounded-xl border bg-card ${dim}`}>
        <Thumb name={name} className="aspect-square w-full" />
        <div className="p-3">
          <h3 className="text-sm font-semibold leading-snug">{name}{ex}</h3>
          <div className="mt-1 text-sm"><Price p={p} /></div>
          {!p.available && <Soldout />}
        </div>
      </li>
    );

  if (layout === "servicios")
    return (
      <li className={`rounded-xl border bg-card p-4 ${dim}`}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{name}{ex}</h3>
          <Price p={p} />
        </div>
        {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
        {opts}
        {!p.available && <div className="mt-2"><Soldout /></div>}
      </li>
    );

  // mostrador
  return (
    <li className={`flex items-center justify-between gap-3 border-b py-3 ${dim}`}>
      <div className="min-w-0">
        <h3 className="font-medium leading-snug">{name}{ex}</h3>
        {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
        {opts}
        {!p.available && <Soldout />}
      </div>
      <Price p={p} />
    </li>
  );
}

export function SiteView({ site, preview = false }: { site: SiteModel; preview?: boolean }) {
  const d = site.design;
  const pair = FONT_PAIRS.find((p) => p.id === d.fontPair) ?? FONT_PAIRS[1]!;
  const style = {
    ...themeStyle(d.theme, d.brandColor),
    ...fontPairStyle(d.fontPair),
    "--btn-radius": buttonRadius(d.buttonShape),
  } as CSSProperties;
  const layout = d.layout;
  const cats = site.categories.filter((c) => c.products.length > 0);
  const wa = site.whatsapp ? whatsappLink(site.whatsapp, "Hola! Quería consultarles algo.") : null;
  const ig = site.instagram.replace(/^@/, "").trim();
  const listClass =
    layout === "grilla" ? "grid grid-cols-2 gap-3" : layout === "mostrador" ? "" : "space-y-3";
  const btn = "inline-flex items-center justify-center bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground";

  return (
    <div className={`${pair.classes} bg-background text-foreground`} style={style} data-site-layout={layout}>
      {site.announcement.trim() && (
        <div className="bg-primary px-4 py-2 text-center text-sm text-primary-foreground" data-testid="announcement">{site.announcement}</div>
      )}

      <header className="px-4 pb-4 pt-6">
        <h1 className="text-2xl font-bold leading-tight" style={{ fontFamily: "var(--font-heading)" }} data-testid="site-name">
          {site.name || "Tu negocio"}
          {preview && site.exampleName && <Example />}
        </h1>
        {site.tagline && <p className="mt-1 text-muted-foreground">{site.tagline}{preview && site.exampleTexts && <Example />}</p>}
        {site.hours && <div className="mt-2"><OpenBadge hours={site.hours} /></div>}
        {site.description && <p className="mt-3 text-sm">{site.description}</p>}
      </header>

      {cats.length > 1 && (
        <nav aria-label="Secciones" className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-y bg-background/95 px-4 py-2 backdrop-blur">
          {cats.map((c) => (
            <a key={c.id} href={`#sec-${slugify(c.name)}`} className="whitespace-nowrap rounded-full border px-3 py-1 text-sm">{c.name}</a>
          ))}
        </nav>
      )}

      <main className="px-4 pb-6">
        {cats.length === 0 && <p className="py-10 text-center text-muted-foreground">Todavía no hay productos cargados.</p>}
        {cats.map((c) => (
          <section key={c.id} id={`sec-${slugify(c.name)}`} className="pt-5">
            <h2 className="mb-3 text-lg font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{c.name}</h2>
            <ul className={listClass}>
              {c.products.map((p) => <Card key={p.id} p={p} layout={layout} preview={preview} />)}
            </ul>
          </section>
        ))}
      </main>

      {(site.hours || site.address || site.deliveryZone || ig) && (
        <section className="space-y-2 border-t px-4 py-5 text-sm" aria-label="Información">
          {site.hours && (
            <div>
              <p className="font-semibold">Horarios</p>
              {summarizeHours(site.hours).map((l) => <p key={l} className="text-muted-foreground">{l}</p>)}
            </div>
          )}
          {site.deliveryZone && <p><span className="font-semibold">Entrega o retiro: </span><span className="text-muted-foreground">{site.deliveryZone}</span></p>}
          {site.address && <p><span className="font-semibold">Dirección: </span><span className="text-muted-foreground">{site.address}</span></p>}
          {ig && <p><span className="font-semibold">Instagram: </span><a className="underline" href={`https://instagram.com/${encodeURIComponent(ig)}`} rel="noopener noreferrer" target="_blank">@{ig}</a></p>}
        </section>
      )}

      <footer className="space-y-3 border-t px-4 py-6 text-center">
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={btn} style={{ borderRadius: "var(--btn-radius)" }}>Consultar por WhatsApp</a>
        ) : (
          <span className={`${btn} opacity-50`} style={{ borderRadius: "var(--btn-radius)" }}>Consultar por WhatsApp</span>
        )}
        {!site.hideBranding && <p className="text-xs text-muted-foreground">Hecho con <strong>MiShowo</strong></p>}
      </footer>
    </div>
  );
}
