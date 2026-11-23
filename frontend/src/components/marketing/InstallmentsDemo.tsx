"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ProductIllustration } from "@/components/site/illustrations";
import { installmentLine, installmentValue } from "@/lib/installments";
import { formatPrice } from "@/lib/format";

const CHOICES = [3, 6, 12] as const;
const PRICE = 189900;

const FEATURES = [
  "Elegís cuántas cuotas (de 2 a 24) y desde qué monto",
  "Aparece en cada precio y en el pedido, solo donde corresponde",
  "Tu cliente tilda «Quiero pagar en cuotas» y te llega por WhatsApp",
  "Cobrás como ya lo hacés: posnet, Mercado Pago o tu banco",
];

/** Sección «Cuotas sin interés»: una demo que se puede tocar (cambia la cantidad y se recalcula el valor). */
export function InstallmentsDemo() {
  const [count, setCount] = useState<(typeof CHOICES)[number]>(6);
  const name = useId();
  const line = installmentLine(PRICE, { enabled: true, count, note: "", minAmount: 0 });

  return (
    <section id="cuotas" aria-labelledby="cuotas-title" className="relative isolate overflow-hidden bg-[#EAF4FC] py-16 sm:py-24">
      <div aria-hidden className="mk-ghost-drift pointer-events-none absolute -bottom-6 inset-x-0 -z-10 select-none text-center font-extrabold leading-none tracking-tighter mk-display"
        style={{ fontSize: "clamp(5rem, 26vw, 22rem)", backgroundImage: "linear-gradient(180deg, rgb(47 111 176 / 0.16), transparent 85%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
        CUOTAS
      </div>
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <p className="mb-4 inline-flex rounded-full bg-[#0E1B2C] px-4 py-1.5 text-sm font-bold text-white">Nuevo · Cuotas sin interés</p>
          <h2 id="cuotas-title" className="mk-display max-w-[15ch] text-4xl font-extrabold leading-[1.02] tracking-tight text-[#0E1B2C] sm:text-6xl">Vendé más ofreciendo cuotas</h2>
          <p className="mt-5 max-w-[48ch] text-lg text-[#0E1B2C]/75">Mostrá «6 cuotas sin interés de $ 31.650» en cada producto. Es un aviso en tu página: el cobro lo seguís coordinando vos, sin comisión de MiShowo.</p>
          <ul className="mt-6 space-y-3 text-[#0E1B2C]">
            {FEATURES.map((t) => (
              <li key={t} className="flex gap-3">
                <svg viewBox="0 0 20 20" aria-hidden className="mt-0.5 size-5 shrink-0 text-[#15803D]"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <Link href="/crear" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#0E1B2C] px-7 font-bold text-white transition-transform hover:bg-[#1a2d47] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Activá las cuotas en tu página</Link>
        </div>

        <div className="mx-auto w-full max-w-sm rounded-[1.75rem] border border-[#0E1B2C]/10 bg-white p-5 shadow-[0_40px_80px_-40px_rgba(47,111,176,0.6)]">
          <div className="grid aspect-[4/3] place-items-center rounded-2xl bg-[#E3EEF9]"><ProductIllustration name="Campera puffer corta" /></div>
          <div className="mt-4 flex items-baseline justify-between gap-3">
            <h3 className="mk-display text-xl font-extrabold text-[#0E1B2C]">Campera puffer corta</h3>
            <span className="whitespace-nowrap font-bold tabular-nums text-[#0E1B2C]">{formatPrice(PRICE)}</span>
          </div>
          <p className="mt-1 text-sm font-bold text-[#2F6FB0]" aria-live="polite" data-testid="demo-installments">{line}</p>
          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-[#0E1B2C]/70">Probá cambiar las cuotas</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {CHOICES.map((n) => (
                <label key={n} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 text-base font-bold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#2F6FB0] ${count === n ? "border-[#2F6FB0] bg-[#2F6FB0] text-white" : "border-[#0E1B2C]/15 text-[#0E1B2C] hover:border-[#2F6FB0]"}`}>
                  <input type="radio" name={name} value={n} checked={count === n} onChange={() => setCount(n)} className="sr-only" />
                  {n} cuotas
                </label>
              ))}
            </div>
          </fieldset>
          <p className="mt-4 text-xs text-[#0E1B2C]/60">{count} x {formatPrice(installmentValue(PRICE, count))} = {formatPrice(PRICE)}. Ejemplo ilustrativo.</p>
        </div>
      </div>
    </section>
  );
}
