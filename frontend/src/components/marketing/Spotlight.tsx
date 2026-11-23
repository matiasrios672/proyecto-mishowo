"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";

/** Tarjeta con un brillo suave que sigue al puntero (solo con mouse; sin movimiento reducido). */
export function Spotlight({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className={`mk-spot relative overflow-hidden ${className}`} style={style}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = ref.current!.getBoundingClientRect();
        ref.current!.style.setProperty("--mx", `${e.clientX - r.left}px`);
        ref.current!.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}>
      {children}
    </div>
  );
}
