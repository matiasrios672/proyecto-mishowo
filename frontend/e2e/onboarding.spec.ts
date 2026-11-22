import { test, expect } from "@playwright/test";

test("elegir un rubro crea el borrador y abre el editor con contenido de ejemplo", async ({ page }, info) => {
  await page.goto("/crear");
  await expect(page.getByRole("heading", { name: "¿De qué es tu negocio?" })).toBeVisible();
  await expect(page.getByText("Próximamente")).toBeVisible();
  await page.screenshot({ path: `test-results/crear-${info.project.name}.png`, fullPage: true });

  await page.getByRole("button", { name: /Rotisería y comidas/ }).click();
  await page.waitForURL("**/editor");
  await expect(page.getByTestId("header-name")).toContainText("Rotisería Doña Marta");
  await expect(page.getByTestId("preview-frame")).toContainText("Empanada de humita");
  await expect(page.getByTestId("preview-frame")).toContainText("Ejemplo");
  await page.screenshot({ path: `test-results/editor-${info.project.name}.png`, fullPage: true });

  await page.reload();
  await expect(page.getByTestId("header-name")).toContainText("Rotisería Doña Marta");
});

test("sin borrador el editor invita a elegir rubro", async ({ page }) => {
  await page.goto("/editor");
  await expect(page.getByRole("heading", { name: /Todavía no elegiste un rubro/ })).toBeVisible();
});
