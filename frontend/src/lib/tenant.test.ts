import { describe, expect, it } from "vitest";
import { tenantFromHost } from "./tenant";

const R = "mishowo.com";

describe("tenantFromHost", () => {
  it("reconoce dominio raíz y www", () => {
    expect(tenantFromHost("mishowo.com", R)).toEqual({ kind: "root" });
    expect(tenantFromHost("www.mishowo.com", R)).toEqual({ kind: "root" });
  });
  it("reconoce admin", () => {
    expect(tenantFromHost("admin.mishowo.com", R)).toEqual({ kind: "admin" });
  });
  it("extrae el slug del negocio, ignorando puerto y mayúsculas", () => {
    expect(tenantFromHost("Lupe-Empanadas.mishowo.com", R)).toEqual({ kind: "tenant", slug: "lupe-empanadas" });
    expect(tenantFromHost("demo.localhost:3000", "localhost")).toEqual({ kind: "tenant", slug: "demo" });
  });
  it("no trata api ni subniveles como negocios", () => {
    expect(tenantFromHost("api.mishowo.com", R)).toEqual({ kind: "other" });
    expect(tenantFromHost("a.b.mishowo.com", R)).toEqual({ kind: "other" });
  });
  it("no confunde dominios parecidos ni inválidos", () => {
    expect(tenantFromHost("evilmishowo.com", R)).toEqual({ kind: "other" });
    expect(tenantFromHost("x.mishowo.com.evil.com", R)).toEqual({ kind: "other" });
    expect(tenantFromHost("-bad-.mishowo.com", R)).toEqual({ kind: "other" });
    expect(tenantFromHost(null, R)).toEqual({ kind: "other" });
  });
});
