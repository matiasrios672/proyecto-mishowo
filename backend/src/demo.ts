import { eq, inArray } from "drizzle-orm";
import type { Db } from "./db/tenant.js";
import { tenantScope } from "./db/tenant.js";
import { appointmentSettings, businesses, users } from "./db/schema.js";
import { INDUSTRIES } from "./templates/industries.js";

/** Cuenta dueña de todos los negocios de ejemplo. No tiene contraseña: no se puede ingresar con ella. */
export const DEMO_OWNER_EMAIL = "demo@mishowo.local";
const DEMO_INDUSTRIES = ["ropa", "belleza", "muebles", "gimnasio", "eventos", "salud"];
export const DEMO_SLUGS = ["lupe-empanadas", ...DEMO_INDUSTRIES.map((i) => `demo-${i}`)];

/**
 * Crea los negocios de ejemplo que enlaza la landing (demo-ropa, demo-eventos, etc.).
 * Sin `reset` solo crea los que faltan y no toca nada existente: es seguro correrlo en cada arranque.
 * Con `reset` los recrea limpios. Devuelve los slugs creados.
 */
export async function seedDemoBusinesses(db: Db, opts: { reset?: boolean } = {}): Promise<string[]> {
  const existing = new Set((await db.select({ slug: businesses.slug }).from(businesses).where(inArray(businesses.slug, DEMO_SLUGS))).map((b) => b.slug));
  const missing = (slug: string) => opts.reset || !existing.has(slug);
  if (DEMO_SLUGS.every((s) => !missing(s))) return [];

  const [u] = await db.insert(users).values({ email: DEMO_OWNER_EMAIL })
    .onConflictDoUpdate({ target: users.email, set: { name: "Demo" } }).returning();
  const created: string[] = [];

  if (missing("lupe-empanadas")) {
    await db.delete(businesses).where(eq(businesses.slug, "lupe-empanadas"));
    const [b] = await db.insert(businesses).values({
      slug: "lupe-empanadas", ownerId: u!.id, name: "Empanadas de Lupe", industry: "rotiseria",
      description: "Empanadas caseras al horno, por docena o media docena.", tagline: "Hechas hoy, calentitas siempre",
      whatsapp: "+5491155550000", status: "published",
      design: { layout: "vidriera", theme: "terracota", fontPair: "calida", brandColor: null },
    }).onConflictDoNothing().returning();
    if (b) {
      const t = tenantScope(db, b.id);
      const c = await t.categories.create({ name: "Empanadas" });
      const carne = await t.products.create({ name: "Empanada de carne cortada a cuchillo", description: "Con cebolla de verdeo, huevo y aceituna.", price: "1800", categoryId: c.id });
      await t.options.create(carne.id, { label: "Unidad", position: 0 });
      await t.options.create(carne.id, { label: "Media docena", price: "10200", position: 1 });
      await t.options.create(carne.id, { label: "Docena", price: "19200", position: 2 });
      await t.products.create({ name: "Empanada de jamón y queso", price: "1700", categoryId: c.id });
      await t.products.create({ name: "Empanada de humita", price: "1700", categoryId: c.id, available: false });
      const platos = await t.categories.create({ name: "Platos del día", position: 1 });
      const extra: [string, string, string][] = [
        ["Milanesa napolitana con puré", "Para una persona, con puré de papa.", "9500"],
        ["Tarta de zapallitos y queso", "Porción grande, con ensalada.", "6200"],
        ["Pastel de papa", "Carne picada, puré gratinado.", "7800"],
        ["Canelones de verdura", "Con salsa blanca y filetto.", "8400"],
        ["Ensalada completa", "Lechuga, tomate, huevo y atún.", "5600"],
        ["Flan casero con dulce de leche", "Con crema.", "3500"],
      ];
      for (const [name, description, price] of extra) await t.products.create({ name, description, price, categoryId: platos.id });
      created.push("lupe-empanadas");
    }
  }

  // Un negocio por rubro, con el contenido y el diseño de su plantilla (para ver todos los layouts).
  const hours = Array.from({ length: 7 }, (_, i) => ({ open: i < 6, from: "09:00", to: "19:00" }));
  for (const tpl of INDUSTRIES.filter((i) => DEMO_INDUSTRIES.includes(i.id))) {
    const slug = `demo-${tpl.id}`;
    if (!missing(slug)) continue;
    await db.delete(businesses).where(eq(businesses.slug, slug));
    const [biz] = await db.insert(businesses).values({
      slug, ownerId: u!.id, name: tpl.businessName, industry: tpl.id, description: tpl.description, tagline: tpl.tagline,
      whatsapp: "+5491155550000", instagram: "@" + slug.replace(/-/g, ""), deliveryZone: tpl.deliveryZone,
      address: tpl.id === "gimnasio" || tpl.id === "salud" ? tpl.deliveryZone : null, hours,
      design: { layout: tpl.layout, theme: tpl.theme, fontPair: tpl.fontPair, brandColor: null, buttonShape: "redondeado" },
      settings: {
        askEventDate: tpl.eventDate, showQuantities: true, whatsappGreeting: "Hola! Quiero hacer este pedido:",
        installments: { enabled: ["ropa", "eventos", "muebles"].includes(tpl.id), count: tpl.id === "ropa" ? 6 : 3, note: "", minAmount: 0 },
      },
      status: "published",
    }).returning();
    const t = tenantScope(db, biz!.id);
    let pos = 0;
    for (const cat of tpl.categories) {
      const c = await t.categories.create({ name: cat.name, position: pos++ });
      for (const p of cat.products) {
        const prod = await t.products.create({ name: p.name, description: p.description, price: String(p.price), categoryId: c.id });
        for (const [i, o] of (p.options ?? []).entries()) await t.options.create(prod.id, { label: o.label, price: o.price ? String(o.price) : null, position: i });
      }
    }
    // Turnos de ejemplo en los negocios de servicios: servicios con duración y precio, y dos profesionales.
    if (tpl.mode === "servicios") {
      await db.insert(appointmentSettings).values({
        businessId: biz!.id, enabled: true, slotMinutes: 30, minNoticeHours: 2, horizonDays: 30,
        services: tpl.categories.flatMap((c) => c.products).slice(0, 4).map((p, i) => ({ name: p.name.slice(0, 60), minutes: [30, 45, 60, 90][i] ?? 30, price: p.price })),
        staff: [{ id: "sofi0001", name: "Sofi" }, { id: "lu000002", name: "Lu" }],
      }).onConflictDoNothing();
    }
    created.push(slug);
  }
  return created;
}
