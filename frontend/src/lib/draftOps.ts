// Operaciones inmutables sobre el borrador. Todas devuelven un borrador nuevo.
import type { Draft, DraftCategory, DraftOption, DraftProduct } from "./draft";
import type { BulkItem } from "./bulk";

let n = 0;
export const newId = () => `${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function blankProduct(): DraftProduct {
  return { id: newId(), name: "", description: "", price: null, comparePrice: null, available: true, stock: null, options: [], isExample: false };
}

const mapProducts = (d: Draft, fn: (p: DraftProduct, c: DraftCategory) => DraftProduct): Draft => ({
  ...d, categories: d.categories.map((c) => ({ ...c, products: c.products.map((p) => fn(p, c)) })),
});

export function findProduct(d: Draft, id: string): { product: DraftProduct; category: DraftCategory } | null {
  for (const c of d.categories) {
    const p = c.products.find((x) => x.id === id);
    if (p) return { product: p, category: c };
  }
  return null;
}

/** Editar un producto lo saca de "Ejemplo". */
export function updateProduct(d: Draft, id: string, patch: Partial<DraftProduct>): Draft {
  return mapProducts(d, (p) => (p.id === id ? { ...p, ...patch, isExample: false } : p));
}

export function addProduct(d: Draft, categoryId?: string): { draft: Draft; id: string } {
  const product = blankProduct();
  let cats = d.categories;
  if (cats.length === 0) cats = [{ id: newId(), name: "Productos", products: [] }];
  const target = categoryId && cats.some((c) => c.id === categoryId) ? categoryId : cats[0]!.id;
  return {
    id: product.id,
    draft: { ...d, categories: cats.map((c) => (c.id === target ? { ...c, products: [...c.products, product] } : c)) },
  };
}

export function removeProduct(d: Draft, id: string): Draft {
  return { ...d, categories: d.categories.map((c) => ({ ...c, products: c.products.filter((p) => p.id !== id) })) };
}

export function duplicateProduct(d: Draft, id: string): { draft: Draft; id: string | null } {
  const found = findProduct(d, id);
  if (!found) return { draft: d, id: null };
  const copy: DraftProduct = {
    ...found.product, id: newId(), name: `${found.product.name} (copia)`, isExample: false,
    options: found.product.options.map((o) => ({ ...o, id: newId() })),
  };
  return {
    id: copy.id,
    draft: {
      ...d,
      categories: d.categories.map((c) => {
        if (c.id !== found.category.id) return c;
        const i = c.products.findIndex((p) => p.id === id);
        return { ...c, products: [...c.products.slice(0, i + 1), copy, ...c.products.slice(i + 1)] };
      }),
    },
  };
}

/** Mueve un producto dentro de su categoría (-1 arriba, +1 abajo). */
export function moveProduct(d: Draft, id: string, delta: -1 | 1): Draft {
  return {
    ...d,
    categories: d.categories.map((c) => {
      const i = c.products.findIndex((p) => p.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= c.products.length) return c;
      const products = [...c.products];
      [products[i], products[j]] = [products[j]!, products[i]!];
      return { ...c, products };
    }),
  };
}

/** Reordena arrastrando: mueve `id` a la posición de `targetId` (puede ser otra categoría). */
export function moveProductTo(d: Draft, id: string, targetId: string): Draft {
  const src = findProduct(d, id);
  const dst = findProduct(d, targetId);
  if (!src || !dst || id === targetId) return d;
  const without = d.categories.map((c) => ({ ...c, products: c.products.filter((p) => p.id !== id) }));
  return {
    ...d,
    categories: without.map((c) => {
      if (c.id !== dst.category.id) return c;
      const i = c.products.findIndex((p) => p.id === targetId);
      return { ...c, products: [...c.products.slice(0, i), src.product, ...c.products.slice(i)] };
    }),
  };
}

export function moveProductToCategory(d: Draft, id: string, categoryId: string): Draft {
  const src = findProduct(d, id);
  if (!src || src.category.id === categoryId || !d.categories.some((c) => c.id === categoryId)) return d;
  return {
    ...d,
    categories: d.categories.map((c) => {
      if (c.id === src.category.id) return { ...c, products: c.products.filter((p) => p.id !== id) };
      if (c.id === categoryId) return { ...c, products: [...c.products, src.product] };
      return c;
    }),
  };
}

export function addCategory(d: Draft, name: string): Draft {
  const clean = name.trim();
  if (!clean || d.categories.some((c) => c.name.toLowerCase() === clean.toLowerCase())) return d;
  return { ...d, categories: [...d.categories, { id: newId(), name: clean, products: [] }] };
}
export function renameCategory(d: Draft, id: string, name: string): Draft {
  return { ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, name } : c)) };
}
export function removeCategory(d: Draft, id: string): Draft {
  // Los productos de una categoría eliminada pasan a la primera restante, no se pierden.
  const gone = d.categories.find((c) => c.id === id);
  const rest = d.categories.filter((c) => c.id !== id);
  if (!gone) return d;
  if (rest.length === 0) return { ...d, categories: [] };
  return { ...d, categories: rest.map((c, i) => (i === 0 ? { ...c, products: [...c.products, ...gone.products] } : c)) };
}

/** Variantes en 2 ejes (ej. talle × color) -> opciones "M / Rojo". Conserva precio y agotado de las que ya existían. */
export function buildVariants(axis1: string[], axis2: string[], existing: DraftOption[] = []): DraftOption[] {
  const a = axis1.map((x) => x.trim()).filter(Boolean);
  const b = axis2.map((x) => x.trim()).filter(Boolean);
  const labels = a.length && b.length ? a.flatMap((x) => b.map((y) => `${x} / ${y}`)) : a.length ? a : b;
  const byLabel = new Map(existing.map((o) => [o.label, o]));
  return labels.map((label) => byLabel.get(label) ?? { id: newId(), label, price: null, soldOut: false });
}

/** Stock numérico: en 0 el producto queda agotado automáticamente. */
export function isAvailable(p: Pick<DraftProduct, "available" | "stock">): boolean {
  return p.available && (p.stock === null || p.stock > 0);
}

/** Descuento visible si el precio tachado es mayor al precio. */
export function discountPercent(p: Pick<DraftProduct, "price" | "comparePrice">): number | null {
  if (p.price === null || p.comparePrice === null || p.comparePrice <= p.price || p.comparePrice <= 0) return null;
  return Math.round((1 - p.price / p.comparePrice) * 100);
}

export function importItems(d: Draft, items: BulkItem[]): Draft {
  let draft = d;
  for (const it of items) {
    const catName = it.category.trim() || "Productos";
    let cat = draft.categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
    if (!cat) {
      draft = addCategory(draft, catName);
      cat = draft.categories.find((c) => c.name.toLowerCase() === catName.toLowerCase())!;
    }
    const product: DraftProduct = { ...blankProduct(), name: it.name, description: it.description, price: it.price };
    draft = { ...draft, categories: draft.categories.map((c) => (c.id === cat!.id ? { ...c, products: [...c.products, product] } : c)) };
  }
  return draft;
}

/** Quita todo el contenido de ejemplo de una vez. */
export function removeExamples(d: Draft): Draft {
  return { ...d, categories: d.categories.map((c) => ({ ...c, products: c.products.filter((p) => !p.isExample) })) };
}

export function filterProducts(d: Draft, query: string): DraftProduct[] {
  const q = query.trim().toLowerCase();
  const all = d.categories.flatMap((c) => c.products);
  return q ? all.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) : all;
}
