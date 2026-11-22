// Nombra al primer administrador (no se puede hacer desde la web a propósito):
//   npm run admin:promote -- ana@correo.com owner
// La persona tiene que haberse registrado antes. Al ingresar, el sistema le pide configurar el 2FA.
import { eq } from "drizzle-orm";
import { loadConfig } from "./config.js";
import { createDb } from "./db/index.js";
import * as s from "./db/schema.js";
import { audit } from "./audit.js";

const [email, role] = [process.argv[2]?.toLowerCase(), process.argv[3]];
if (!email || !role || !["owner", "admin", "support", "user"].includes(role)) {
  console.error("Uso: admin:promote <email> <owner|admin|support|user>");
  process.exit(2);
}

const { db, pool } = createDb(loadConfig().DATABASE_URL);
try {
  const [u] = await db.select().from(s.users).where(eq(s.users.email, email));
  if (!u) {
    console.error(`No hay una cuenta con ${email}. Pedile que se registre primero.`);
    process.exitCode = 1;
  } else {
    await db.transaction(async (tx) => {
      await tx.update(s.users).set({ role }).where(eq(s.users.id, u.id));
      await tx.delete(s.sessions).where(eq(s.sessions.userId, u.id));
      await audit(tx, { actorId: null, action: "admin.cli_role", entity: "user", entityId: u.id, before: { role: u.role }, after: { role } });
    });
    console.log(`${email}: ${u.role} -> ${role}. ${role !== "user" ? "Al ingresar va a tener que configurar el 2FA." : ""}`);
  }
} finally {
  await pool.end();
}
