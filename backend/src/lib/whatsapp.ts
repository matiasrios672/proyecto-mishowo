// Mismo criterio que el frontend (frontend/src/lib/whatsapp.ts): números argentinos en formato 549 + código de área + número.

/** Acepta "11 5555-0000", "011 5555 0000", "+54 9 11 5555-0000", "(0351) 412-3456". Devuelve null si no parece válido. */
export function normalizeWhatsapp(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9")) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length !== 10 || d.startsWith("0")) return null;
  return `549${d}`;
}
