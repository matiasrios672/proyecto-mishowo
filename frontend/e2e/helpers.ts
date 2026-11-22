import { expect, type Page } from "@playwright/test";

// Utilidades compartidas por los e2e que necesitan una cuenta real (backend + Mailpit del stack).
export const MAILPIT = "http://localhost:8025/api/v1";
export const PASS = "claveSegura123";
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

export async function signUp(page: Page, mail: string) {
  await page.goto("/crear");
  await page.getByRole("button", { name: /Rotisería y comidas/ }).click();
  await page.waitForURL("**/editor");
  await page.getByRole("link", { name: "Guardar mi página" }).click();
  await page.getByLabel(/^Email/).fill(mail);
  await page.getByLabel(/^Contraseña/).fill(PASS);
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
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
