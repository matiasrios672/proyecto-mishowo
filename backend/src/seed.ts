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
  const { seedDemoBusinesses } = await import('./demo.js');
  const created = await seedDemoBusinesses(db, { reset: true });
  console.log(`Negocios de ejemplo: ${created.join(', ')}`);
}
await pool.end();
