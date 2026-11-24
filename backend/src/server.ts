import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import { createDb, runMigrations } from "./db/index.js";

const config = loadConfig();
await runMigrations(config.DATABASE_URL);
const { check, db } = createDb(config.DATABASE_URL);
// Los negocios de ejemplo que enlaza la landing (demo-ropa, demo-eventos…) tienen que existir también en producción.
// Solo crea los que faltan; se apaga con SEED_DEMO_ON_BOOT=0.
if (process.env.SEED_DEMO_ON_BOOT !== "0") {
  try {
    const { seedDemoBusinesses } = await import("./demo.js");
    const created = await seedDemoBusinesses(db);
    if (created.length) console.log(`Negocios de ejemplo creados: ${created.join(", ")}`);
  } catch (err) {
    console.error("No se pudieron crear los negocios de ejemplo (¿faltan sembrar los planes?):", (err as Error).message);
  }
}
const app = buildApp(config, check, db);

app.listen({ port: config.PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
