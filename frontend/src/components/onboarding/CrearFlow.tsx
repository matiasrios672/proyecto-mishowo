"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { useUser } from "@/components/auth/authStore";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { IconCheck } from "@/components/marketing/Doodles";

const STEPS = [
  { n: "Creá tu cuenta", d: "Así guardamos tu avance y no perdés nada." },
  { n: "Elegí tu rubro", d: "Te armamos una página con productos de ejemplo." },
  { n: "Hacela tuya y publicá", d: "Cambiás todo y compartís tu link." },
];

const rise = (d: number) => ({ "--d": `${d}ms` }) as CSSProperties;

/**
 * Recorrido de /crear: primero la cuenta (para poder acompañarte y escribirte si no terminás), después el rubro.
 * Quien ya tiene sesión salta directo al rubro. `picker` es la grilla de rubros, que llega del servidor.
 */
export function CrearFlow({ picker }: { picker: ReactNode }) {
  const user = useUser();
  const step = user ? 1 : 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-14">
      <ol aria-label="Pasos para crear tu página" className="site-rise grid gap-3 sm:grid-cols-3" data-testid="crear-steps">
        {STEPS.map((s, i) => (
          <li key={s.n} aria-current={i === step ? "step" : undefined} className={`flex items-start gap-3 border-t-2 pt-3 transition-colors duration-500 ${i <= step ? "border-[#C73E00]" : "border-[#0E1B2C]/15"}`}>
            <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-extrabold transition-colors duration-500 ${i < step ? "bg-[#15803D] text-white" : i === step ? "bg-[#FC5502] text-[#0E1B2C]" : "bg-white text-[#0E1B2C]/60"}`}>
              {i < step ? <IconCheck className="size-4" /> : i + 1}
            </span>
            <span className={i === step ? "" : i < step ? "opacity-80" : "opacity-60"}>
              <span className="block text-sm font-extrabold text-[#0E1B2C]">{s.n}</span>
              <span className="block text-[13px] leading-snug text-[#0E1B2C]/70">{s.d}</span>
            </span>
          </li>
        ))}
      </ol>

      {user === undefined && <div aria-hidden className="mt-12 h-96 animate-pulse bg-white/50" />}

      {user === null && (
        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16" data-testid="crear-account">
          <div>
            <p className="site-rise mb-4 inline-flex items-center gap-2 rounded-full bg-[#15803D] px-4 py-1.5 text-sm font-extrabold text-white" style={rise(80)}>
              <span aria-hidden className="size-2 rounded-full bg-white" />Plan gratis para siempre · sin tarjeta
            </p>
            <h1 className="mk-display site-rise max-w-[14ch] text-5xl font-extrabold leading-[0.98] tracking-tight text-[#0E1B2C] sm:text-7xl" style={rise(140)}>
              Empezá tu <span className="text-[#C73E00]">página</span> en un minuto
            </h1>
            <p className="site-rise mt-5 max-w-[48ch] text-lg text-[#0E1B2C]/75 sm:text-xl" style={rise(220)}>
              Creá tu cuenta gratis y elegí el rubro. Tu avance queda guardado y podés seguir desde el celular o la compu.
            </p>
            <ul className="site-rise mt-7 space-y-3" style={rise(300)}>
              {["Tu página lista con productos de ejemplo", "Pedidos por WhatsApp, sin comisión por venta", "Tu propio link para Instagram y tu local"].map((t) => (
                <li key={t} className="flex gap-3 text-[17px] text-[#0E1B2C]"><IconCheck className="mt-0.5 size-5 shrink-0 text-[#15803D]" />{t}</li>
              ))}
            </ul>
          </div>

          <div className="site-rise border border-[#0E1B2C]/10 bg-white p-6 shadow-[0_40px_80px_-40px_rgba(252,85,2,0.55)] sm:p-8" style={{ ...rise(200), borderRadius: "1.25rem" }}>
            <h2 className="mk-display text-2xl font-extrabold text-[#0E1B2C]">Creá tu cuenta</h2>
            <p className="mb-5 mt-1 text-sm text-[#0E1B2C]/65">Es gratis y en 30 segundos. Después elegís tu rubro.</p>
            <RegisterForm nameRequired onDone={() => { /* el estado de sesión cambia solo y pasa al paso 2 */ }} />
            <p className="mt-5 border-t border-[#0E1B2C]/10 pt-4 text-center text-sm text-[#0E1B2C]/70">
              ¿Ya tenés cuenta? <Link href="/ingresar?next=/crear" className="font-bold text-[#C73E00]">Ingresá</Link>
            </p>
          </div>
        </div>
      )}

      {user && (
        <div data-testid="crear-rubro">
          <div className="mt-10">
            <p className="site-rise mb-4 inline-flex items-center gap-2 rounded-full bg-[#15803D] px-4 py-1.5 text-sm font-extrabold text-white" style={rise(60)}>
              <span aria-hidden className="size-2 rounded-full bg-white" />{user.name ? `¡Listo, ${user.name.split(" ")[0]}! Cuenta creada` : "¡Cuenta creada!"}
            </p>
            <h1 className="mk-display site-rise max-w-[16ch] text-5xl font-extrabold leading-[0.98] tracking-tight text-[#0E1B2C] sm:text-7xl" style={rise(120)}>
              ¿De qué es tu <span className="text-[#FC5502]">negocio</span>?
            </h1>
            <p className="site-rise mt-5 max-w-[52ch] text-lg text-[#0E1B2C]/75 sm:text-xl" style={rise(200)}>
              Elegí tu rubro y en un minuto tenés una página armada. Después la cambiás a tu gusto.
            </p>
          </div>
          <div className="mt-10">{picker}</div>
          <p className="mt-10 max-w-[60ch] text-sm text-[#0E1B2C]/65">¿No encontrás tu rubro? Elegí «Otro rubro» y armás tu catálogo desde cero. Todo se guarda en tu cuenta.</p>
        </div>
      )}
    </main>
  );
}
