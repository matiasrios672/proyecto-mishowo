import { describe, expect, it } from "vitest";
import { AiUnavailableError, getAiProvider } from "./provider.js";

describe("provider de IA (stub)", () => {
  it("no está disponible y rechaza todas las operaciones sin llamar a nada externo", async () => {
    const ai = getAiProvider();
    expect(ai.available).toBe(false);
    await expect(ai.generateSite({ idea: "x" })).rejects.toBeInstanceOf(AiUnavailableError);
    await expect(ai.catalogFromPhotos([])).rejects.toBeInstanceOf(AiUnavailableError);
    await expect(ai.instagramPost({ businessName: "a", productName: "b" })).rejects.toBeInstanceOf(AiUnavailableError);
    await expect(ai.removeBackground("x.png")).rejects.toBeInstanceOf(AiUnavailableError);
  });
});
