// Exportación CSV para Excel en español (separador ";" y BOM UTF-8 para que respete las tildes).

/** Una celda que empieza con = + - @ se interpreta como fórmula al abrirla en Excel: se neutraliza con un apóstrofo. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
