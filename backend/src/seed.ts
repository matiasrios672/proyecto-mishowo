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
  const { tenantScope } = await import('./db/tenant.js');
  const [u] = await db.insert(users).values({ email: 'demo@mishowo.local' })
    .onConflictDoUpdate({ target: users.email, set: { name: 'Demo' } }).returning();
  const [b] = await db.insert(businesses).values({
    slug: 'lupe-empanadas', ownerId: u!.id, name: 'Empanadas de Lupe', industry: 'rotiseria',
    description: 'Empanadas caseras al horno, por docena o media docena.', tagline: 'Hechas hoy, calentitas siempre',
    whatsapp: '+5491155550000', status: 'published',
    design: { layout: 'vidriera', theme: 'terracota', fontPair: 'calida', brandColor: null },
  }).onConflictDoNothing().returning();
  if (b) {
    const t = tenantScope(db, b.id);
    const c = await t.categories.create({ name: 'Empanadas' });
    await t.products.create({ name: 'Empanada de carne cortada a cuchillo', price: '1800', categoryId: c.id, isExample: true });
    await t.products.create({ name: 'Empanada de jamón y queso', price: '1700', categoryId: c.id, isExample: true });
    await t.products.create({ name: 'Empanada de humita', price: '1700', categoryId: c.id, available: false, isExample: true });
  }
  console.log('Negocio demo: lupe-empanadas');
}
await pool.end();
