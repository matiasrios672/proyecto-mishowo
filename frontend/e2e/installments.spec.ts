import { test, expect } from "@playwright/test";
import { fillBusiness, publishAs, signUp, status, uniq, verifyEmail } from "./helpers";

test.describe("cuotas sin interés", () => {
  test("la landing tiene una demo accesible que recalcula el valor de la cuota", async ({ page }) => {
    await page.goto("/cuotas");
    const section = page.locator("#cuotas");
    await section.scrollIntoViewIfNeeded();
    const line = section.getByTestId("demo-installments");
    await expect(line).toHaveText("6 cuotas sin interés de $ 31.650");
    await section.getByLabel("12 cuotas").check({ force: true });
    await expect(line).toHaveText("12 cuotas sin interés de $ 15.825");
    await section.getByLabel("3 cuotas").focus();
    await page.keyboard.press("ArrowRight"); // grupo de radios: se maneja con flechas
    await expect(line).toHaveText("6 cuotas sin interés de $ 31.650");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cuotas sin interés");
  });

  test("el dueño las activa y su clienta las ve en el precio, en el carrito y en el mensaje de WhatsApp", async ({ page, context }, info) => {
    test.setTimeout(120_000);
    await context.route("https://wa.me/**", (r) => r.fulfill({ status: 200, body: "ok" }));
    const mail = `${uniq("cuo", info.project.name)}@test.com`;
    const slug = uniq("cuo", info.project.name).toLowerCase().slice(0, 30);
    await signUp(page, mail);
    await verifyEmail(page, mail);
    await fillBusiness(page, `Tienda ${slug.slice(-6)}`, { product: "Campera", price: "60000" });

    await page.getByRole("tab", { name: "Pedidos", exact: true }).click();
    await expect(page.getByTestId("installments-example")).toHaveCount(0); // apagadas: sin ejemplo
    await page.getByTestId("installments-switch").getByRole("switch").click();
    await page.getByLabel("Cantidad de cuotas").selectOption("6");
    await page.getByLabel("Compra mínima para cuotas").fill("20000");
    await expect(page.getByTestId("installments-example")).toContainText("6 cuotas sin interés de $ 10.000");
    await expect(status(page)).toHaveText("Guardado en tu cuenta", { timeout: 15_000 });
    await publishAs(page, slug);

    await page.goto(`http://${slug}.localhost:3000/`);
    await expect(page.getByTestId("installments-line").first()).toHaveText("6 cuotas sin interés de $ 10.000");
    await page.getByRole("button", { name: /Agregar Campera al pedido/ }).click();
    await page.locator("[data-testid=cart-bar]:visible, [data-testid=nav-cart]:visible").click();
    const dialog = page.getByRole("dialog", { name: "Tu pedido" });
    const option = dialog.getByTestId("installments-option");
    await expect(option).toContainText("Quiero pagar en 6 cuotas sin interés");
    await option.getByRole("checkbox").check();
    const [wa] = await Promise.all([context.waitForEvent("page"), dialog.getByTestId("send-order").click()]);
    expect(new URL(wa.url()).searchParams.get("text")).toContain("Quiero pagar en 6 cuotas sin interés de $ 10.000");
  });
});
