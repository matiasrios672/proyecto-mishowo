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

/** Minúsculas y sin tildes, para búsquedas ("Jamón" encuentra "jamon"). */
export const normalizeSearch = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** "hace 5 min", "hace 2 h", "ayer"... para listas de pedidos. */
export function timeAgo(from: string | number | Date, now: number = Date.now()): string {
  const sec = Math.round((new Date(from).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });
  const abs = Math.abs(sec);
  if (abs < 45) return "recién";
  if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(sec / 86400), "day");
  return new Date(from).toLocaleDateString("es-AR");
}
