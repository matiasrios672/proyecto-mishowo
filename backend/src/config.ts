import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default("postgres://mishowo:mishowo@localhost:5432/mishowo"),
  FRONTEND_ORIGIN: z.string().default("http://localhost:3000"),
  // Dominio raíz: sus subdominios (las páginas de los negocios) pueden llamar a la API.
  ROOT_DOMAIN: z.string().default("localhost"),
  // Pedidos por minuto por IP en el endpoint público de pedidos.
  // Administración: clave AES-256 (32 bytes en base64) para cifrar los secretos 2FA; sin ella el 2FA no se puede activar.
  ADMIN_SECRET_KEY: z.string().optional(),
  // Lista de IPs permitidas para /admin (separadas por coma). Vacío = sin restricción.
  ADMIN_ALLOWED_IPS: z.string().optional(),
  ADMIN_VERIFY_HOURS: z.coerce.number().positive().default(8),
  ADMIN_SESSION_HOURS: z.coerce.number().positive().default(12),
  ADMIN_2FA_PER_MINUTE: z.coerce.number().int().positive().default(6),
  EVENTS_PER_MINUTE: z.coerce.number().int().positive().default(120),
  UPLOADS_PER_MINUTE: z.coerce.number().int().positive().default(60),
  PAYMENTS_PER_MINUTE: z.coerce.number().int().positive().default(10),
  PUBLISH_PER_MINUTE: z.coerce.number().int().positive().default(20),
  REPORTS_PER_MINUTE: z.coerce.number().int().positive().default(5),
  // Frontend público (para armar los links de los emails).
  // URL pública de este backend (para armar los links absolutos a las fotos y videos).
  API_PUBLIC_URL: z.string().default("http://localhost:4000"),
  APP_URL: z.string().default("http://localhost:3000"),
  // Para avisar al frontend que invalide el caché de una página (si falta el secreto, no se avisa).
  FRONTEND_INTERNAL_URL: z.string().default("http://localhost:3000"),
  REVALIDATE_SECRET: z.string().min(16).optional(),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  MAIL_FROM: z.string().default("MiShowo <no-reply@mishowo.com>"),
  SESSION_DAYS: z.coerce.number().int().positive().default(30),
  // Intentos por minuto y por IP en cada ruta de /auth.
  AUTH_PER_MINUTE: z.coerce.number().int().positive().default(10),
  ORDERS_PER_MINUTE: z.coerce.number().int().positive().default(20),
  COOKIE_DOMAIN: z.string().optional(),
  UPLOADS_DIR: z.string().default("./uploads"),
});

export type Config = z.infer<typeof schema>;
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => schema.parse(env);
