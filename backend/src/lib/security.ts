import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

export const newToken = () => randomBytes(32).toString("base64url");
export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export const hashPassword = (password: string) => hash(password);

// Hash de relleno: al loguear con un email que no existe se verifica igual contra este,
// para que el tiempo de respuesta no revele qué emails tienen cuenta.
const DUMMY = "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$Wy0qGZc0Zo3m1Zr9mV9d9mhR8dE1y8m5f8Qk3m0a0Zc";

export async function verifyPassword(password: string, passwordHash: string | null): Promise<boolean> {
  if (!passwordHash) {
    await verify(DUMMY, password).catch(() => false);
    return false;
  }
  return verify(passwordHash, password).catch(() => false);
}

export const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
