import { describe, expect, it } from "vitest";
import { withMedia, type MediaItem } from "./previewMedia";
import type { SiteModel, SiteProduct } from "./site";

const product = (id: string): SiteProduct => ({ id, name: id, description: "", price: 1, comparePrice: null, available: true, isExample: false, options: [], image: null });
const site = (): SiteModel => ({
  name: "Lupe", tagline: "", description: "", whatsapp: "", instagram: "", address: "", deliveryZone: "", hours: null, announcement: "",
  design: { layout: "vidriera", theme: "blanco", fontPair: "moderna", brandColor: null, buttonShape: "recto" },
  categories: [{ id: "c", name: "C", products: [product("a"), product("b")] }], showQuantities: true, askEventDate: false, ordersEnabled: true, whatsappGreeting: "",
  exampleName: false, exampleTexts: false, cover: null,
});
const m = (over: Partial<MediaItem>): MediaItem => ({ id: "x", kind: "image", productId: null, src: "http://api/x-800.webp", srcSet: "http://api/x-400.webp 400w", ...over });

describe("withMedia", () => {
  it("sin archivos devuelve el mismo sitio", () => {
    const s = site();
    expect(withMedia(s, [])).toBe(s);
  });
  it("pone logo, portada y video, y la primera foto de cada producto", () => {
    const out = withMedia(site(), [
      m({ id: "1", kind: "logo", src: "logo" }), m({ id: "2", src: "cover" }), m({ id: "3", kind: "video", src: "vid" }),
      m({ id: "4", productId: "a", src: "a1" }), m({ id: "5", productId: "a", src: "a2" }),
    ]);
    expect(out.logo).toBe("logo");
    expect(out.cover).toBe("cover");
    expect(out.video).toBe("vid");
    const [a, b] = out.categories[0]!.products;
    expect(a!.image).toBe("a1"); // la primera es la que se ve en el catálogo
    expect(b!.image).toBeNull();
  });
  it("la foto de un producto no se usa como portada", () => {
    const out = withMedia(site(), [m({ productId: "a", src: "a1" })]);
    expect(out.cover).toBeNull();
  });
  it("no modifica el sitio original", () => {
    const s = site();
    withMedia(s, [m({ productId: "a", src: "a1" })]);
    expect(s.categories[0]!.products[0]!.image).toBeNull();
  });
});
