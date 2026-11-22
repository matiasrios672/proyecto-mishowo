import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default("postgres://mishowo:mishowo@localhost:5432/mishowo"),
  FRONTEND_ORIGIN: z.string().default("http://localhost:3000"),
  // Dominio raíz: sus subdominios (las páginas de los negocios) pueden llamar a la API.
  ROOT_DOMAIN: z.string().default("localhost"),
  // Pedidos por minuto por IP en el endpoint público de pedidos.
  REPORTS_PER_MINUTE: z.coerce.number().int().positive().default(5),
  ORDERS_PER_MINUTE: z.coerce.number().int().positive().default(20),
  COOKIE_DOMAIN: z.string().optional(),
  UPLOADS_DIR: z.string().default("./uploads"),
});

export type Config = z.infer<typeof schema>;
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => schema.parse(env);
