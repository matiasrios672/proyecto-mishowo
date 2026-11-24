"use client";

import { useEffect, useRef, useState } from "react";

/** Número que sube hasta su valor al aparecer (700 ms). Con movimiento reducido, o si no es un número, se muestra tal cual. */
export function CountUp({ value, format = (n: number) => n.toLocaleString("es-AR"), duration = 700 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // sin movimiento: se muestra el valor final (abajo)
    const start = performance.now(), a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (t < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return <span className="tabular-nums">{format(reduced ? value : shown)}</span>;
}

/** Bloques grises que brillan mientras carga una pantalla (mejor que un «Cargando…» suelto). */
export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-5" role="status" aria-label="Cargando">
      <div className="panel-skeleton h-9 w-56" />
      <div className="panel-skeleton h-4 w-80 max-w-full" />
      <div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className="panel-skeleton h-24" />)}</div>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="panel-skeleton h-14" />)}
    </div>
  );
}
