import { test, expect, type Page } from "@playwright/test";

// Requiere el stack con los negocios demo: `SEED_DEMO=1 npm run db:seed` (backend).
const url = (slug: string) => `http://${slug}.localhost:3100/`;
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe("página pública del negocio", () => {
  for (const [slug, layout] of [["lupe-empanadas", "vidriera"], ["demo-ropa", "grilla"], ["demo-gimnasio", "servicios"], ["demo-muebles", "vidriera"], ["demo-belleza", "servicios"]] as const) {
    test(`${slug} (${layout}): se ve completa sin desbordes en celular, tablet y computadora`, async ({ page }) => {
      for (const width of [390, 820, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(url(slug));
        await expect(page.getByTestId("site-name")).toBeVisible();
        await expect(page.locator("[data-site-layout]")).toHaveAttribute("data-site-layout", layout);
        expect(await noOverflow(page), `${slug} @${width}`).toBe(true);
      }
    });
  }

  test("la portada muestra la comanda con precios y la cinta de productos (decorativa)", async ({ page }) => {
    await page.goto(url("demo-ropa"));
    const ticket = page.getByRole("complementary", { name: /Algunos de nuestros productos/ });
    await expect(ticket).toBeVisible();
    await expect(ticket).toContainText("Remera oversize de algodón");
    await expect(ticket).toContainText("$ 18.500");
    const ticker = page.locator(".site-marquee");
    await expect(ticker).toHaveAttribute("aria-hidden", "true"); // repite el catálogo: fuera del orden de lectura
  });

  test("los productos agotados no aparecen en la comanda ni en la cinta", async ({ page }) => {
    await page.goto(url("lupe-empanadas"));
    await expect(page.getByRole("complementary", { name: /Algunos de nuestros productos/ })).not.toContainText("humita");
    await expect(page.locator(".site-marquee").first()).not.toContainText("humita");
  });

  test("con la preferencia de movimiento reducido no hay animaciones", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(url("demo-ropa"));
    const names = await page.evaluate(() => ({
      h1: getComputedStyle(document.querySelector("h1")!).animationName,
      track: getComputedStyle(document.querySelector(".site-marquee-track")!).animationName,
    }));
    expect(names).toEqual({ h1: "none", track: "none" });
  });

  test("con movimiento normal la portada anima y la cinta corre", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(url("demo-ropa"));
    const names = await page.evaluate(() => ({
      h1: getComputedStyle(document.querySelector("h1")!).animationName,
      track: getComputedStyle(document.querySelector(".site-marquee-track")!).animationName,
    }));
    expect(names.h1).toBe("site-rise");
    expect(names.track).toBe("site-marquee");
  });

  test("la dirección no se repite cuando es igual a la zona de entrega", async ({ page }) => {
    await page.goto(url("demo-gimnasio"));
    await expect(page.getByTestId("site-name")).toBeVisible();
    const hero = page.locator("#top");
    await expect(hero.getByText("Av. Rivadavia 4500, Almagro")).toHaveCount(1);
  });

  test("la barra superior marca la sección activa y se condensa al scrollear", async ({ page }, info) => {
    test.skip(info.project.name === "mobile", "la barra de secciones en celular va debajo del nombre");
    await page.goto(url("lupe-empanadas"));
    const nav = page.getByRole("navigation", { name: "Secciones" });
    await expect(nav).not.toHaveClass(/backdrop-blur/);
    await page.locator("#sec-platos-del-dia").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 200));
    await expect(nav).toHaveClass(/backdrop-blur/);
    await expect(nav.getByRole("link", { name: "Platos del día" })).toHaveAttribute("aria-current", "true");
  });

  test("un negocio que no existe responde 404 de verdad (no una página vacía con status 200)", async ({ request }) => {
    for (const slug of ["no-existe-para-nada", "admin-falso-123"]) expect((await request.get(url(slug))).status(), slug).toBe(404);
    expect((await request.get(url("demo-ropa"))).status()).toBe(200);
  });

  test("el horario resalta el día de hoy", async ({ page }) => {
    await page.goto(url("demo-ropa"));
    await expect(page.getByText("Hoy", { exact: true })).toBeVisible();
  });

  test("hay un único h1 y los links de WhatsApp apuntan al número del negocio", async ({ page }) => {
    await page.goto(url("demo-belleza"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    for (const a of await page.locator("a[href^='https://wa.me/']").all()) await expect(a).toHaveAttribute("href", /^https:\/\/wa\.me\/5491155550000\?text=/);
  });

  test("en computadora el pedido se abre desde la barra superior y en celular desde la inferior", async ({ page }, info) => {
    await page.goto(url("lupe-empanadas"));
    await page.locator("li", { hasText: "Empanada de jamón y queso" }).getByRole("button", { name: /Agregar .* al pedido/ }).click();
    if (info.project.name === "mobile") {
      await expect(page.getByTestId("cart-bar")).toBeVisible();
      await expect(page.getByTestId("nav-cart")).toBeHidden();
    } else {
      await expect(page.getByTestId("nav-cart")).toBeVisible();
      await expect(page.getByTestId("cart-bar")).toBeHidden();
      await page.getByTestId("nav-cart").click();
      await expect(page.getByRole("dialog", { name: "Tu pedido" })).toBeVisible();
    }
  });
});
