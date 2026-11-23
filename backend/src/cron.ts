// Tareas programadas. En Coolify se ejecutan como Scheduled Tasks dentro del contenedor:
//   node dist/cron.js expire-plans      (todos los días)
//   node dist/cron.js remind-expiring   (todos los días)
//   node dist/cron.js send-campaigns    (cada 5 minutos: manda los comunicados programados)
//   node dist/cron.js nudge-leads       (todos los días: "retomá tu página" a quien no publicó; solo si está prendido)
//   node dist/cron.js remind-appointments (cada hora: recordatorio de turnos a 24 h)
//   node dist/cron.js all
import { loadConfig } from "./config.js";
import { createDb } from "./db/index.js";
import { createSmtpMailer } from "./lib/mailer.js";
import { createRevalidator } from "./lib/revalidate.js";
import { expirePlans, remindExpiring } from "./jobs/plans.js";
import { CRON_KEY, putSetting } from "./lib/settings.js";
import { sendDueCampaigns } from "./mail/service.js";
import { nudgeLeads } from "./jobs/leads.js";
import { remindAppointments } from "./appointments/notify.js";
import { secretOf } from "./routes/admin-mail.js";

const task = process.argv[2];
const known = ["expire-plans", "remind-expiring", "send-campaigns", "nudge-leads", "remind-appointments", "all"];
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
  if (task === "send-campaigns" || task === "all") console.log(`Comunicados enviados: ${await sendDueCampaigns({ db, mailer, appUrl: config.APP_URL, secret: secretOf(config), log: console.warn })}`);
  if (task === "nudge-leads" || task === "all") console.log(`Avisos a leads: ${await nudgeLeads(db, mailer, config.APP_URL, console.warn)}`);
  if (task === "remind-appointments" || task === "all") console.log(`Recordatorios de turnos: ${await remindAppointments(db, mailer, new Date(), console.warn)}`);
  await putSetting(db, CRON_KEY, { task, at: new Date().toISOString() }); // el admin la muestra en "Estado del sistema"
} catch (e) {
  console.error("La tarea falló:", e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
