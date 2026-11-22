import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import { createDb, runMigrations } from "./db/index.js";

const config = loadConfig();
await runMigrations(config.DATABASE_URL);
const { check } = createDb(config.DATABASE_URL);
const app = buildApp(config, check);

app.listen({ port: config.PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
