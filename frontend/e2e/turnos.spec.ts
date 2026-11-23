import { test, expect } from "@playwright/test";
import { signUp, uniq } from "./helpers";

// Requiere los negocios demo: `SEED_DEMO=1 npm run db:seed` (demo-belleza trae servicios con duración y dos profesionales).
const url = (slug: string) => `http://${slug}.localhost:3100/`;

/** Un día hábil (lunes a sábado) entre 3 y 25 días adelante, al azar: así las corridas repetidas no chocan con turnos de corridas anteriores. */
function pickDay(seed: number): string {
  const d = new Date(Date.now() + (3 + (seed % 22)) * 86_400_000);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
const DAY = pickDay(Math.floor(Math.random() * 1000));

test.describe("turnos", () => {
  test("el cliente reserva eligiendo servicio y profesional, y el horario queda ocupado para esa persona", async ({ page }, info) => {
    await page.goto(url("demo-belleza"));
    const booking = page.getByTestId("booking");
    await booking.scrollIntoViewIfNeeded();
    const options = booking.getByTestId("service-option");
    await expect(options.first()).toBeVisible();
    await expect(options.first()).toContainText("min"); // cada servicio muestra su duración
    await options.first().click();
    await expect(options.first()).toHaveAttribute("aria-checked", "true");
    await booking.getByTestId("staff-select").selectOption({ label: "Sofi" });
    await booking.getByLabel("Día", { exact: true }).fill(DAY);
    await expect(booking.getByTestId("slot").first()).toBeVisible();
    const slot = booking.getByTestId("slot").nth(info.project.name === "mobile" ? 5 : 3);
    const time = (await slot.innerText()).trim();
    await slot.click();
    await booking.getByLabel(/^Tu nombre/).fill(`Cliente ${uniq("t", info.project.name)}`);
    await booking.getByLabel(/^Tu teléfono/).fill("11 5555-0000");
    await booking.getByLabel(/^Tu email/).fill(`${uniq("cli", info.project.name)}@test.com`);
    await booking.getByTestId("booking-submit").click();
    await expect(booking.getByTestId("booking-done")).toContainText(time);
    await expect(booking.getByTestId("booking-done")).toContainText("con Sofi");

    // Con Sofi ese horario ya no está; con Lu sí.
    await page.reload();
    const again = page.getByTestId("booking");
    await again.getByTestId("service-option").first().click();
    await again.getByTestId("staff-select").selectOption({ label: "Sofi" });
    await again.getByLabel("Día", { exact: true }).fill(DAY);
    await expect(again.getByTestId("slot").first()).toBeVisible();
    await expect(again.getByTestId("slot").filter({ hasText: time })).toBeDisabled();
    await again.getByTestId("staff-select").selectOption({ label: "Lu" });
    await expect(again.getByTestId("slot").filter({ hasText: time })).toBeEnabled();
  });

  test("el dueño carga servicios con duración y precio y profesionales, y quedan guardados", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signUp(page, `${uniq("turnos", info.project.name)}@test.com`);
    await page.goto("/panel/turnos");
    const cfg = page.getByTestId("appt-settings");
    await expect(cfg).toBeVisible();
    await cfg.getByRole("button", { name: "+ Agregar servicio" }).click();
    await cfg.getByLabel("Nombre del servicio 1").fill("Corte");
    await cfg.getByLabel("Minutos del servicio 1").fill("45");
    await cfg.getByLabel("Precio del servicio 1").fill("8000");
    await cfg.getByRole("button", { name: "+ Agregar profesional" }).click();
    await cfg.getByLabel("Nombre del profesional 1").fill("Lu");
    await cfg.getByRole("button", { name: "Guardar configuración" }).click();
    await expect(cfg.getByRole("status")).toContainText("Guardado");

    await page.reload();
    const after = page.getByTestId("appt-settings");
    await expect(after.getByLabel("Nombre del servicio 1")).toHaveValue("Corte");
    await expect(after.getByLabel("Minutos del servicio 1")).toHaveValue("45");
    await expect(after.getByLabel("Precio del servicio 1")).toHaveValue("8000");
    await expect(after.getByLabel("Nombre del profesional 1")).toHaveValue("Lu");

    // Dos servicios con el mismo nombre se rechazan con un mensaje claro
    await after.getByRole("button", { name: "+ Agregar servicio" }).click();
    await after.getByLabel("Nombre del servicio 2").fill("corte");
    await after.getByRole("button", { name: "Guardar configuración" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "mismo nombre" })).toBeVisible();
  });
});
