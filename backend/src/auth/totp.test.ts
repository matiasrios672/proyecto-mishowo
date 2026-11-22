import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, hotp, newTotpSecret, otpauthUrl, totp, verifyTotp } from "./totp.js";
import { decryptSecret, encryptSecret } from "../lib/crypto.js";

// Vectores de prueba oficiales del RFC 6238 (apéndice B) y del RFC 4226 (apéndice D): secreto ASCII "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP contra los vectores oficiales", () => {
  it("RFC 6238: códigos de 8 dígitos para los tiempos de prueba", () => {
    const key = Buffer.from("12345678901234567890");
    const cases: [number, string][] = [[59, "94287082"], [1111111109, "07081804"], [1111111111, "14050471"], [1234567890, "89005924"], [2000000000, "69279037"], [20000000000, "65353130"]];
    for (const [t, expected] of cases) expect(hotp(key, Math.floor(t / 30), 8), String(t)).toBe(expected);
  });
  it("RFC 4226: los 10 primeros códigos HOTP", () => {
    const key = Buffer.from("12345678901234567890");
    const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
    expected.forEach((code, i) => expect(hotp(key, i)).toBe(code));
  });
  it("totp() usa el paso de 30 s y 6 dígitos", () => {
    expect(totp(RFC_SECRET, 59_000)).toBe("287082");
    expect(totp(RFC_SECRET, 29_999)).toBe("755224");
  });
});

describe("verifyTotp", () => {
  const now = 1_700_000_000_000;
  const code = totp(RFC_SECRET, now);
  it("acepta el código del paso actual, el anterior y el siguiente", () => {
    expect(verifyTotp(RFC_SECRET, code, now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, now + 30_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, now - 30_000)).toBe(true);
  });
  it("rechaza un código vencido (más de un paso de diferencia)", () => {
    expect(verifyTotp(RFC_SECRET, code, now + 90_000)).toBe(false);
    expect(verifyTotp(RFC_SECRET, code, now - 90_000)).toBe(false);
  });
  it("rechaza formatos inválidos y códigos de otro secreto", () => {
    for (const bad of ["", "12345", "1234567", "abcdef", "12 345", " 123456"]) expect(verifyTotp(RFC_SECRET, bad, now), bad).toBe(false);
    expect(verifyTotp(newTotpSecret(), code, now)).toBe(false);
  });
});

describe("base32 y otpauth", () => {
  it("ida y vuelta", () => {
    for (const len of [1, 5, 10, 20, 33]) {
      const buf = Buffer.from(Array.from({ length: len }, (_, i) => (i * 37 + 11) % 256));
      expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
    }
    expect(() => base32Decode("1!")).toThrow();
  });
  it("genera secretos distintos de 32 caracteres y un enlace para la app", () => {
    const a = newTotpSecret(), b = newTotpSecret();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(a).not.toBe(b);
    expect(otpauthUrl("ana@test.com", a)).toBe(`otpauth://totp/MiShowo:ana%40test.com?secret=${a}&issuer=MiShowo&algorithm=SHA1&digits=6&period=30`);
  });
});

describe("cifrado del secreto en reposo", () => {
  const KEY = Buffer.alloc(32, 7).toString("base64");
  it("cifra y descifra, y el texto cifrado no contiene el secreto", () => {
    const enc = encryptSecret("JBSWY3DPEHPK3PXP", KEY);
    expect(enc).not.toContain("JBSWY3DPEHPK3PXP");
    expect(enc.startsWith("v1.")).toBe(true);
    expect(decryptSecret(enc, KEY)).toBe("JBSWY3DPEHPK3PXP");
  });
  it("cada cifrado es distinto (IV aleatorio)", () => {
    expect(encryptSecret("x", KEY)).not.toBe(encryptSecret("x", KEY));
  });
  it("detecta alteraciones y claves equivocadas", () => {
    const enc = encryptSecret("secreto", KEY);
    const parts = enc.split(".");
    const tampered = [parts[0], parts[1], parts[2], Buffer.from("otra cosa").toString("base64url")].join(".");
    expect(() => decryptSecret(tampered, KEY)).toThrow();
    expect(() => decryptSecret(enc, Buffer.alloc(32, 9).toString("base64"))).toThrow();
    expect(() => decryptSecret("basura", KEY)).toThrow();
    expect(() => encryptSecret("x", Buffer.alloc(8).toString("base64"))).toThrow(/32 bytes/);
  });
});
