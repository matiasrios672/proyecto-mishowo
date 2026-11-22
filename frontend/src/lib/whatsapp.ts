// Números argentinos para WhatsApp. Se guarda en formato internacional sin "+": 549 + código de área + número.

/** Acepta "11 5555-0000", "011 5555 0000", "+54 9 11 5555-0000", "(0351) 155-123456" sin el 15. Devuelve null si no parece válido. */
export function normalizeWhatsapp(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9")) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);
  // Código de área (2 a 4 dígitos) + número = 10 dígitos en total.
  if (d.length !== 10) return null;
  if (d.startsWith("0")) return null;
  return `549${d}`;
}

export const isValidWhatsapp = (input: string) => normalizeWhatsapp(input) !== null;

/** Link para abrir el chat con el texto ya armado. */
export function whatsappLink(number: string, text: string): string | null {
  const n = normalizeWhatsapp(number);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}

/** "5491155550000" -> "+54 9 11 5555-0000" (solo para mostrar). */
export function formatWhatsapp(input: string): string {
  const n = normalizeWhatsapp(input);
  if (!n) return input;
  const national = n.slice(3);
  const area = national.startsWith("11") ? 2 : national.startsWith("2") || national.startsWith("3") ? 4 : 3;
  const rest = national.slice(area);
  return `+54 9 ${national.slice(0, area)} ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
}
