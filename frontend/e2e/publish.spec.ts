import { test, expect, type Page } from "@playwright/test";

// Requiere el stack completo (`docker compose up -d --build`): backend, frontend (:3000), Postgres y Mailpit.
// La página pública se mira en el frontend del stack (:3000): es el que recibe el aviso de actualización del backend.
const MAILPIT = "http://localhost:8025/api/v1";
const PASS = "claveSegura123";
const status = (page: Page) => page.getByTestId("save-status");
const uniq = (tag: string, project: string) => `${tag}-${project}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

async function tokenFromMail(to: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const list = await (await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:${to}`)}`)).json();
    if (list.messages?.length) {
      const msg = await (await fetch(`${MAILPIT}/message/${list.messages[0].ID}`)).json();
      const m = (msg.Text as string).match(/token=([^\s&]+)/);
      if (m) return decodeURIComponent(m[1]!);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No llegó el mail a ${to}`);
}

async function signUp(page: Page, mail: string) {
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

async function verifyEmail(page: Page, mail: string) {
  const token = await tokenFromMail(mail);
  await page.goto(`/verificar?token=${encodeURIComponent(token)}`);
  await expect(page.getByText("¡Listo! Tu email quedó confirmado.")).toBeVisible();
  await page.getByRole("link", { name: "Ir a mi página" }).click();
  await page.waitForURL("**/editor");
}

/** Deja el negocio listo para publicar: nombre, WhatsApp y un producto propio (sin los de ejemplo). */
async function fillBusiness(page: Page, name: string) {
  await page.getByLabel(/Nombre del negocio/).fill(name);
  await page.getByLabel(/WhatsApp principal/).fill("11 5555-0000");
  await page.getByRole("tab", { name: "Productos", exact: true }).click();
  await page.getByRole("button", { name: /Quitar los \d+ de ejemplo/ }).click();
  await page.getByRole("button", { name: "+ Agregar producto" }).click();
  await page.getByLabel(/^Nombre \*?$/).fill("Pan de campo");
  await page.getByLabel("Precio ($)").fill("2500");
  await expect(status(page)).toHaveText("Guardado en tu cuenta", { timeout: 15_000 });
}

test.describe("publicar la página", () => {
  test("recorrido completo: publicar, ver la página en vivo, editar y verla actualizada, despublicar", async ({ page, request }, info) => {
    test.setTimeout(90_000);
    const mail = `${uniq("pub", info.project.name)}@test.com`;
    const slug = uniq("e2e", info.project.name).toLowerCase();
    const name = `Panadería ${slug.slice(-6)}`;
    await signUp(page, mail);
    await verifyEmail(page, mail);
    await fillBusiness(page, name);

    await page.getByRole("tab", { name: "Publicar", exact: true }).click();
    await page.getByLabel("El link de tu página").fill(slug.slice(0, 30));
    await expect(page.getByText("✓ Está libre")).toBeVisible();
    await page.getByTestId("publish-button").click();
    const box = page.getByTestId("published-box");
    await expect(box).toContainText("¡Tu página está publicada!");
    await expect(page.getByTestId("published-link")).toContainText(`${slug.slice(0, 30)}.localhost`);

    // La página pública, en el frontend del stack: nombre, producto propio y nada de ejemplos.
    const publicUrl = `http://${slug.slice(0, 30)}.localhost:3000/`;
    await page.goto(publicUrl);
    await expect(page.getByTestId("site-name")).toHaveText(name);
    await expect(page.getByText("Pan de campo").first()).toBeVisible();
    await expect(page.getByText("Empanada de humita")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    // Editar en el editor: el cambio llega a la página publicada enseguida, sin esperar que venza el caché.
    await page.goto("/editor");
    await expect(page.getByTestId("header-name")).toHaveText(name);
    await page.getByLabel(/Nombre del negocio/).fill(`${name} (nuevo)`);
    await expect(status(page)).toHaveText("Guardado en tu cuenta", { timeout: 15_000 });
    await page.goto(publicUrl);
    await expect(page.getByTestId("site-name")).toHaveText(`${name} (nuevo)`);

    // Despublicar: la página deja de existir.
    await page.goto("/editor");
    await page.getByRole("tab", { name: "Publicar", exact: true }).click();
    await page.getByRole("button", { name: "Despublicar" }).click();
    await expect(page.getByTestId("publish-button")).toBeVisible();
    await expect.poll(async () => (await request.get(publicUrl)).status(), { timeout: 10_000 }).toBe(404);
  });

  test("explica por qué un link no sirve: reservado, ocupado y con formato inválido", async ({ page }, info) => {
    test.setTimeout(60_000);
    const mail = `${uniq("slug", info.project.name)}@test.com`;
    await signUp(page, mail);
    await verifyEmail(page, mail);
    await page.getByRole("tab", { name: "Publicar", exact: true }).click();
    const field = page.getByLabel("El link de tu página");
    for (const [value, message] of [["admin", "reservado"], ["lupe-empanadas", "Ya está en uso"], ["x", "letras, números o guiones"]] as const) {
      await field.fill(value);
      await expect(page.getByText(new RegExp(message))).toBeVisible();
      await expect(page.getByTestId("publish-button")).toBeDisabled();
    }
  });

  test("sin el email confirmado no deja publicar y lo explica", async ({ page }, info) => {
    test.setTimeout(60_000);
    const mail = `${uniq("noverif", info.project.name)}@test.com`;
    await signUp(page, mail);
    await fillBusiness(page, "Negocio sin confirmar");
    await page.getByRole("tab", { name: "Publicar", exact: true }).click();
    await page.getByLabel("El link de tu página").fill(uniq("nv", info.project.name).toLowerCase().slice(0, 30));
    await expect(page.getByText("✓ Está libre")).toBeVisible();
    await page.getByTestId("publish-button").click();
    await expect(page.locator("p[role=alert]:visible")).toContainText("Confirmá tu email para publicar");
  });

  test("sin lo mínimo cargado, explica qué falta", async ({ page }, info) => {
    test.setTimeout(60_000);
    const mail = `${uniq("falta", info.project.name)}@test.com`;
    await signUp(page, mail);
    await verifyEmail(page, mail);
    await page.getByRole("tab", { name: "Publicar", exact: true }).click();
    await page.getByLabel("El link de tu página").fill(uniq("fl", info.project.name).toLowerCase().slice(0, 30));
    await expect(page.getByText("✓ Está libre")).toBeVisible();
    await page.getByTestId("publish-button").click();
    await expect(page.locator("p[role=alert]:visible")).toContainText("Todavía falta");
    await expect(page.locator("p[role=alert]:visible")).toContainText("tu WhatsApp");
  });

  test("sin cuenta, publicar invita a crearla", async ({ page }) => {
    await page.goto("/crear");
    await page.getByRole("button", { name: /Rotisería y comidas/ }).click();
    await page.waitForURL("**/editor");
    await page.getByRole("tab", { name: "Publicar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Publicar mi página" })).toBeDisabled();
    await expect(page.getByRole("link", { name: "Crear mi cuenta" })).toHaveAttribute("href", "/registro?next=/editor");
  });
});
