import { test, expect } from "@playwright/test";

test("elegir un rubro crea el borrador y abre el editor con contenido de ejemplo", async ({ page }, info) => {
  await page.goto("/crear");
  // Primero la cuenta (para guardar el avance y poder escribirle a quien no termina); recién después el rubro.
  await expect(page.getByTestId("crear-account")).toBeVisible();
  await expect(page.getByTestId("crear-steps").getByRole("listitem")).toHaveCount(3);
  await page.getByLabel("Nombre", { exact: true }).fill("Lupe Gómez");
  await page.getByLabel("Apellido").fill("Prueba");
  await page.getByLabel(/^Teléfono/).fill("11 5555-0000");
  await page.getByLabel(/^Email/).fill(`onb-${info.project.name}-${Date.now()}@test.com`);
  await page.getByLabel(/^Contraseña/).fill("claveSegura123");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page.getByRole("heading", { name: "¿De qué es tu negocio?" })).toBeVisible();
  await expect(page.getByText("Próximamente")).toBeVisible();
  await page.screenshot({ path: `test-results/crear-${info.project.name}.png`, fullPage: true });

  await page.getByRole("button", { name: /Rotisería y comidas/ }).click();

  await page.getByTestId("orders-yes").click();
  await page.waitForURL("**/editor");
  await expect(page.getByTestId("header-name")).toContainText("Rotisería Doña Marta");
  await expect(page.getByTestId("preview-frame")).toContainText("Empanada de humita");
  await expect(page.getByTestId("preview-frame")).toContainText("Ejemplo");
  await page.screenshot({ path: `test-results/editor-${info.project.name}.png`, fullPage: true });

  await page.reload();
  await expect(page.getByTestId("header-name")).toContainText("Rotisería Doña Marta");
});

test("sin cuenta no se puede diseñar: el editor manda a crearla", async ({ page }) => {
  await page.goto("/editor");
  await page.waitForURL("**/crear");
  await expect(page.getByTestId("crear-account")).toBeVisible();
});

test("el nombre es obligatorio para crear la cuenta y un email repetido se explica", async ({ page }) => {
  await page.goto("/crear");
  await page.getByLabel(/^Email/).fill("sinnombre@test.com");
  await page.getByLabel(/^Contraseña/).fill("claveSegura123");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page.locator("p[role=alert]:visible")).toContainText("Contanos tu nombre");
});
