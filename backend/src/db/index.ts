import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "./schema.js";

export function createDb(databaseUrl: string) {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
  // Sin este handler, una caída de la DB mata el proceso por un error no capturado.
  pool.on("error", (err) => console.error("pg pool error:", err.message));
  const db = drizzle(pool, { schema });
  const check = async () => {
    await pool.query("select 1");
    return true;
  };
  return { db, pool, check };
}

export async function runMigrations(databaseUrl: string, folder = "./drizzle") {
  const { db, pool } = createDb(databaseUrl);
  await migrate(db, { migrationsFolder: folder });
  await pool.end();
}
