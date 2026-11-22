import pg from "pg";
import { createDb, runMigrations } from "./index.js";

const BASE = process.env.TEST_DATABASE_URL_BASE ?? "postgres://mishowo:mishowo@localhost:5432";

/** Crea (si no existe) una base de datos de pruebas aislada y le aplica las migraciones. */
export async function setupTestDb(name = "mishowo_test") {
  const admin = new pg.Client({ connectionString: `${BASE}/postgres` });
  await admin.connect();
  const exists = await admin.query("select 1 from pg_database where datname = $1", [name]);
  if (exists.rowCount === 0) await admin.query(`create database ${name}`);
  await admin.end();
  const url = `${BASE}/${name}`;
  await runMigrations(url);
  const conn = createDb(url);
  await conn.pool.query(
    "truncate table order_items, orders, product_options, media, products, categories, memberships, subscriptions, payments, businesses, sessions, users restart identity cascade",
  );
  return conn;
}
