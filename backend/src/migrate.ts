import { loadConfig } from "./config.js";
import { runMigrations } from "./db/index.js";

await runMigrations(loadConfig().DATABASE_URL);
console.log("Migraciones aplicadas");
