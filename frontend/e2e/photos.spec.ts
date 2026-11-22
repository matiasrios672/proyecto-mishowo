import { test, expect } from "@playwright/test";
import { fillBusiness, publishAs, signUp, uniq, verifyEmail } from "./helpers";

// PNG válido de 8x8 píxeles (el backend lo valida de verdad con sharp).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWM4YKmNFTEMLQkAq6xJAVajaZIAAAAASUVORK5CYII=", "base64");
const TXT = Buffer.from("esto no es una foto, es texto plano".repeat(5));

test("subo una foto de producto y de portada: se ven en la página pública y se pueden borrar", async ({ page }, info) => {
  test.setTimeout(120_000);
  const mail = `${uniq("fotos", info.project.name)}@test.com`;
  await signUp(page, mail);
  const slug = uniq("fo", info.project.name).toLowerCase().slice(0, 30);
  await fillBusiness(page, `Fotería ${slug.slice(-5)}`, { product: "Torta de ricota" });

  await page.getByRole("tab", { name: "Fotos", exact: true }).click();
  const product = page.getByTestId("gallery").filter({ hasText: "Torta de ricota" });
  const cover = page.getByTestId("gallery").filter({ has: page.getByText("Portada", { exact: true }) });

  // Un archivo que no es imagen se rechaza con un mensaje claro
  await product.locator('input[type="file"]').setInputFiles({ name: "falsa.png", mimeType: "image/png", buffer: TXT });
  await expect(product.getByRole("alert")).toContainText("Ese archivo no sirve");

  await product.locator('input[type="file"]').setInputFiles({ name: "torta.png", mimeType: "image/png", buffer: PNG });
  await expect(product.locator("img")).toHaveCount(1);
  await cover.locator('input[type="file"]').setInputFiles({ name: "portada.png", mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.from([0])]) });
  await expect(cover.locator("img")).toHaveCount(1);
  const src = await product.locator("img").getAttribute("src");
  expect(src).toMatch(/\/uploads\/media\/[0-9a-f-]{36}\/[0-9a-f]{16}-800\.webp$/);

  await verifyEmail(page, mail);
  await publishAs(page, slug);
  await page.goto(`http://${slug}.localhost:3000/`);
  const shot = page.locator(`img[src="${src}"]`).first();
  await expect(shot).toBeVisible();
  await expect.poll(() => shot.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  expect(await shot.getAttribute("srcset")).toContain("400w");
  await expect(page.getByAltText(/^Portada de /)).toBeVisible();

  // Borrar la foto la saca de la página
  await page.goto("/editor");
  await page.getByRole("tab", { name: "Fotos", exact: true }).click();
  const p2 = page.getByTestId("gallery").filter({ hasText: "Torta de ricota" });
  await p2.getByRole("button", { name: "Borrar este archivo" }).click();
  await expect(p2.locator("img")).toHaveCount(0);
  await expect.poll(async () => (await page.request.get(src!)).status()).toBe(404);
});

test("sin cuenta, la pestaña Fotos explica que hace falta una", async ({ page }) => {
  await page.goto("/crear");
  await page.getByRole("button", { name: /Rotisería y comidas/ }).click();
  await page.waitForURL("**/editor");
  await page.getByRole("tab", { name: "Fotos", exact: true }).click();
  await expect(page.getByText("Para subir fotos necesitás una cuenta.")).toBeVisible();
});

test("la vista previa del editor muestra el logo y la foto de cada producto apenas se suben", async ({ page }, info) => {
  test.setTimeout(120_000);
  await signUp(page, `${uniq("prev", info.project.name)}@test.com`);
  await fillBusiness(page, "Vista Previa SA", { product: "Budín de limón" });
  await page.goto("/panel/pagina?tab=fotos");
  const preview = page.getByTestId("preview-frame");
  if (info.project.name === "mobile") await expect(page.getByTestId("toggle-view")).toBeVisible();
  const logo = page.getByTestId("gallery").filter({ has: page.getByText("Logo de tu negocio") });
  await logo.locator('input[type="file"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await expect(logo.locator("img")).toHaveCount(1);
  if (info.project.name === "mobile") await page.getByTestId("toggle-view").click();
  await expect(preview.locator('img[src*="/uploads/media/"]').first()).toBeVisible();

  // Foto de producto: se carga desde el módulo Catálogo y también se ve en la vista previa
  if (info.project.name === "mobile") await page.getByTestId("toggle-view").click();
  await page.goto("/panel/catalogo?tab=fotos");
  const prod = page.getByTestId("gallery").filter({ has: page.getByText("Budín de limón", { exact: true }) });
  await prod.locator('input[type="file"]').setInputFiles({ name: "budin.png", mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.from([0])]) });
  await expect(prod.locator("img")).toHaveCount(1);
  if (info.project.name === "mobile") await page.getByTestId("toggle-view").click();
  await expect(preview.locator('img[alt="Budín de limón"]')).toBeVisible();
});
