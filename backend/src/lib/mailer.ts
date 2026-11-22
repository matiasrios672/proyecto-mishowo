import nodemailer from "nodemailer";
import type { Config } from "../config.js";

export interface Mail { to: string; subject: string; text: string; html?: string }
export interface Mailer { send(mail: Mail): Promise<void> }

/** SMTP genérico (Mailpit en desarrollo, el proveedor real en producción), todo por variables de entorno. */
export function createSmtpMailer(config: Config): Mailer {
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE === "true",
    ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASS ?? "" } } : {}),
  });
  return { send: async (m) => void (await transport.sendMail({ from: config.MAIL_FROM, ...m })) };
}

/** Para tests: guarda los mails en memoria en vez de enviarlos. */
export function createMemoryMailer(): Mailer & { outbox: Mail[] } {
  const outbox: Mail[] = [];
  return { outbox, send: async (m) => void outbox.push(m) };
}
