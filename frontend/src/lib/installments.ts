import { formatPrice } from "./format";

/**
 * Cuotas que el negocio ofrece a sus clientes. Es informativo: MiShowo no cobra ni procesa pagos
 * (el pago se coordina con el negocio, que es quien tiene el POS, Mercado Pago o el banco que acuerde las cuotas).
 */
export interface Installments {
  enabled: boolean;
  /** Cantidad de cuotas sin interés. */
  count: number;
  /** Aclaración libre, ej. "Con tarjetas de crédito bancarias". */
  note: string;
  /** Compra mínima para ofrecer cuotas (0 = sin mínimo). */
  minAmount: number;
}

export const INSTALLMENT_CHOICES = [2, 3, 6, 9, 12, 18, 24] as const;
export const NO_INSTALLMENTS: Installments = { enabled: false, count: 3, note: "", minAmount: 0 };

/** Valores seguros a partir de lo que vino del servidor o del borrador local. */
export function normalizeInstallments(raw: unknown): Installments {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const count = Number(r.count);
  const min = Number(r.minAmount);
  return {
    enabled: r.enabled === true,
    count: Number.isInteger(count) && count >= 2 && count <= 24 ? count : 3,
    note: typeof r.note === "string" ? r.note.slice(0, 80) : "",
    minAmount: Number.isFinite(min) && min > 0 ? Math.min(Math.round(min), 100_000_000) : 0,
  };
}

/** Valor de cada cuota, redondeado a centavos. */
export const installmentValue = (total: number, count: number): number => Math.round((total / count) * 100) / 100;

/** ¿Este monto califica? (con mínimo, el precio "desde" de un producto con variantes no siempre alcanza). */
export const qualifies = (inst: Installments | undefined, amount: number | null): inst is Installments =>
  !!inst && inst.enabled && amount !== null && amount > 0 && amount >= inst.minAmount;

/** "3 cuotas sin interés de $ 31.650" (null si no corresponde). */
export function installmentLine(amount: number | null, inst: Installments | undefined): string | null {
  if (!qualifies(inst, amount) || amount === null) return null;
  return `${inst.count} cuotas sin interés de ${formatPrice(installmentValue(amount, inst.count))}`;
}
