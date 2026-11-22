const ars = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** 1800 -> "$ 1.800". */
export const formatPrice = (n: number | null | undefined): string => (n === null || n === undefined ? "" : `$ ${ars.format(n)}`);

/** Precio "desde" cuando hay variantes con precios distintos. */
export function priceLabel(base: number | null, options: { price: number | null }[]): string {
  const prices = options.map((o) => o.price).filter((p): p is number => p !== null);
  if (prices.length === 0) return formatPrice(base);
  const min = Math.min(...prices, ...(base !== null ? [base] : []));
  const max = Math.max(...prices, ...(base !== null ? [base] : []));
  return min === max ? formatPrice(min) : `Desde ${formatPrice(min)}`;
}

export const buttonRadius = (shape: string | undefined) =>
  shape === "pildora" ? "9999px" : shape === "recto" ? "2px" : "0.5rem";
