import { describe, expect, it } from "vitest";
import { localBusinessJsonLd, safeJsonLd, seoDescription } from "./seo";
import type { SiteModel, SiteProduct } from "./site";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- aserciones sobre JSON arbitrario
type Loose = any;
const product = (over: Partial<SiteProduct> = {}): SiteProduct => ({ id: "p", name: "Pan", description: "", price: 1000, comparePrice: null, available: true, isExample: false, options: [], image: null, ...over });
const site = (over: Partial<SiteModel> = {}): SiteModel => ({
  name: "Lupe", tagline: "", description: "Panadería artesanal", whatsapp: "+54 9 11 5555-0000", instagram: "", address: "Av. Siempre Viva 123", deliveryZone: "",
  hours: null, announcement: "", design: { layout: "vidriera", theme: "blanco", fontPair: "moderna", brandColor: null, buttonShape: "recto" },
  categories: [{ id: "c", name: "Panes", products: [product()] }], showQuantities: true, ordersEnabled: true, askEventDate: false, whatsappGreeting: "",
  exampleName: false, exampleTexts: false, cover: null, ...over,
});

describe("safeJsonLd", () => {
  it("un nombre malicioso no puede cerrar la etiqueta <script> ni inyectar código", () => {
    const evil = site({ name: "</script><script>alert(1)</script>", description: "<img src=x onerror=alert(1)>" });
    const out = safeJsonLd(localBusinessJsonLd(evil, "https://lupe.mishowo.com"));
    expect(out).not.toContain("<");
    expect(out).not.toContain("</script");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>"); // el dato original llega intacto al buscador
  });
  it("escapa los separadores de línea Unicode", () => {
    const out = safeJsonLd({ a: `x${String.fromCharCode(0x2028)}y${String.fromCharCode(0x2029)}z` });
    expect(out).not.toContain(String.fromCharCode(0x2028));
    expect(out).not.toContain(String.fromCharCode(0x2029));
    expect(JSON.parse(out).a).toBe(`x${String.fromCharCode(0x2028)}y${String.fromCharCode(0x2029)}z`);
  });
});

describe("localBusinessJsonLd", () => {
  it("arma un LocalBusiness con teléfono en formato internacional, dirección y catálogo en pesos", () => {
    const ld = localBusinessJsonLd(site(), "https://lupe.mishowo.com", "https://api/foto.webp") as Loose;
    expect(ld["@type"]).toBe("LocalBusiness");
    expect(ld.telephone).toBe("+5491155550000");
    expect(ld.address.streetAddress).toBe("Av. Siempre Viva 123");
    expect(ld.image).toBe("https://api/foto.webp");
    expect(ld.hasOfferCatalog.itemListElement[0]).toMatchObject({ price: 1000, priceCurrency: "ARS", availability: "https://schema.org/InStock" });
  });
  it("marca agotados, saltea los de ejemplo, los sin precio y los sin nombre, y limita a 20", () => {
    const many = Array.from({ length: 30 }, (_, i) => product({ id: `p${i}`, name: `P${i}` }));
    const ld = localBusinessJsonLd(site({ categories: [{ id: "c", name: "C", products: [product({ name: "Agotado", available: false }), product({ name: "Ej", isExample: true }), product({ name: "SinPrecio", price: null }), product({ name: "  " }), ...many] }] }), "https://x") as Loose;
    const items = ld.hasOfferCatalog.itemListElement;
    expect(items).toHaveLength(20);
    expect(items[0].availability).toBe("https://schema.org/OutOfStock");
    expect(JSON.stringify(items)).not.toMatch(/"Ej"|SinPrecio/);
  });
  it("traduce los horarios (lunes=0) y omite los días cerrados o inválidos", () => {
    const hours = Array.from({ length: 7 }, () => ({ open: false, from: "09:00", to: "18:00" }));
    hours[0] = { open: true, from: "09:00", to: "13:00" };
    hours[6] = { open: true, from: "25:00", to: "13:00" };
    const ld = localBusinessJsonLd(site({ hours }), "https://x") as Loose;
    expect(ld.openingHoursSpecification).toEqual([{ "@type": "OpeningHoursSpecification", dayOfWeek: "Monday", opens: "09:00", closes: "13:00" }]);
  });
  it("incluye el logo del negocio cuando lo tiene", () => {
    const ld = localBusinessJsonLd(site({ logo: "https://api/logo-800.webp" }), "https://x") as Loose;
    expect(ld.logo).toBe("https://api/logo-800.webp");
  });
  it("sin datos opcionales no inventa campos vacíos", () => {
    const ld = localBusinessJsonLd(site({ whatsapp: "", address: "", description: "", categories: [] }), "https://x") as Record<string, unknown>;
    for (const k of ["telephone", "address", "description", "hasOfferCatalog", "openingHoursSpecification", "image", "logo"]) expect(ld).not.toHaveProperty(k);
  });
});

describe("seoDescription", () => {
  it("usa la descripción, cae a la frase de presentación y después a un texto genérico", () => {
    expect(seoDescription(site())).toBe("Panadería artesanal");
    expect(seoDescription(site({ description: "", tagline: "El mejor pan" }))).toBe("El mejor pan");
    expect(seoDescription(site({ description: "", tagline: "" }))).toContain("Lupe");
  });
  it("recorta a 160 caracteres y limpia espacios y saltos de línea", () => {
    const d = seoDescription(site({ description: `${"palabra ".repeat(40)}\n\nfin` }));
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d.endsWith("…")).toBe(true);
    expect(d).not.toMatch(/\s{2,}|\n/);
  });
});
