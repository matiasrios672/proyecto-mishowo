import { test, expect, type Page } from "@playwright/test";

// Requiere el backend y el negocio demo: `docker compose up -d` + `SEED_DEMO=1 npm run db:seed` en backend.
const SITE = "http://lupe-empanadas.localhost:3100/";
const jamon = (page: Page) => page.locator("li", { hasText: "Empanada de jamón y queso" });
const carne = (page: Page) => page.locator("li", { hasText: "Empanada de carne cortada" });

async function fillCart(page: Page) {
  await page.goto(SITE);
  await expect(page.getByTestId("site-name")).toContainText("Empanadas de Lupe");
  await jamon(page).getByRole("button", { name: /Agregar .* al pedido/ }).click();
  await jamon(page).getByRole("button", { name: /Agregar una unidad más/ }).click();
  await expect(jamon(page).getByTestId("qty")).toHaveText("2");
  await carne(page).getByLabel(/Opción de/).selectOption({ index: 2 }); // Docena
  await carne(page).getByRole("button", { name: /Agregar .* al pedido/ }).click();
}

test.beforeEach(async ({ context }) => {
  await context.route("https://wa.me/**", (r) => r.fulfill({ status: 200, body: "ok" }));
});

test.describe("pedido en la página pública", () => {
  test("armar el pedido, enviarlo y abrir WhatsApp con el mensaje correcto", async ({ page, context }, info) => {
    await fillCart(page);
    await expect(page.getByText("Agotado")).toBeVisible(); // la humita no se puede pedir
    await expect(page.getByRole("button", { name: /Agregar Empanada de humita/ })).toHaveCount(0);

    const bar = page.getByTestId("cart-bar");
    await expect(bar).toContainText("3 productos");
    await bar.click();
    const dialog = page.getByRole("dialog", { name: "Tu pedido" });
    await expect(dialog.getByTestId("cart-total")).toContainText("22.600"); // 2 x 1.700 + 19.200
    await page.screenshot({ path: `test-results/pedido-${info.project.name}.png` });

    await dialog.getByLabel(/Tu nombre/).fill("Ana");
    await dialog.getByLabel(/Aclaraciones/).fill("Sin cebolla");
    const [wa] = await Promise.all([context.waitForEvent("page"), dialog.getByTestId("send-order").click()]);

    const url = new URL(wa.url());
    expect(url.origin + url.pathname).toBe("https://wa.me/5491155550000");
    const text = url.searchParams.get("text")!;
    expect(text).toContain("Hola! Quiero hacer este pedido:");
    expect(text).toMatch(/\*Pedido #\d+\*/);
    expect(text).toContain("2 x Empanada de jamón y queso");
    expect(text).toContain("1 x Empanada de carne cortada a cuchillo (Docena)");
    expect(text).toContain("22.600");
    expect(text).toContain("Nombre: Ana");
    expect(text).toContain("Notas: Sin cebolla");

    await expect(page.getByTestId("order-done")).toContainText("¡Pedido #");
    await page.getByRole("button", { name: "Seguir mirando" }).click();
    await expect(page.getByTestId("cart-bar")).toHaveCount(0); // el carrito se vació
  });

  test("el carrito persiste al recargar y se puede editar desde el panel", async ({ page }) => {
    await fillCart(page);
    await page.reload();
    await expect(page.getByTestId("cart-bar")).toContainText("3 productos");
    await page.getByTestId("cart-bar").click();
    const dialog = page.getByRole("dialog", { name: "Tu pedido" });
    await dialog.getByRole("button", { name: /Quitar una unidad de Empanada de jamón/ }).click();
    await expect(dialog.getByTestId("cart-total")).toContainText("20.900");
    await dialog.getByRole("button", { name: /Sacar Empanada de carne/ }).click();
    await expect(dialog.getByTestId("cart-total")).toContainText("1.700");
    await dialog.getByRole("button", { name: /Sacar Empanada de jamón/ }).click();
    await expect(dialog.getByText("Tu pedido está vacío.")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("sin conexión con el servidor ofrece mandarlo igual por WhatsApp y no pierde el carrito", async ({ page }) => {
    await fillCart(page);
    await page.route("**/public/orders", (r) => r.abort());
    await page.getByTestId("cart-bar").click();
    const dialog = page.getByRole("dialog", { name: "Tu pedido" });
    await dialog.getByTestId("send-order").click();
    await expect(dialog.getByRole("alert")).toContainText("No pudimos conectarnos");
    await expect(dialog.getByRole("link", { name: /Enviar igual por WhatsApp/ })).toHaveAttribute("href", /^https:\/\/wa\.me\/5491155550000\?text=/);
    await expect(dialog.getByTestId("cart-total")).toBeVisible(); // el pedido sigue ahí
  });

  test("un error del servidor se explica en castellano", async ({ page }) => {
    await fillCart(page);
    await page.route("**/public/orders", (r) => r.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "out_of_stock" }) }));
    await page.getByTestId("cart-bar").click();
    const dialog = page.getByRole("dialog", { name: "Tu pedido" });
    await dialog.getByTestId("send-order").click();
    await expect(dialog.getByRole("alert")).toContainText("se quedó sin stock");
  });
});

test.describe('buscador y denuncias', () => {
  test('el buscador filtra sin tildes, oculta secciones vacías y avisa si no hay resultados', async ({ page }) => {
    await page.goto(SITE);
    const search = page.getByRole('searchbox', { name: 'Buscar en el catálogo' });
    const items = page.locator('#catalog li[data-search]:visible');
    const total = await items.count();
    expect(total).toBeGreaterThan(8);

    await search.fill('MILANESA');
    await expect(items).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Empanadas', exact: true })).toBeHidden(); // sección sin resultados

    await search.fill('jamon'); // sin tilde encuentra 'jamón'
    await expect(items).toHaveCount(1);

    await search.fill('zzzz');
    await expect(items).toHaveCount(0);
    await expect(page.getByText('No encontramos productos con esa búsqueda.')).toBeVisible();

    await search.fill('');
    await expect(items).toHaveCount(total);
  });

  test('denunciar la página registra el reporte', async ({ page }) => {
    await page.goto(SITE);
    await page.getByRole('button', { name: 'Denunciar esta página' }).click();
    const dialog = page.getByRole('dialog', { name: 'Denunciar esta página' });
    await dialog.getByLabel('Motivo').selectOption('estafa');
    await dialog.getByLabel(/Contanos más/).fill('Prueba automática');
    await dialog.getByRole('button', { name: 'Enviar denuncia' }).click();
    await expect(dialog.getByText('Gracias por avisarnos')).toBeVisible();
  });
});
