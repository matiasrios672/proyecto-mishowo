// Utilidades solo para los tests del admin.
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { totp } from "../auth/totp.js";
import { createMemoryMailer } from "../lib/mailer.js";
import type { StorageProvider } from "../storage/index.js";
import type { setupTestDb } from "../db/testdb.js";

export const ORIGIN = "http://localhost:3000";
export const ADMIN_KEY = Buffer.alloc(32, 5).toString("base64");
export type Conn = Awaited<ReturnType<typeof setupTestDb>>;

export function makeEnv(conn: Conn, env: Record<string, string> = {}) {
  const mailer = createMemoryMailer();
  const notified: string[] = [];
  const files = new Map<string, Buffer>();
  const storage: StorageProvider = { put: async (k, d) => void files.set(k, d), get: async (k) => files.get(k) ?? null, delete: async (k) => void files.delete(k) };
  const config = loadConfig({ NODE_ENV: "test", AUTH_PER_MINUTE: "10000", ADMIN_SECRET_KEY: ADMIN_KEY, ADMIN_2FA_PER_MINUTE: "10000", PAYMENTS_PER_MINUTE: "10000", PUBLISH_PER_MINUTE: "10000", ...env });
  const app = buildApp(config, conn.check, conn.db, { mailer, storage, onSiteChanged: (s) => void notified.push(s) });
  const call = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, cookie?: string, payload?: object, origin: string | null = ORIGIN, remoteAddress?: string) =>
    app.inject({ method, url, payload, remoteAddress, headers: { ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) } });

  const cookieOf = (res: { cookies: { name: string; value: string }[] }) => `ms_session=${res.cookies.find((x) => x.name === "ms_session")!.value}`;

  /** Crea una cuenta con el rol dado. Devuelve su id y una sesión (todavía sin 2FA). */
  async function account(email: string, role: "user" | "owner" | "admin" | "support" = "user") {
    const res = await app.inject({ method: "POST", url: "/auth/register", headers: { origin: ORIGIN }, payload: { email, password: "claveSegura123", name: "Test", lastName: "Persona", phone: "11 5555-0000" } });
    const id = res.json().user.id as string;
    if (role !== "user") await conn.pool.query("update users set role = $1 where id = $2", [role, id]);
    return { id, email, cookie: cookieOf(res) };
  }

  /** Cuenta de administración con el 2FA configurado y la sesión ya verificada. */
  async function admin(email: string, role: "owner" | "admin" | "support" = "admin", ip?: string) {
    const a = await account(email, role);
    const setup = await call("POST", "/admin/2fa/setup", a.cookie, {}, ORIGIN, ip);
    const secret = setup.json().secret as string;
    await call("POST", "/admin/2fa/enable", a.cookie, { code: totp(secret) }, ORIGIN, ip);
    return { ...a, secret };
  }

  /** Nueva sesión (por contraseña) de un admin que ya tiene 2FA: llega sin verificar. */
  async function login(email: string) {
    const res = await app.inject({ method: "POST", url: "/auth/login", headers: { origin: ORIGIN }, payload: { email, password: "claveSegura123" } });
    return cookieOf(res);
  }

  return { app, call, mailer, notified, files, config, account, admin, login, cookieOf };
}

export const count = async (conn: Conn, table: string, where = "true") => (await conn.pool.query(`select count(*)::int as n from ${table} where ${where}`)).rows[0].n as number;
export const lastAudit = async (conn: Conn, action: string) => (await conn.pool.query("select * from audit_log where action = $1 order by id desc limit 1", [action])).rows[0];
export const RESET = "truncate table coupon_redemptions, coupons, appointments, appointment_settings, audit_log, subscriptions, payments, order_items, orders, product_options, products, categories, businesses, auth_tokens, sessions, users, reports, app_settings, plans restart identity cascade";
