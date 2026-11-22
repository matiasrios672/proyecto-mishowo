// Tareas programadas. En Coolify se ejecutan como Scheduled Tasks dentro del contenedor:
//   node dist/cron.js expire-plans      (todos los días)
//   node dist/cron.js remind-expiring   (todos los días)
//   node dist/cron.js all
import { loadConfig } from "./config.js";
import { createDb } from "./db/index.js";
import { createSmtpMailer } from "./lib/mailer.js";
import { createRevalidator } from "./lib/revalidate.js";
import { expirePlans, remindExpiring } from "./jobs/plans.js";

const task = process.argv[2];
const known = ["expire-plans", "remind-expiring", "all"];
if (!task || !known.includes(task)) {
  console.error(`Uso: cron <${known.join("|")}>`);
  process.exit(2);
}

const config = loadConfig();
const { db, pool } = createDb(config.DATABASE_URL);
const mailer = createSmtpMailer(config);
const notify = createRevalidator(config, (m) => console.warn(m));

try {
  if (task === "expire-plans" || task === "all") console.log(`Planes vencidos pasados a gratis: ${await expirePlans(db, mailer, notify)}`);
  if (task === "remind-expiring" || task === "all") console.log(`Recordatorios enviados: ${await remindExpiring(db, mailer)}`);
} catch (e) {
  console.error("La tarea falló:", e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
