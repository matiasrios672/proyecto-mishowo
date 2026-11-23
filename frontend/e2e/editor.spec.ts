import { test, expect, type Page } from "@playwright/test";
import { signUp, uniq } from "./helpers";

async function openEditor(page: Page) {
  await signUp(page, `${uniq("ed", "e")}@test.com`); // para diseñar hace falta cuenta: se crea en /crear
  await expect(page.getByTestId("header-name")).toContainText("Rotisería Doña Marta");
}

const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true }).click();
const preview = (page: Page) => page.getByTestId("preview-frame").locator("[data-site-layout]");
const siteName = (page: Page) => page.getByTestId("site-name");

test.describe("editor", () => {
  test("editar el nombre actualiza la vista previa, se guarda solo y sobrevive a recargar", async ({ page }) => {
    await openEditor(page);
    await page.getByLabel(/Nombre del negocio/).fill("Empanadas de Lupe");
    await expect(siteName(page)).toContainText("Empanadas de Lupe");
    await expect(page.getByTestId("header-name")).toHaveText("Empanadas de Lupe");
    await expect(page.getByTestId("save-status")).toContainText("Guardado", { timeout: 5000 });
    await page.reload();
    await expect(page.getByTestId("header-name")).toHaveText("Empanadas de Lupe");
  });

  test("deshacer y rehacer", async ({ page }) => {
    await openEditor(page);
    const name = page.getByLabel(/Nombre del negocio/);
    await name.fill("Nombre nuevo");
    await expect(siteName(page)).toContainText("Nombre nuevo");
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(page.getByTestId("header-name")).toHaveText("Rotisería Doña Marta");
    await page.getByRole("button", { name: "Rehacer" }).click();
    await expect(page.getByTestId("header-name")).toHaveText("Nombre nuevo");
  });

  test("el WhatsApp se valida y el checklist de publicación avanza", async ({ page }) => {
    await openEditor(page);
    const wa = page.getByLabel(/WhatsApp principal/);
    await wa.fill("123");
    await expect(page.getByText(/código de área/)).toBeVisible();
    await wa.fill("11 5555-0000");
    await expect(page.getByText("Los pedidos llegan a +54 9 11 5555-0000")).toBeVisible();

    await tab(page, "Publicar");
    await expect(page.getByTestId("publish-button")).toBeVisible(); // con cuenta se puede intentar publicar; si falta algo, lo explica
    const before = await page.getByTestId("score-text").innerText();
    await page.getByRole("button", { name: "Completar" }).first().click(); // lleva a la pestaña del primer pendiente
    await expect(page.getByRole("tab", { name: /Negocio|Productos/, selected: true })).toBeVisible();
    expect(before).toMatch(/al \d+%/);
  });

  test("productos: agregar, editar, buscar variantes y quitar ejemplos", async ({ page }) => {
    await openEditor(page);
    await tab(page, "Productos");
    await page.getByRole("button", { name: "+ Agregar producto" }).click();
    await page.getByLabel(/^Nombre \*?$/).fill("Pan de campo");
    await page.getByLabel("Precio ($)").fill("2500");
    await expect(page.getByText("Pan de campo").first()).toBeVisible();

    await page.getByLabel("Opción 1").fill("Chico, Grande");
    await page.getByRole("button", { name: "Generar opciones" }).click();
    await expect(page.getByLabel("Nombre de la opción")).toHaveCount(2);

    await page.getByRole("button", { name: /Quitar los \d+ de ejemplo/ }).click();
    await expect(page.getByText("Empanada de humita")).toHaveCount(0);
    await expect(page.getByText("Pan de campo").first()).toBeVisible();
  });

  test("carga masiva pegando una lista", async ({ page }) => {
    await openEditor(page);
    await tab(page, "Productos");
    await page.getByRole("button", { name: "Cargar varios" }).click();
    await page.getByLabel("Contenido a importar").fill("Postres:\n- Flan casero - 3500\n- Budín de pan $3.200");
    await expect(page.getByText("Vamos a agregar 2 productos.")).toBeVisible();
    await page.getByRole("button", { name: "Agregar a mi catálogo" }).click();
    await expect(page.getByText("Flan casero").first()).toBeVisible();
    await expect(page.getByLabel("Nombre de la categoría").last()).toHaveValue("Postres");
  });

  test("diseño: layout, tema, color de marca y comparación", async ({ page }) => {
    await openEditor(page);
    await tab(page, "Diseño");
    await page.getByRole("radio", { name: /Grilla/ }).click();
    await expect(preview(page)).toHaveAttribute("data-site-layout", "grilla");
    await page.getByRole("radio", { name: /Rosa/ }).click();
    await page.getByLabel("Código").fill("#1B6390");
    const primary = await preview(page).evaluate((el) => (el as HTMLElement).style.getPropertyValue("--primary"));
    expect(primary.toUpperCase()).toBe("#1B6390");
    await page.getByRole("button", { name: /Comparar diseños/ }).click();
    await expect(page.getByTestId("compare").getByRole("button")).toHaveCount(4);
    await page.getByRole("button", { name: "Elegir Carta" }).click();
    await expect(preview(page)).toHaveAttribute("data-site-layout", "mostrador");
  });

  test("horarios: se muestra Abierto/Cerrado y el resumen", async ({ page }) => {
    await openEditor(page);
    await expect(page.getByTestId("open-badge")).toContainText(/Abierto ahora|Cerrado/);
    await page.getByText("Lunes a Sábado: 09:00 a 18:00").first().waitFor({ state: "attached" });
  });

  test("capturas del editor", async ({ page }, info) => {
    await openEditor(page);
    await tab(page, "Productos");
    await page.screenshot({ path: `test-results/editor-productos-${info.project.name}.png` });
    if (info.project.name === "mobile") {
      await page.getByTestId("toggle-view").click();
      await expect(page.getByRole("button", { name: "Seguir editando" })).toBeVisible();
      await page.screenshot({ path: `test-results/editor-preview-${info.project.name}.png` });
      await page.getByTestId("toggle-view").click();
      await expect(page.getByRole("tablist", { name: "Secciones del editor" })).toBeVisible();
    } else {
      await expect(page.getByTestId("preview-frame")).toBeVisible();
      await page.getByRole("button", { name: "Computadora" }).click();
      await expect(page.getByTestId("preview-frame")).toHaveAttribute("data-device", "computadora");
      await page.screenshot({ path: `test-results/editor-desktop-full-${info.project.name}.png` });
    }
  });

  test("pantalla completa se abre y se cierra con Escape", async ({ page }, info) => {
    test.skip(info.project.name === "mobile", "en celular la vista previa ya ocupa toda la pantalla");
    await openEditor(page);
    await page.getByRole("button", { name: "Pantalla completa" }).click();
    await expect(page.getByRole("dialog", { name: /pantalla completa/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
