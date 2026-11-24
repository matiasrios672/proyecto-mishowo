"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { IconChat, IconQr } from "./Doodles";

const STEPS = [
  { n: "Cargás", d: "Nombre, foto y precio de lo que vendés. Desde el celular, en minutos.", tag: "Catálogo" },
  { n: "Compartís", d: "Un link y un QR para tu bio de Instagram, tus historias y tu local.", tag: "Tu link" },
  { n: "Te escriben", d: "Te llega por WhatsApp: una consulta o, si activás los pedidos, el pedido completo con total y fecha.", tag: "WhatsApp" },
] as const;
const MS = 6000;
const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/**
 * Los tres pasos, con una escena que se arma sola paso a paso (y se puede elegir a mano).
 * Sin librerías de animación: un temporizador y animaciones CSS que se reinician al cambiar de paso.
 * Solo avanza mientras está a la vista y no avanza con movimiento reducido.
 */
export function StepsCycler() {
  const [step, setStep] = useState(0);
  const [manual, setManual] = useState(false);
  const [visible, setVisible] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const auto = visible && !manual && !reduced;
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % 3), MS);
    return () => clearTimeout(t);
  }, [auto, step]);

  const pick = (i: number) => { setManual(true); setStep(i); };

  return (
    <div ref={box} className="relative mt-12 grid items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_1.1fr] lg:gap-14">
      <ol className="relative flex flex-col" data-testid="steps">
        {/* Hilo que une los pasos */}
        <span aria-hidden className="absolute bottom-8 left-[1.375rem] top-8 w-px bg-white/15" />
        {STEPS.map((s, i) => {
          const on = step === i;
          return (
            <li key={s.n} className="relative">
              <button type="button" onClick={() => pick(i)} aria-current={on ? "step" : undefined}
                className="group relative flex w-full gap-5 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:py-5">
                <span className={`relative z-10 grid size-11 shrink-0 place-items-center rounded-full border text-sm font-extrabold tabular-nums transition-all duration-500 ${on ? "scale-110 border-[#FF8A4C] bg-[#FF8A4C] text-[#0E1B2C] shadow-[0_0_0_6px_rgba(116,172,223,0.18)]" : i < step ? "border-[#FF8A4C]/60 bg-[#14304F] text-[#FF8A4C]" : "border-white/25 bg-[#0E1B2C] text-white/60 group-hover:border-white/50"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={`min-w-0 flex-1 transition-opacity duration-500 ${on ? "opacity-100" : "opacity-55 group-hover:opacity-90"}`}>
                  <span className="mk-display block text-3xl font-extrabold leading-none sm:text-4xl">{s.n}</span>
                  <span className={`grid transition-all duration-500 ${on ? "mt-2 grid-rows-[1fr]" : "grid-rows-[0fr] sm:mt-2 sm:grid-rows-[1fr]"}`}>
                    <span className="overflow-hidden"><span className="block max-w-[38ch] text-[17px] leading-snug text-white/75">{s.d}</span></span>
                  </span>
                  <span aria-hidden className="mt-3 block h-0.5 w-full overflow-hidden bg-white/10">
                    {on && <span key={`${i}-${auto}`} className={`block h-full origin-left bg-[#FF8A4C] ${auto ? "mk-steps-bar" : ""}`} style={{ animationDuration: `${MS}ms` }} />}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Escena */}
      <div className="relative">
        <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-[radial-gradient(closest-side,rgba(116,172,223,0.35),transparent)]" />
        <div role="img" aria-label="Vista del paso elegido: cargar productos, compartir el link y recibir el pedido por WhatsApp."
          className="overflow-hidden rounded-2xl border border-white/20 bg-white text-[#0E1B2C] shadow-[0_50px_100px_-30px_rgba(0,0,0,0.7)]">
          <div className="flex items-center gap-3 border-b border-[#0E1B2C]/10 bg-[#FFFBF8] px-4 py-2.5">
            <span aria-hidden className="flex gap-1.5"><i className="size-2.5 rounded-full bg-[#0E1B2C]/15" /><i className="size-2.5 rounded-full bg-[#0E1B2C]/15" /><i className="size-2.5 rounded-full bg-[#0E1B2C]/15" /></span>
            <span className="min-w-0 flex-1 truncate bg-white px-3 py-1 text-center text-[11px] font-medium text-[#0E1B2C]/60 sm:text-xs">mishowo.com / panel / {STEPS[step]!.tag.toLowerCase().replace(" ", "-")}</span>
            <span className="rounded bg-[#FFEFE6] px-2 py-0.5 text-[11px] font-bold text-[#C73E00]">{STEPS[step]!.tag}</span>
          </div>
          <div className="relative h-[19.5rem] sm:h-[21rem]">
            <Pane on={step === 0}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-[#0E1B2C]/55">Tu catálogo</p>
                <p className="text-xs font-bold text-[#15803D]">Página lista al <span className="tabular-nums">100%</span></p>
              </div>
              <ul className="mt-3 space-y-2.5">
                {[["Alfajor de maicena", "$ 1.800", "#E8A55B"], ["Torta de ricota", "$ 6.500", "#E9759B"], ["Budín de limón", "$ 3.900", "#F6B40E"]].map(([n, p, c], i) => (
                  <li key={n} className="mk-in flex items-center gap-3 rounded-xl border border-[#0E1B2C]/10 p-2.5" style={d(120 + i * 220)}>
                    <span className="size-11 shrink-0 rounded-lg" style={{ background: `linear-gradient(135deg, ${c}, ${c}99)` }} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{n}</span><span className="font-extrabold text-[#C73E00]">{p}</span>
                  </li>
                ))}
              </ul>
              <p className="mk-pop mt-3 inline-block bg-[#FC5502] px-4 py-2.5 text-sm font-bold text-[#0E1B2C]" style={d(900)}>+ Agregar producto</p>
            </Pane>

            <Pane on={step === 1}>
              <p className="text-xs font-bold uppercase tracking-wide text-[#0E1B2C]/55">Tu link está listo</p>
              <div className="mt-3 inline-flex max-w-full items-center bg-[#FC5502] px-5 py-3 text-lg font-extrabold text-[#0E1B2C] sm:text-2xl">
                <span className="mk-type inline-block whitespace-nowrap" style={d(200)}>lupe.mishowo.com</span>
                <span aria-hidden className="mk-caret ml-1 inline-block h-6 w-0.5 bg-white" />
              </div>
              <div className="mt-5 flex items-center gap-5">
                <span className="mk-pop shrink-0" style={d(1500)}><IconQr className="size-24 text-[#0E1B2C]" /></span>
                <div className="mk-in min-w-0 border border-[#0E1B2C]/10 p-3 text-sm" style={d(1800)}>
                  <p className="font-bold">@lupe.empanadas</p><p className="text-[#0E1B2C]/70">Empanadas caseras. Pedí por acá 👇</p><p className="font-bold text-[#C73E00]">lupe.mishowo.com</p>
                </div>
              </div>
            </Pane>

            <Pane on={step === 2}>
              <p className="text-xs font-bold uppercase tracking-wide text-[#0E1B2C]/55">Te llega por WhatsApp</p>
              <p className="mk-in mt-3 max-w-[88%] rounded-2xl rounded-bl-sm bg-[#FFEFE6] p-3.5 font-medium" style={d(150)}>Hola! Quiero hacer este pedido:<br />• 1 docena de empanadas<br />• 1 flan casero<br /><b>Total: $ 17.700</b></p>
              <p className="mk-in ml-auto mt-2 max-w-[78%] rounded-2xl rounded-br-sm bg-[#D9F7E4] p-3.5 font-medium" style={d(1100)}>¡Genial! Te lo preparo para las 21 hs 🙌</p>
              <p className="mk-pop mt-3 inline-flex items-center gap-2 bg-[#0E1B2C] px-4 py-2.5 text-sm font-bold text-white" style={d(1900)}><IconChat className="size-4" /><span className="size-2 rounded-full bg-[#4ADE80]" />¡Pedido nuevo #12! · $ 17.700</p>
            </Pane>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Solo se monta la escena activa: así sus animaciones arrancan de cero cada vez que se elige el paso. */
function Pane({ on, children }: { on: boolean; children: ReactNode }) {
  if (!on) return null;
  return <div className="absolute inset-0 p-5 sm:p-6">{children}</div>;
}
