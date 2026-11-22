import { test, expect, type Page } from "@playwright/test";
import { fillBusiness, mailSubjects, publishAs, signUp, status, uniq, verifyEmail } from "./helpers";

// Requiere el stack completo (`docker compose up -d --build`). La página pública se mira en el frontend del stack (:3000).
const API = "http://localhost:4000";

/** Un cliente hace un pedido en la página pública del negocio. */
async function customerOrders(page: Page, slug: string, qty: number) {
  await page.context().route("https://wa.me/**", (r) => r.fulfill({ status: 200, body: "ok" }));
  await page.goto(`http://${slug}.localhost:3000/`);
  const card = page.locator("li", { hasText: "Pan de campo" });
  await card.getByRole("button", { name: /Agregar .* al pedido/ }).click();
  for (let i = 1; i < qty; i++) await card.getByRole("button", { name: /Agregar una unidad más/ }).click();
  const entry = page.locator("[data-testid=cart-bar]:visible, [data-testid=nav-cart]:visible");
  await entry.click();
  const dialog = page.getByRole("dialog", { name: "Tu pedido" });
  await dialog.getByLabel(/Tu nombre/).fill("Cliente E2E");
  await dialog.getByLabel(/Aclaraciones/).fill("Sin sal; tocar timbre");
  await dialog.getByTestId("send-order").click();
  await expect(page.getByTestId("order-done")).toContainText("¡Pedido #1 enviado!");
}

const productStock = (page: Page) =>
  page.evaluate(async (api) => {
    const r = await (await fetch(`${api}/me/business`, { credentials: "include" })).json();
    return r.content.categories.flatMap((c: { products: { name: string; stock: number | null }[] }) => c.products).find((p: { name: string }) => p.name === "Pan de campo").stock as number | null;
  }, API);

test.describe("panel de pedidos", () => {
  test("recorrido completo: el cliente pide, el dueño recibe el aviso y gestiona el pedido hasta cancelarlo y reponer el stock", async ({ page }, info) => {
    test.setTimeout(120_000);
    const mail = `${uniq("panel", info.project.name)}@test.com`;
    const slug = uniq("pn", info.project.name).toLowerCase().slice(0, 30);
    await signUp(page, mail);
    await verifyEmail(page, mail);
    await fillBusiness(page, "Panadería del panel", { stock: 5 });
    await publishAs(page, slug);

    await customerOrders(page, slug, 2); // descuenta 2 del stock
    expect(await (async () => { await page.goto("/editor"); return productStock(page); })()).toBe(3);

    // El dueño recibe el email del pedido.
    await expect.poll(async () => (await mailSubjects(mail)).some((s) => s.startsWith("Nuevo pedido #1")), { timeout: 15_000 }).toBe(true);

    await page.goto("/panel/pedidos");
    const order = page.getByTestId("order").first();
    await expect(order).toContainText("Pedido #1");
    await expect(order).toContainText("2 x Pan de campo");
    await expect(order).toContainText("$ 5.000");
    await expect(order).toContainText("Cliente E2E");
    await expect(order).toContainText("Sin sal; tocar timbre");
    await expect(order).toHaveAttribute("data-status", "nuevo");
    await expect(page.getByRole("tab", { name: /Nuevos/ })).toContainText("1");

    // Confirmar -> aparece en el filtro correcto y sale de "Nuevos".
    await order.getByRole("button", { name: "Confirmar pedido" }).click();
    await expect(order).toHaveAttribute("data-status", "confirmado");
    await page.getByRole("tab", { name: /Nuevos/ }).click();
    await expect(page.getByTestId("orders-empty")).toBeVisible();
    await page.getByRole("tab", { name: /Confirmados/ }).click();
    await expect(page.getByTestId("order")).toHaveCount(1);

    // Cancelar pide confirmación y repone el stock.
    await page.getByRole("tab", { name: "Todos" }).click();
    const again = page.getByTestId("order").first();
    await again.getByRole("button", { name: "Cancelar pedido" }).click();
    await expect(again.getByText("¿Cancelar este pedido? Se repone el stock.")).toBeVisible();
    await again.getByRole("button", { name: "Sí, cancelar" }).click();
    await expect(again).toHaveAttribute("data-status", "cancelado");
    await expect(again.getByRole("button")).toHaveCount(0); // un pedido cancelado ya no tiene acciones
    expect(await productStock(page)).toBe(5);
  });

  test("el CSV trae los pedidos propios con BOM y sin riesgo de fórmulas", async ({ page }, info) => {
    test.setTimeout(120_000);
    const mail = `${uniq("csv", info.project.name)}@test.com`;
    const slug = uniq("cs", info.project.name).toLowerCase().slice(0, 30);
    await signUp(page, mail);
    await verifyEmail(page, mail);
    await fillBusiness(page, "Negocio CSV");
    await publishAs(page, slug);
    await customerOrders(page, slug, 1);

    await page.goto("/panel/pedidos");
    await expect(page.getByTestId("order")).toHaveCount(1);
    // El navegador descarta el BOM al decodificar el texto: se comprueba en los bytes.
    const { bom, csv } = await page.evaluate(async (api) => {
      const buf = await (await fetch(`${api}/me/orders.csv`, { credentials: "include" })).arrayBuffer();
      return { bom: Array.from(new Uint8Array(buf).slice(0, 3)), csv: new TextDecoder().decode(buf) };
    }, API);
    expect(bom).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv).toContain("Pedido;Fecha;Estado;Cliente;");
    expect(csv).toContain("Cliente E2E");
    expect(csv).toContain("1 x Pan de campo");
    await expect(page.getByRole("link", { name: "Descargar CSV" })).toHaveAttribute("href", `${API}/me/orders.csv`);
  });

  test("sin pedidos muestra cómo conseguir el primero", async ({ page }, info) => {
    test.setTimeout(90_000);
    const mail = `${uniq("vacio", info.project.name)}@test.com`;
    await signUp(page, mail);
    await verifyEmail(page, mail);
    await page.goto("/panel/pedidos");
    await expect(page.getByTestId("orders-empty")).toContainText("Todavía no te llegaron pedidos");
  });

  test("sin sesión manda a ingresar y vuelve al panel después", async ({ page }) => {
    await page.goto("/panel/pedidos");
    await page.waitForURL(/\/ingresar\?next=%2Fpanel%2Fpedidos/);
  });

  test("en celular el panel no se desborda", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "solo se mide en celular");
    test.setTimeout(90_000);
    const mail = `${uniq("mob", info.project.name)}@test.com`;
    await signUp(page, mail);
    await page.goto("/panel/pedidos");
    await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
