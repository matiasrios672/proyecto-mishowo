import { eq } from "drizzle-orm";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import type { Mailer } from "../lib/mailer.js";

export interface NewOrder {
  number: number;
  total: number;
  items: { name: string; optionLabel: string | null; unitPrice: number; quantity: number }[];
  customerName: string | null;
  notes: string | null;
  eventDate: string | null;
}

export function orderEmailText(businessName: string, o: NewOrder, appUrl: string): string {
  const lines = o.items.map((i) => `• ${i.quantity} x ${i.name}${i.optionLabel ? ` (${i.optionLabel})` : ""}`);
  return [
    `Entró el pedido #${o.number} en ${businessName}`,
    ...(o.customerName ? [`Cliente: ${o.customerName}`] : []),
    ...(o.eventDate ? [`Fecha del evento: ${o.eventDate}`] : []),
    "",
    ...lines,
    "",
    `Total: $ ${o.total.toLocaleString("es-AR")}`,
    ...(o.notes ? ["", `Aclaraciones: ${o.notes}`] : []),
    "",
    `Verlo y gestionarlo: ${appUrl}/panel/pedidos`,
  ].join("\n");
}

/** Avisa por email al dueño que entró un pedido. Si falla, el pedido ya quedó registrado: solo se informa el error. */
export async function notifyOwner(
  db: Db, mailer: Mailer, ownerId: string, businessName: string, order: NewOrder, appUrl: string, onError: (e: unknown) => void,
): Promise<void> {
  try {
    const [owner] = await db.select({ email: s.users.email }).from(s.users).where(eq(s.users.id, ownerId));
    if (!owner) return;
    await mailer.send({ to: owner.email, subject: `Nuevo pedido #${order.number} en ${businessName}`, text: orderEmailText(businessName, order, appUrl) });
  } catch (e) {
    onError(e);
  }
}
