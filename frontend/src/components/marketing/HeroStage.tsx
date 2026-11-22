"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { IconChart, IconChat, IconCheck, IconLink, Cursor } from "./Doodles";

const glass = "border border-white/70 bg-white/55 shadow-[0_24px_50px_-20px_rgba(47,111,176,0.45)] backdrop-blur-xl";

const PRODUCTS = [
  { n: "Docena de empanadas", p: "$ 14.500", c: "from-[#F3C98B] to-[#E8A55B]" },
  { n: "Pizza grande", p: "$ 9.800", c: "from-[#F5A3BC] to-[#E9759B]" },
  { n: "Flan casero", p: "$ 3.200", c: "from-[#A9CDF0] to-[#74ACDF]" },
];

/**
 * Escenario del hero: una página de negocio real en un celular y un cursor que la usa solo (agrega dos productos
 * y toca "Pedir por WhatsApp"). Alrededor, tarjetas de vidrio con lo que el dueño ve del otro lado.
 * Solo CSS salvo el parallax con el puntero; con movimiento reducido queda todo estático.
 */
export function HeroStage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        el.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      });
    };
    el.addEventListener("pointermove", move);
    return () => { el.removeEventListener("pointermove", move); cancelAnimationFrame(raf); };
  }, []);

  const drift = (d: number) => ({ transform: `translate(calc(var(--px) * ${d}px), calc(var(--py) * ${d}px))`, transition: "transform 0.3s ease-out" }) as CSSProperties;

  return (
    <div ref={ref} className="relative mx-auto h-[33rem] w-full max-w-xl sm:h-[38rem]" style={{ "--px": 0, "--py": 0 } as CSSProperties}>
      {/* Luces translúcidas de fondo */}
      <div aria-hidden className="mk-blob absolute left-[8%] top-[6%] size-64 rounded-full bg-[#74ACDF]/40 blur-3xl" />
      <div aria-hidden className="mk-blob absolute bottom-[4%] right-[4%] size-56 rounded-full bg-[#2F6FB0]/25 blur-3xl" style={{ animationDelay: "-6s" }} />

      {/* Tarjeta: visitas (lo que ve el dueño) */}
      <div aria-hidden className="absolute -left-4 top-[6%] z-20 hidden sm:block lg:-left-10" style={drift(22)}>
        <div className={`mk-float w-44 rounded-2xl p-3.5 ${glass}`} style={{ "--dur": "7s" } as CSSProperties}>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0E1B2C]/65"><IconChart className="size-4 text-[#2F6FB0]" />Visitas hoy</p>
          <p className="mt-1 text-2xl font-extrabold leading-none text-[#0E1B2C]">128 <span className="text-xs font-bold text-emerald-600">▲ 24%</span></p>
          <svg viewBox="0 0 120 30" className="mt-2 h-7 w-full" fill="none"><path d="M0 26 15 20 30 22 45 14 60 17 75 8 90 11 105 4 120 6" stroke="#2F6FB0" strokeWidth="2.500" strokeLinecap="round" strokeLinejoin="round" /><path d="M0 26 15 20 30 22 45 14 60 17 75 8 90 11 105 4 120 6V30H0Z" fill="#74ACDF" fillOpacity="0.25" /></svg>
        </div>
      </div>

      {/* Tarjeta: el link listo */}
      <div aria-hidden className="absolute -right-2 top-[3%] z-20 hidden sm:block lg:-right-8" style={drift(30)}>
        <div className={`mk-float flex items-center gap-2.5 rounded-2xl px-3.5 py-3 ${glass}`} style={{ "--dur": "8.5s", "--delay": "-2s" } as CSSProperties}>
          <span className="grid size-9 place-items-center rounded-xl bg-[#2F6FB0] text-white"><IconLink className="size-5" /></span>
          <span><span className="block text-[11px] font-semibold text-[#0E1B2C]/65">Tu link</span><span className="block text-sm font-extrabold text-[#0E1B2C]">lupe.mishowo.com</span></span>
        </div>
      </div>

      {/* El celular */}
      <div className="absolute left-1/2 top-1/2 w-[16.5rem] sm:w-[18.5rem]" style={{ transform: "translate(calc(-50% + var(--px) * -8px), calc(-50% + var(--py) * -8px))" }}>
        <div role="img" aria-label="Demostración: un cursor agrega dos productos en la página de un negocio y toca Pedir por WhatsApp; enseguida llega el pedido."
          className="relative rounded-[2.5rem] border border-white/80 bg-white/40 p-2.5 shadow-[0_40px_80px_-30px_rgba(14,27,44,0.55)] backdrop-blur-md">
          <div className="relative h-[28rem] overflow-hidden rounded-[2rem] bg-white sm:h-[31rem]">
            <div className="mx-auto mt-2.5 h-5 w-20 rounded-full bg-[#0E1B2C]" />
            <div className="flex items-center gap-2.5 px-4 pt-3">
              <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-[#74ACDF] to-[#2F6FB0] text-sm font-extrabold text-white">L</span>
              <span className="text-left"><span className="block text-sm font-extrabold leading-tight text-[#0E1B2C]">Lupe Empanadas</span><span className="block text-[11px] text-emerald-600">● Abierto ahora</span></span>
            </div>
            <ul className="mt-4 space-y-2.5 px-4">
              {PRODUCTS.map((p, i) => (
                <li key={p.n} className="flex items-center gap-3 rounded-2xl border border-[#0E1B2C]/8 bg-white p-2 shadow-sm">
                  <span className={`size-11 shrink-0 rounded-xl bg-gradient-to-br ${p.c}`} />
                  <span className="min-w-0 flex-1 text-left"><span className="block truncate text-xs font-bold text-[#0E1B2C]">{p.n}</span><span className="block text-[11px] font-semibold text-[#0E1B2C]/60">{p.p}</span></span>
                  <span className={`relative grid size-7 place-items-center rounded-full bg-[#2F6FB0] text-white ${i === 0 ? "mk-add-a" : i === 1 ? "mk-add-b" : ""}`}>
                    <span className="mk-plus text-base font-bold leading-none">+</span>
                    {i < 2 && <IconCheck className="mk-tick absolute size-4" />}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mx-4 mt-3 overflow-hidden rounded-2xl bg-gradient-to-br from-[#2F6FB0] to-[#74ACDF] p-3 text-left text-white"><p className="text-[11px] font-semibold opacity-90">Combo del día</p><p className="text-sm font-extrabold leading-tight">6 empanadas + bebida</p><p className="text-xs opacity-90">15% off hasta las 21 hs</p></div>
            <div className="absolute inset-x-4 bottom-4">
              <div className="mk-cta relative grid h-12 place-items-center rounded-2xl bg-[#1FAF5B] text-sm font-extrabold text-white shadow-[0_10px_24px_-8px_rgba(31,175,91,0.7)]">
                <span className="flex items-center gap-2"><IconChat className="size-5" />Pedir por WhatsApp<span className="mk-count ml-0.5 rounded-full bg-white/25 px-2 py-0.5 text-[11px]"><span className="mk-n0">0</span><span className="mk-n1">1</span><span className="mk-n2">2</span></span></span>
              </div>
            </div>
            {/* Cursor y ondas de clic */}
            <span aria-hidden className="mk-ripple mk-r1" /><span aria-hidden className="mk-ripple mk-r2" /><span aria-hidden className="mk-ripple mk-r3" />
            <Cursor className="mk-cursor absolute size-6 drop-shadow-md" />
          </div>
        </div>
      </div>

      {/* Pedido que llega */}
      <div aria-hidden className="absolute -right-3 bottom-[22%] z-20 sm:-right-6 lg:-right-12" style={drift(26)}>
        <div className={`mk-notify w-52 rounded-2xl p-3.5 ${glass}`}>
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600"><span className="size-2 animate-pulse rounded-full bg-emerald-500" />WhatsApp · ahora</p>
          <p className="mt-1 text-sm font-extrabold leading-tight text-[#0E1B2C]">¡Pedido nuevo #12!</p>
          <p className="text-xs text-[#0E1B2C]/70">Empanadas y pizza · $ 24.300</p>
        </div>
      </div>
    </div>
  );
}
