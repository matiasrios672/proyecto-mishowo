import { describe, expect, it } from "vitest";
import { authErrorMessage, safeNext } from "./authClient";

describe("safeNext (redirección tras ingresar)", () => {
  it("acepta rutas internas", () => {
    expect(safeNext("/editor")).toBe("/editor");
    expect(safeNext("/editor?tab=productos")).toBe("/editor?tab=productos");
  });
  it("rechaza todo lo que pueda sacar a la persona del sitio", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "evil.com", "javascript:alert(1)", "/ok\n//evil.com", "", null, undefined])
      expect(safeNext(bad as string | null)).toBe("/editor");
  });
  it("usa el fallback que se le pase", () => {
    expect(safeNext("//x", "/cuenta")).toBe("/cuenta");
  });
});

describe("authErrorMessage", () => {
  it("tiene mensaje claro para cada error conocido y uno genérico", () => {
    for (const c of ["email_taken", "password_too_short", "password_is_email", "invalid_credentials", "blocked", "invalid_token", "invalid_request", "bad_origin", "network", "otro", undefined])
      expect(authErrorMessage(c)).toMatch(/\S{3}/);
  });
  it("no filtra el código técnico al usuario", () => {
    expect(authErrorMessage("invalid_credentials")).not.toMatch(/invalid_/);
  });
});
