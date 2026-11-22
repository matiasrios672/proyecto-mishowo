import { test, expect } from "@playwright/test";

test("home muestra el mensaje principal", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Tu página que vende");
  await page.screenshot({ path: `test-results/home-${info.project.name}.png`, fullPage: true });
});

test("design system muestra los 9 temas sin scroll horizontal", async ({ page }, info) => {
  await page.goto("/design-system");
  await expect(page.locator("#temas ~ ul > li")).toHaveCount(9);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: `test-results/design-${info.project.name}.png`, fullPage: true });
});
