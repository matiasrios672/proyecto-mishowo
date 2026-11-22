import { describe, expect, it } from "vitest";
import { createDraftFromTemplate, loadDraft, saveDraft, clearDraft, countExamples, DRAFT_KEY, type TemplateInput } from "./draft";

const tpl: TemplateInput = {
  id: "rotiseria", businessName: "Rotisería Doña Marta", tagline: "Casera", description: "Empanadas", deliveryZone: "Villa Crespo",
  eventDate: false, layout: "mostrador", theme: "terracota", fontPair: "calida",
  categories: [{ name: "Empanadas", products: [
    { name: "De carne", description: "x", price: 1800, options: [{ label: "Docena", price: 19200 }, { label: "Unidad" }] },
    { name: "De humita", description: "y", price: 1700 },
  ] }],
};

function memoryStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

describe("borrador", () => {
  it("se crea desde la plantilla marcando todo como ejemplo", () => {
    const d = createDraftFromTemplate(tpl);
    expect(d.nameIsExample && d.textsAreExample).toBe(true);
    expect(d.design).toMatchObject({ layout: "mostrador", theme: "terracota", fontPair: "calida", brandColor: null });
    expect(countExamples(d)).toBe(2);
    expect(d.categories[0]!.products[0]!.options.map((o) => o.price)).toEqual([19200, null]);
  });

  it("genera ids únicos", () => {
    const d = createDraftFromTemplate(tpl);
    const ids = d.categories.flatMap((c) => [c.id, ...c.products.flatMap((p) => [p.id, ...p.options.map((o) => o.id)])]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("guarda y recupera", () => {
    const s = memoryStore();
    const d = createDraftFromTemplate(tpl);
    expect(saveDraft(d, s)).toBe(true);
    expect(loadDraft(s)?.name).toBe("Rotisería Doña Marta");
    clearDraft(s);
    expect(loadDraft(s)).toBeNull();
  });

  it("ignora datos corruptos o de otra versión", () => {
    const s = memoryStore();
    s.setItem(DRAFT_KEY, "{no es json");
    expect(loadDraft(s)).toBeNull();
    s.setItem(DRAFT_KEY, JSON.stringify({ version: 99, categories: [] }));
    expect(loadDraft(s)).toBeNull();
  });

  it("no rompe si no hay storage", () => {
    expect(saveDraft(createDraftFromTemplate(tpl), null)).toBe(false);
    expect(loadDraft(null)).toBeNull();
  });
});
