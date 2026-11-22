import { describe, expect, it, vi } from "vitest";

// next/font solo existe dentro de Next: acá devolvemos fuentes vacías para poder renderizar la página.
vi.mock("next/font/google", () => {
  const font = () => ({ className: "", variable: "", style: {} });
  return { Playfair_Display: font, Source_Sans_3: font, Poppins: font, Inter: font, Fraunces: font, Nunito_Sans: font, DM_Sans: font };
});

import { renderToStaticMarkup } from "react-dom/server";
import { createDraftFromTemplate, normalizeDraft, type Draft, type TemplateInput } from "./draft";
import { draftToSite, publicToSite, type SiteModel } from "./site";
import type { PublicSite } from "./api";
import { SiteView } from "@/components/site/SiteView";

const tpl: TemplateInput = {
  id: "rotiseria", businessName: "Rotisería Doña Marta", tagline: "Casera", description: "Empanadas", deliveryZone: "Villa Crespo",
  eventDate: false, layout: "mostrador", theme: "terracota", fontPair: "calida",
  categories: [{ name: "Empanadas", products: [{ name: "De carne", description: "x", price: 1800 }, { name: "De humita", description: "y", price: 1700 }] }],
};
const draft = (over: Partial<Draft> = {}): Draft => ({ ...createDraftFromTemplate(tpl), whatsapp: "11 5555-0000", ...over });

const publicSite = (settings: object): PublicSite => ({
  status: "published",
  business: { slug: "lupe", name: "Lupe", industry: "x", description: "", tagline: null, whatsapp: "11 5555-0000", instagram: null, address: null, deliveryZone: null, hours: null, design: { layout: "vidriera", theme: "blanco", fontPair: "moderna", brandColor: null }, settings, planId: "gratis" },
  categories: [{ id: "c", name: "Todo" }],
  products: [{ id: "p1", categoryId: "c", name: "Empanada", description: "", price: "1800", comparePrice: null, available: true, options: [] }],
});

const render = (site: SiteModel, orderable = true) => renderToStaticMarkup(<SiteView site={site} orderable={orderable ? { slug: "lupe" } : undefined} />);

describe("pedidos opcionales: modelo", () => {
  it("un borrador nuevo y uno viejo (sin el campo) tienen los pedidos encendidos", () => {
    expect(draft().ordersEnabled).toBe(true);
    const old = draft() as Partial<Draft>;
    delete old.ordersEnabled;
    expect(normalizeDraft(old as Draft).ordersEnabled).toBe(true);
  });
  it("apagarlos se conserva al normalizar y llega al modelo del sitio", () => {
    const d = draft({ ordersEnabled: false });
    expect(normalizeDraft(d).ordersEnabled).toBe(false);
    expect(draftToSite(d).ordersEnabled).toBe(false);
    expect(draftToSite(draft()).ordersEnabled).toBe(true);
  });
  it("la API pública: solo `false` los apaga (settings viejos o vacíos = encendidos)", () => {
    expect(publicToSite(publicSite({ ordersEnabled: false })).ordersEnabled).toBe(false);
    expect(publicToSite(publicSite({})).ordersEnabled).toBe(true);
    expect(publicToSite(publicSite({ ordersEnabled: true })).ordersEnabled).toBe(true);
    expect(publicToSite(publicSite({ ordersEnabled: "no" })).ordersEnabled).toBe(true);
  });
});

describe("pedidos opcionales: la página", () => {
  it("con pedidos: botón de agregar, barra del pedido y llamado a hacer el pedido", () => {
    const html = render(publicToSite(publicSite({})));
    expect(html).toContain("Hacer mi pedido");
    expect(html).toContain("Mi pedido");
    expect(html).toContain("Pedir es fácil");
    expect(html).toContain("Hacé tu pedido por WhatsApp");
    expect(html).not.toContain("Consultar por");
  });
  it("sin pedidos: sin carrito ni botones de agregar; cada producto ofrece Consultar por WhatsApp con su nombre", () => {
    const html = render(publicToSite(publicSite({ ordersEnabled: false })));
    expect(html).not.toContain("Hacer mi pedido");
    expect(html).not.toContain("Mi pedido");
    expect(html).not.toContain("Pedir es fácil");
    expect(html).not.toContain("Hacé tu pedido");
    expect(html).not.toContain("Agregar");
    expect(html).toContain("Ver el catálogo");
    expect(html).toContain("Consultar es fácil");
    expect(html).toContain("Consultanos por WhatsApp");
    expect(html).toContain('aria-label="Consultar por Empanada por WhatsApp"');
    expect(html).toContain(encodeURIComponent('Hola! Quería consultarles por "Empanada".'));
  });
  it("sin pedidos y sin WhatsApp no inventa botones de consulta", () => {
    const html = render({ ...publicToSite(publicSite({ ordersEnabled: false })), whatsapp: "" });
    expect(html).not.toContain("Consultar");
    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("Mi pedido");
  });
  it("también en la vista previa del editor (sin sesión de pedidos): solo se ve el botón Consultar", () => {
    const html = render(draftToSite(draft({ ordersEnabled: false })), false);
    expect(html).toContain("Consultar");
    expect(html).not.toContain("Hacer mi pedido");
  });
});
