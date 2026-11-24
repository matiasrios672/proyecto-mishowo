// Recupera el acceso de un administrador cuando no se acuerda su usuario o su contraseña:
//   npm run admin:reset -- ana@correo.com                 (genera una contraseña nueva y la muestra)
//   npm run admin:reset -- ana@correo.com MiClaveNueva1   (usa la que le pases)
//   npm run admin:reset -- ana@correo.com --keep-2fa       (no reinicia el segundo factor)
// Si la cuenta no existe la crea como Owner. En producción (contenedor): node dist/admin-reset.js <email> [clave] [--keep-2fa]
// Deja la cuenta como Owner con el email confirmado, cierra todas sus sesiones y, salvo --keep-2fa,
// borra el 2FA para que al ingresar pida configurarlo de nuevo (hace falta si se perdió la app de autenticación).
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { loadConfig } from "./config.js";
import { createDb } from "./db/index.js";
import * as s from "./db/schema.js";
import { audit } from "./audit.js";
import { hashPassword } from "./lib/security.js";

const args = process.argv.slice(2);
const keep2fa = args.includes("--keep-2fa");
const [email, given] = args.filter((a) => !a.startsWith("--"));
if (!email || !email.includes("@")) {
  console.error("Uso: admin:reset <email> [contraseña nueva] [--keep-2fa]");
  process.exit(2);
}
if (given && given.length < 8) {
  console.error("La contraseña tiene que tener al menos 8 caracteres.");
  process.exit(2);
}

// Sin caracteres que se confunden (0/O, 1/l/I) para poder dictarla o copiarla sin errores.
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generate = () => Array.from(randomBytes(14), (b) => ALPHABET[b % ALPHABET.length]).join("");
const password = given ?? generate();
const normalized = email.toLowerCase();

const { db, pool } = createDb(loadConfig().DATABASE_URL);
try {
  const passwordHash = await hashPassword(password);
  const [u] = await db.select().from(s.users).where(eq(s.users.email, normalized));
  const reset2fa = keep2fa ? {} : { totpSecret: null, totpEnabledAt: null };
  let id: string;
  if (u) {
    id = u.id;
    await db.transaction(async (tx) => {
      await tx.update(s.users).set({ role: "owner", passwordHash, blockedAt: null, emailVerifiedAt: u.emailVerifiedAt ?? new Date(), ...reset2fa }).where(eq(s.users.id, u.id));
      await tx.delete(s.sessions).where(eq(s.sessions.userId, u.id));
      await audit(tx, { actorId: null, action: "admin.cli_reset", entity: "user", entityId: u.id, before: { role: u.role }, after: { role: "owner", reset2fa: !keep2fa } });
    });
  } else {
    const [created] = await db.insert(s.users).values({ email: normalized, name: "Owner", role: "owner", passwordHash, emailVerifiedAt: new Date() }).returning();
    id = created!.id;
    await audit(db, { actorId: null, action: "admin.cli_reset", entity: "user", entityId: id, before: null, after: { role: "owner", created: true } });
  }
  console.log(`\nListo. ${u ? "Cuenta actualizada" : "Cuenta creada"} como Owner.\n  Usuario (email): ${normalized}\n  Contraseña:      ${password}\n`);
  console.log(keep2fa ? "Se mantuvo el 2FA." : "El 2FA se reinició: al ingresar al panel vas a configurarlo de nuevo con tu app de autenticación.");
  console.log("Ingresá en /ingresar y cambiá la contraseña desde «Olvidé mi contraseña» cuando quieras.");
} finally {
  await pool.end();
}
