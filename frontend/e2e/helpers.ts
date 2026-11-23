import { expect, type Page } from "@playwright/test";

// Utilidades compartidas por los e2e que necesitan una cuenta real (backend + Mailpit del stack).
export const MAILPIT = "http://localhost:8025/api/v1";
export const PASS = "claveSegura123";
/** Cierra sesión desde la barra lateral del panel (en celular está dentro del botón Menú). */
export async function signOutFromShell(page: Page) {
  const menu = page.getByRole("button", { name: "Menú" });
  const logout = page.getByRole("button", { name: "Cerrar sesión" });
  await menu.or(logout).first().waitFor(); // la barra tarda un instante en aparecer al cargar la sesión
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
}
export const status = (page: Page) => page.getByTestId("save-status");
export const uniq = (tag: string, project: string) => `${tag}-${project}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export async function tokenFromMail(to: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const list = await (await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:${to}`)}`)).json();
    if (list.messages?.length) {
      const msg = await (await fetch(`${MAILPIT}/message/${list.messages[list.messages.length - 1].ID}`)).json();
      const m = (msg.Text as string).match(/token=([^\s&]+)/);
      if (m) return decodeURIComponent(m[1]!);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No llegó el mail a ${to}`);
}

export async function mailSubjects(to: string): Promise<string[]> {
  const list = await (await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:${to}`)}`)).json();
  return (list.messages ?? []).map((m: { Subject: string }) => m.Subject);
}

/** Crea la cuenta desde /crear (primer paso del recorrido) y elige el rubro «Rotisería y comidas». Termina en el editor, con el borrador ya guardado en la cuenta. */
export async function signUp(page: Page, mail: string) {
  await page.goto("/crear");
  await page.getByLabel(/^Tu nombre/).fill("Persona de Prueba");
  await page.getByLabel(/^Email/).fill(mail);
  await page.getByLabel(/^Contraseña/).fill(PASS);
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await page.getByRole("button", { name: /Rotisería y comidas/ }).click();
  await page.waitForURL("**/editor");
  await expect(status(page)).toHaveText("Guardado en tu cuenta", { timeout: 15_000 });
}

export async function verifyEmail(page: Page, mail: string) {
  const token = await tokenFromMail(mail);
  await page.goto(`/verificar?token=${encodeURIComponent(token)}`);
  await expect(page.getByText("¡Listo! Tu email quedó confirmado.")).toBeVisible();
  await page.getByRole("link", { name: "Ir a mi página" }).click();
  await page.waitForURL("**/editor");
}

/** Deja el negocio listo: nombre, WhatsApp y un producto propio (sin los de ejemplo), con stock opcional. */
export async function fillBusiness(page: Page, name: string, opts: { stock?: number; product?: string; price?: string } = {}) {
  await page.getByLabel(/Nombre del negocio/).fill(name);
  await page.getByLabel(/WhatsApp principal/).fill("11 5555-0000");
  await page.getByRole("tab", { name: "Productos", exact: true }).click();
  await page.getByRole("button", { name: /Quitar los \d+ de ejemplo/ }).click();
  await page.getByRole("button", { name: "+ Agregar producto" }).click();
  await page.getByLabel(/^Nombre \*?$/).fill(opts.product ?? "Pan de campo");
  await page.getByLabel("Precio ($)").fill(opts.price ?? "2500");
  if (opts.stock !== undefined) await page.getByLabel("Stock", { exact: true }).fill(String(opts.stock));
  await expect(status(page)).toHaveText("Guardado en tu cuenta", { timeout: 15_000 });
}

/** Publica con el link dado. */
export async function publishAs(page: Page, slug: string) {
  await page.getByRole("tab", { name: "Publicar", exact: true }).click();
  await page.getByLabel("El link de tu página").fill(slug);
  await expect(page.getByText("✓ Está libre")).toBeVisible();
  await page.getByTestId("publish-button").click();
  await expect(page.getByTestId("published-box")).toContainText("¡Tu página está publicada!");
}

// ───────── Para los e2e del admin ─────────
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";

/** Código TOTP de 6 dígitos (RFC 6238) para un secreto en base32: lo que mostraría la app de autenticación. */
export function totpNow(secretB32: string, nowMs = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const ch of secretB32.toUpperCase()) {
    value = (value << 5) | alphabet.indexOf(ch); bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(nowMs / 30_000)));
  const h = createHmac("sha1", Buffer.from(bytes)).update(msg).digest();
  const o = h[h.length - 1]! & 15;
  const code = ((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(code % 1_000_000).padStart(6, "0");
}

/** Ejecuta SQL en la base del stack (así se nombra al primer admin: no se puede desde la web a propósito). */
export function sql(query: string): string {
  const root = path.resolve(__dirname, "../..");
  return execFileSync("docker", ["compose", "exec", "-T", "db", "psql", "-U", "mishowo", "-d", "mishowo", "-tAc", query], { cwd: root, encoding: "utf8" }).trim();
}
