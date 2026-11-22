import { createHmac, randomBytes } from "node:crypto";

// TOTP (RFC 6238) con HMAC-SHA1, 6 dígitos y paso de 30 s: compatible con Google Authenticator, Authy, 1Password, etc.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str: string): Buffer {
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of str.replace(/=+$/, "").toUpperCase()) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("base32 inválido");
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

export function hotp(secret: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", secret).update(msg).digest();
  const o = h[h.length - 1]! & 0xf;
  const code = ((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(code % 10 ** digits).padStart(digits, "0");
}

export function totp(secretB32: string, nowMs = Date.now(), digits = 6): string {
  return hotp(base32Decode(secretB32), Math.floor(nowMs / 1000 / 30), digits);
}

/** Acepta el código del paso actual y el anterior/siguiente (relojes un poco desfasados). Comparación en tiempo constante. */
export function verifyTotp(secretB32: string, code: string, nowMs = Date.now(), window = 1): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const key = base32Decode(secretB32);
  const step = Math.floor(nowMs / 1000 / 30);
  let ok = false;
  for (let w = -window; w <= window; w++) {
    const expected = hotp(key, step + w);
    let diff = 0;
    for (let i = 0; i < 6; i++) diff |= expected.charCodeAt(i) ^ code.charCodeAt(i);
    if (diff === 0) ok = true; // no se corta el ciclo: tarda lo mismo acierte donde acierte
  }
  return ok;
}

export const otpauthUrl = (email: string, secret: string, issuer = "MiShowo") =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
