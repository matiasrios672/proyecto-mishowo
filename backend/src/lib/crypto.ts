import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Cifrado de secretos en reposo (ej. el secreto TOTP del admin) con AES-256-GCM. El formato guardado es
// "v1.<iv>.<tag>.<datos>" en base64url. GCM detecta cualquier alteración del dato.
const key = (b64: string) => {
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("ADMIN_SECRET_KEY tiene que ser una clave de 32 bytes en base64");
  return k;
};

export function encryptSecret(plain: string, keyB64: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(keyB64), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(stored: string, keyB64: string): string {
  const [v, iv, tag, data] = stored.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Formato de secreto inválido");
  const d = createDecipheriv("aes-256-gcm", key(keyB64), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}
