export const STATUSES = ["nuevo", "confirmado", "listo", "entregado", "cancelado"] as const;
export type OrderStatus = (typeof STATUSES)[number];

// Un pedido avanza paso a paso y puede cancelarse hasta antes de entregarse. Entregado y cancelado son finales.
const NEXT: Record<OrderStatus, readonly OrderStatus[]> = {
  nuevo: ["confirmado", "cancelado"],
  confirmado: ["listo", "cancelado"],
  listo: ["entregado", "cancelado"],
  entregado: [],
  cancelado: [],
};

export const isStatus = (v: string): v is OrderStatus => (STATUSES as readonly string[]).includes(v);
export const canTransition = (from: string, to: string) => isStatus(from) && isStatus(to) && NEXT[from].includes(to);
export const nextStatuses = (from: string): readonly OrderStatus[] => (isStatus(from) ? NEXT[from] : []);
