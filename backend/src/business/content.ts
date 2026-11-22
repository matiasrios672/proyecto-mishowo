import { z } from "zod";
import { designSchema } from "../lib/design.js";

// Documento completo del editor ("borrador"). Es lo que viaja entre el editor y el servidor.
// Es tolerante con lo que la persona va escribiendo (nombre vacío, hora a medio cargar), pero con límites duros de tamaño.

const money = z.number().min(0).max(1_000_000_000).nullable();
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const clientId = z.string().min(1).max(64);

const option = z.object({
  id: clientId,
  label: z.string().max(60),
  price: money,
  soldOut: z.boolean(),
});

const product = z.object({
  id: clientId,
  name: z.string().max(80),
  description: z.string().max(400),
  price: money,
  comparePrice: money,
  available: z.boolean(),
  stock: z.number().int().min(0).max(1_000_000).nullable(),
  isExample: z.boolean(),
  options: z.array(option).max(100),
});

const category = z.object({
  id: clientId,
  name: z.string().max(60),
  products: z.array(product).max(500),
});

export const contentSchema = z
  .object({
    industryId: z.string().max(40),
    name: z.string().max(60),
    nameIsExample: z.boolean(),
    tagline: z.string().max(200),
    description: z.string().max(300),
    textsAreExample: z.boolean(),
    whatsapp: z.string().max(30),
    instagram: z.string().max(60),
    address: z.string().max(200),
    deliveryZone: z.string().max(150),
    extraWhatsapps: z.array(z.object({ number: z.string().max(30), role: z.enum(["ventas", "soporte"]) })).max(5),
    // "" = hora a medio cargar en un <input type="time">
    hours: z.array(z.object({ open: z.boolean(), from: z.union([hhmm, z.literal("")]), to: z.union([hhmm, z.literal("")]) })).length(7),
    announcement: z.string().max(120),
    whatsappGreeting: z.string().max(200),
    showQuantities: z.boolean(),
    askEventDate: z.boolean(),
    design: designSchema.extend({ buttonShape: z.enum(["redondeado", "pildora", "recto"]) }),
    categories: z.array(category).max(30),
  })
  .superRefine((c, ctx) => {
    const products = c.categories.flatMap((x) => x.products);
    const options = products.flatMap((p) => p.options);
    const dupe = (ids: string[]) => new Set(ids).size !== ids.length;
    if (dupe(c.categories.map((x) => x.id))) ctx.addIssue({ code: "custom", message: "duplicate_category_id" });
    if (dupe(products.map((p) => p.id))) ctx.addIssue({ code: "custom", message: "duplicate_product_id" });
    if (dupe(options.map((o) => o.id))) ctx.addIssue({ code: "custom", message: "duplicate_option_id" });
    if (products.length > 1000) ctx.addIssue({ code: "custom", message: "too_many_products" });
    if (options.length > 5000) ctx.addIssue({ code: "custom", message: "too_many_options" });
  });

export type Content = z.infer<typeof contentSchema>;

export function defaultHours() {
  return Array.from({ length: 7 }, (_, i) => ({ open: i < 6, from: "09:00", to: "18:00" }));
}
