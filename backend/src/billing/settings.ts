import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";

// Datos para transferir que se le muestran al usuario. Los edita el dueño de MiShowo desde el admin.
export const paymentInfoSchema = z.object({
  holder: z.string().trim().max(100).default(""),
  alias: z.string().trim().max(60).default(""),
  cbu: z.string().trim().regex(/^\d{0,22}$/, "cbu").default(""),
  bank: z.string().trim().max(60).default(""),
  instructions: z.string().trim().max(500).default(""),
});
export type PaymentInfo = z.infer<typeof paymentInfoSchema>;

export const PAYMENT_KEY = "payment";

export async function getPaymentInfo(db: Pick<Db, "select">): Promise<PaymentInfo> {
  const [row] = await db.select().from(s.appSettings).where(eq(s.appSettings.key, PAYMENT_KEY));
  return paymentInfoSchema.parse(row?.value ?? {});
}
