// Carga masiva de productos: CSV y "pegar lista". Devuelve productos listos para el borrador.
export interface BulkItem { name: string; description: string; price: number | null; category: string }

/** "$ 1.800", "1800,50", "18.000" -> número. Formato argentino: punto de miles, coma decimal. */
export function parsePrice(raw: string): number | null {
  const s = raw.replace(/[^\d.,]/g, "");
  if (!s) return null;
  let norm = s;
  if (s.includes(",")) norm = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) norm = s.replace(/\./g, "");
  const n = Number(norm);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Divide una línea CSV respetando comillas. Acepta coma o punto y coma. */
export function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (c === sep && !q) { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

const HEADERS: Record<string, keyof BulkItem> = {
  nombre: "name", producto: "name", name: "name",
  descripcion: "description", "descripción": "description", description: "description",
  precio: "price", price: "price",
  categoria: "category", "categoría": "category", category: "category",
};

export function parseCsv(text: string): { items: BulkItem[]; errors: string[] } {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  const errors: string[] = [];
  if (lines.length === 0) return { items: [], errors: ["El archivo está vacío"] };
  const sep = (lines[0]!.match(/;/g)?.length ?? 0) > (lines[0]!.match(/,/g)?.length ?? 0) ? ";" : ",";
  const head = splitCsvLine(lines[0]!, sep).map((h) => HEADERS[h.toLowerCase()]);
  if (!head.includes("name")) return { items: [], errors: ["Falta la columna «nombre»"] };
  const items: BulkItem[] = [];
  lines.slice(1).forEach((line, i) => {
    const cells = splitCsvLine(line, sep);
    const row: BulkItem = { name: "", description: "", price: null, category: "" };
    head.forEach((key, idx) => {
      if (!key) return;
      const v = cells[idx] ?? "";
      if (key === "price") row.price = parsePrice(v);
      else row[key] = v;
    });
    if (!row.name) errors.push(`Fila ${i + 2}: sin nombre, se omitió`);
    else items.push(row);
  });
  return { items, errors };
}

/**
 * "Pegar lista": una línea por producto. Formatos aceptados:
 *   Empanada de carne - 1800
 *   Empanada de carne $1.800
 *   Empanada de carne, 1800
 * Una línea sin precio y terminada en ":" abre una categoría.
 */
export function parsePastedList(text: string): { items: BulkItem[]; errors: string[] } {
  const items: BulkItem[] = [];
  const errors: string[] = [];
  let category = "";
  text.replace(/\r/g, "").split("\n").forEach((raw, i) => {
    const line = raw.replace(/^[\s\-•*·]+/, "").trim();
    if (!line) return;
    if (line.endsWith(":") && !/\d/.test(line)) { category = line.slice(0, -1).trim(); return; }
    const m = line.match(/^(.*?)[\s]*(?:[-–—:,]|\s)\s*\$?\s*(\d[\d.,]*)\s*$/);
    if (m && m[1]!.trim()) {
      items.push({ name: m[1]!.trim().replace(/[-–—:,]+$/, "").trim(), description: "", price: parsePrice(m[2]!), category });
    } else {
      items.push({ name: line, description: "", price: null, category });
      errors.push(`Línea ${i + 1}: «${line}» quedó sin precio`);
    }
  });
  return { items, errors };
}
