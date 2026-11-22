import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig({ NODE_ENV: "test" });

describe("GET /api/health", () => {
  it("responde 200 con la DB arriba", async () => {
    const app = buildApp(config, async () => true);
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", db: true });
  });

  it("responde 503 sin DB", async () => {
    const app = buildApp(config, async () => {
      throw new Error("down");
    });
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(503);
  });
});
