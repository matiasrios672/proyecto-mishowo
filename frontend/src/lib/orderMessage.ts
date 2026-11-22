import { formatPrice } from "./format";

export interface MessageLine { name: string; optionLabel: string | null; unitPrice: number | null; quantity: number }

export interface MessageInput {
  greeting: string;
  number?: number | null;     // número de pedido, si ya quedó registrado
  items: MessageLine[];
  total: number;
  hasUnpriced?: boolean;
  customerName?: string | null;
  notes?: string | null;
  eventDate?: string | null;  // YYYY-MM-DD
}

/** "2026-12-25" -> "25/12/2026" sin pasar por Date (evita corrimientos por zona horaria). */
export function formatEventDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Texto del pedido para WhatsApp. */
export function buildOrderMessage(i: MessageInput): string {
  const lines: string[] = [i.greeting.trim() || "Hola! Quiero hacer este pedido:"];
  if (i.number) lines.push(`*Pedido #${i.number}*`);
  lines.push("");
  for (const it of i.items) {
    const label = it.optionLabel ? `${it.name} (${it.optionLabel})` : it.name;
    const sub = it.unitPrice === null ? "a consultar" : formatPrice(it.unitPrice * it.quantity);
    lines.push(`• ${it.quantity} x ${label} — ${sub}`);
  }
  lines.push("");
  lines.push(`*Total: ${formatPrice(i.total)}*${i.hasUnpriced ? " (más los productos a consultar)" : ""}`);
  const extra: string[] = [];
  if (i.eventDate) extra.push(`Fecha del evento: ${formatEventDate(i.eventDate)}`);
  if (i.customerName?.trim()) extra.push(`Nombre: ${i.customerName.trim()}`);
  if (i.notes?.trim()) extra.push(`Notas: ${i.notes.trim()}`);
  if (extra.length) lines.push("", ...extra);
  return lines.join("\n");
}

/** Mensajes de error de la API en voseo, sin jerga técnica. */
export function orderErrorMessage(code: string | undefined): string {
  switch (code) {
    case "out_of_stock": return "Uno de los productos se quedó sin stock. Revisá tu pedido y probá de nuevo.";
    case "unavailable": return "Uno de los productos ya no está disponible. Sacalo del pedido y probá de nuevo.";
    case "option_required":
    case "invalid_option": return "Una de las opciones que elegiste ya no está disponible. Volvé a elegirla.";
    case "event_date_required": return "Elegí la fecha de tu evento para poder enviar el pedido.";
    case "unavailable_business": return "Este negocio no está recibiendo pedidos por el momento.";
    case "not_found": return "No encontramos este negocio.";
    default: return "No pudimos registrar tu pedido. Probá de nuevo en un momento.";
  }
}
