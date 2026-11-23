import { test, expect } from "@playwright/test";
import { signUp, sql, uniq } from "./helpers";

// Requiere el stack completo y Docker accesible (las reseñas se cargan por SQL: la reserva pública limita una por conexión por día).
test.describe("reseñas", () => {
  test("el dueño aprueba, responde y oculta reseñas desde su panel", async ({ page }, info) => {
    test.setTimeout(90_000);
    const mail = `${uniq("resenas", info.project.name)}@test.com`;
    await signUp(page, mail);
    sql(`insert into reviews (business_id, author_name, rating, comment, ip_hash) select b.id, 'Ana Gómez', 5, 'Excelentes empanadas, llegaron calentitas', 'e2e-a' from businesses b join users u on u.id = b.owner_id where u.email = '${mail}'`);
    sql(`insert into reviews (business_id, author_name, rating, comment, ip_hash) select b.id, 'Beto', 2, 'Tardó mucho', 'e2e-b' from businesses b join users u on u.id = b.owner_id where u.email = '${mail}'`);

    await page.goto("/panel/resenas");
    await expect(page.getByRole("button", { name: /Pendientes \(2\)/ })).toBeVisible();
    const ana = page.getByTestId("review-item").filter({ hasText: "Ana Gómez" });
    await expect(ana).toContainText("Excelentes empanadas");

    await ana.getByRole("button", { name: "Aprobar y mostrar" }).click();
    await expect(page.getByRole("button", { name: /Pendientes \(1\)/ })).toBeVisible();
    await page.getByRole("button", { name: /Aprobadas \(1\)/ }).click();
    const approved = page.getByTestId("review-item").filter({ hasText: "Ana Gómez" });
    await approved.getByRole("button", { name: "Responder" }).click();
    await approved.getByLabel(/Tu respuesta pública/).fill("¡Gracias, Ana! Te esperamos de nuevo.");
    await approved.getByRole("button", { name: "Guardar respuesta" }).click();
    await expect(approved).toContainText("Tu respuesta: ¡Gracias, Ana!");

    await approved.getByRole("button", { name: "Ocultar" }).click();
    await expect(page.getByTestId("reviews-empty")).toBeVisible();
    await page.getByRole("button", { name: /Rechazadas \(1\)/ }).click();
    await expect(page.getByTestId("review-item").filter({ hasText: "Ana Gómez" })).toBeVisible();

    await page.getByRole("button", { name: /Pendientes \(1\)/ }).click();
    await page.getByTestId("review-item").filter({ hasText: "Beto" }).getByRole("button", { name: "Rechazar" }).click();
    await expect(page.getByRole("button", { name: /Pendientes \(0\)/ })).toBeVisible();
  });

  test("en la página pública se ve el bloque para dejar una opinión y no se envía sin puntaje", async ({ page }) => {
    await page.goto("http://lupe-empanadas.localhost:3100/");
    const block = page.getByTestId("reviews");
    await block.scrollIntoViewIfNeeded();
    await expect(block).toContainText("Lo que dicen los clientes");
    await block.getByTestId("reviews-open").click();
    await block.getByLabel("Tu nombre").fill("Cliente de prueba");
    await expect(block.getByTestId("reviews-submit")).toBeDisabled(); // falta el puntaje
    await block.getByRole("radio", { name: "5 estrellas" }).click();
    await expect(block.getByTestId("reviews-submit")).toBeEnabled();
  });
});
