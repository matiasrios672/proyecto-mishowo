// Valores por defecto de planes. Los precios finales los define el dueño:
// son PLACEHOLDERS hasta confirmarlos. Si se editan desde el admin, la DB manda.
export type PlanId = "gratis" | "emprende" | "pro";

export interface PlanDef {
  id: PlanId;
  name: string;
  priceMonthly: number; // ARS
  limits: { products: number | null; photosPerProduct: number; whatsappNumbers: number; uploadMb: number };
  features: string[];
}

export const PLANS: PlanDef[] = [
  { id: "gratis", name: "Gratis", priceMonthly: 0,
    limits: { products: 15, photosPerProduct: 2, whatsappNumbers: 1, uploadMb: 5 },
    features: ["Subdominio mishowo.com", "Pedidos por WhatsApp", "Marca «Hecho con MiShowo»"] },
  { id: "emprende", name: "Emprende", priceMonthly: 9900,
    limits: { products: null, photosPerProduct: 4, whatsappNumbers: 1, uploadMb: 10 },
    features: ["Productos ilimitados", "Panel de pedidos", "Cupones", "Estadísticas básicas"] },
  { id: "pro", name: "Pro", priceMonthly: 19900,
    limits: { products: null, photosPerProduct: 6, whatsappNumbers: 5, uploadMb: 10 },
    features: ["Turnos con calendario", "Estadísticas completas", "Pixel de Meta y Google Analytics", "Varios WhatsApp"] },
];
