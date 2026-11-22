import { sql } from "drizzle-orm";
import { loadConfig } from "./config.js";
import { createDb } from "./db/index.js";
import { plans } from "./db/schema.js";
import { PLANS } from "./config/plans.js";

const { db, pool } = createDb(loadConfig().DATABASE_URL);

for (const p of PLANS) {
  await db.insert(plans).values({
    id: p.id, name: p.name, priceMonthly: String(p.priceMonthly), limits: p.limits, features: p.features,
  }).onConflictDoUpdate({
    target: plans.id,
    // No pisa precios/límites si ya fueron editados desde el admin.
    set: { name: sql`${plans.name}` },
  });
}
console.log(`Planes sembrados: ${PLANS.map((p) => p.id).join(", ")}`);
if (process.env.SEED_DEMO === '1') {
  const { users, businesses } = await import('./db/schema.js');
  const { eq } = await import('drizzle-orm');
  const { tenantScope } = await import('./db/tenant.js');
  const [u] = await db.insert(users).values({ email: 'demo@mishowo.local' })
    .onConflictDoUpdate({ target: users.email, set: { name: 'Demo' } }).returning();
  // El demo se recrea limpio en cada corrida (borra sus productos y pedidos de prueba).
  await db.delete(businesses).where(eq(businesses.slug, 'lupe-empanadas'));
  const [b] = await db.insert(businesses).values({
    slug: 'lupe-empanadas', ownerId: u!.id, name: 'Empanadas de Lupe', industry: 'rotiseria',
    description: 'Empanadas caseras al horno, por docena o media docena.', tagline: 'Hechas hoy, calentitas siempre',
    whatsapp: '+5491155550000', status: 'published',
    design: { layout: 'vidriera', theme: 'terracota', fontPair: 'calida', brandColor: null },
  }).onConflictDoNothing().returning();
  if (b) {
    const t = tenantScope(db, b.id);
    const c = await t.categories.create({ name: 'Empanadas' });
    const carne = await t.products.create({ name: 'Empanada de carne cortada a cuchillo', description: 'Con cebolla de verdeo, huevo y aceituna.', price: '1800', categoryId: c.id });
    await t.options.create(carne.id, { label: 'Unidad', position: 0 });
    await t.options.create(carne.id, { label: 'Media docena', price: '10200', position: 1 });
    await t.options.create(carne.id, { label: 'Docena', price: '19200', position: 2 });
    await t.products.create({ name: 'Empanada de jamón y queso', price: '1700', categoryId: c.id });
    await t.products.create({ name: 'Empanada de humita', price: '1700', categoryId: c.id, available: false });
    const platos = await t.categories.create({ name: 'Platos del día', position: 1 });
    const extra: [string, string, string][] = [
      ['Milanesa napolitana con puré', 'Para una persona, con puré de papa.', '9500'],
      ['Tarta de zapallitos y queso', 'Porción grande, con ensalada.', '6200'],
      ['Pastel de papa', 'Carne picada, puré gratinado.', '7800'],
      ['Canelones de verdura', 'Con salsa blanca y filetto.', '8400'],
      ['Ensalada completa', 'Lechuga, tomate, huevo y atún.', '5600'],
      ['Flan casero con dulce de leche', 'Con crema.', '3500'],
    ];
    for (const [name, description, price] of extra) await t.products.create({ name, description, price, categoryId: platos.id });
  }
  console.log('Negocio demo: lupe-empanadas');

  // Un negocio demo por rubro, con el contenido y el diseño de su plantilla (para ver todos los layouts).
  const { INDUSTRIES } = await import('./templates/industries.js');
  const hours = Array.from({ length: 7 }, (_, i) => ({ open: i < 6, from: '09:00', to: '19:00' }));
  for (const tpl of INDUSTRIES.filter((i) => ['ropa', 'belleza', 'muebles', 'gimnasio', 'eventos', 'salud'].includes(i.id))) {
    const slug = `demo-${tpl.id}`;
    await db.delete(businesses).where(eq(businesses.slug, slug));
    const [biz] = await db.insert(businesses).values({
      slug, ownerId: u!.id, name: tpl.businessName, industry: tpl.id, description: tpl.description, tagline: tpl.tagline,
      whatsapp: '+5491155550000', instagram: '@' + slug.replace(/-/g, ''), deliveryZone: tpl.deliveryZone,
      address: tpl.id === 'gimnasio' || tpl.id === 'salud' ? tpl.deliveryZone : null, hours,
      design: { layout: tpl.layout, theme: tpl.theme, fontPair: tpl.fontPair, brandColor: null, buttonShape: 'redondeado' },
      settings: { askEventDate: tpl.eventDate, showQuantities: true, whatsappGreeting: 'Hola! Quiero hacer este pedido:' },
      status: 'published',
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
    console.log(`Negocio demo: ${slug}`);
  }
}
await pool.end();
