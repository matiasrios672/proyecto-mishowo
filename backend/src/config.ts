import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default("postgres://mishowo:mishowo@localhost:5432/mishowo"),
  FRONTEND_ORIGIN: z.string().default("http://localhost:3000"),
  // Dominio raíz: sus subdominios (las páginas de los negocios) pueden llamar a la API.
  ROOT_DOMAIN: z.string().default("localhost"),
  // Pedidos por minuto por IP en el endpoint público de pedidos.
  PUBLISH_PER_MINUTE: z.coerce.number().int().positive().default(20),
  REPORTS_PER_MINUTE: z.coerce.number().int().positive().default(5),
  // Frontend público (para armar los links de los emails).
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
