import type { ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { BrandScope } from "@/components/brand/BrandScope";
import { Glow } from "@/components/marketing/Story";
import { IconBolt, IconChart, IconChat } from "@/components/marketing/Doodles";

const glass = "border border-white/70 bg-white/60 shadow-[0_24px_50px_-24px_rgba(252,85,2,0.5)] backdrop-blur-xl";

const POINTS = [
  { I: IconBolt, t: "Tu página lista en minutos", d: "Elegís tu rubro y ya tenés un catálogo armado." },
  { I: IconChat, t: "Consultas y pedidos a tu WhatsApp", d: "Con el total y las aclaraciones, si activás los pedidos." },
  { I: IconChart, t: "Sabés cuánta gente te mira", d: "Visitas, productos más vistos y de dónde vienen." },
];

/** Marco de ingreso: panel de marca a la izquierda (solo pantallas anchas) y el formulario en una tarjeta. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <BrandScope>
      <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
        <aside aria-hidden className="relative isolate hidden overflow-hidden bg-gradient-to-br from-[#FFE2D0] to-[#FFEFE6] p-12 lg:flex lg:flex-col lg:justify-between">
          <Glow />
          <Wordmark className="text-3xl" />
          <div className="max-w-lg">
            <p className="mk-display text-5xl font-extrabold leading-[1.02] tracking-tight text-[#0E1B2C] xl:text-6xl">
              Tu negocio,<br /><span className="text-[#FC5502]">en un link.</span>
            </p>
            <ul className="mt-10 space-y-4">
              {POINTS.map(({ I, t, d }) => (
                <li key={t} className={`flex gap-4 rounded-2xl p-4 ${glass}`}>
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#C73E00]/10 text-[#C73E00]"><I className="size-6" /></span>
                  <span><span className="block font-extrabold text-[#0E1B2C]">{t}</span><span className="text-sm text-[#0E1B2C]/70">{d}</span></span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-[#0E1B2C]/60">Sin tarjeta para empezar. Sin comisión por venta.</p>
        </aside>

        <div className="relative isolate flex flex-col bg-gradient-to-b from-[#FFEFE6] to-white lg:bg-none">
          <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2.5 focus:font-semibold focus:shadow-lg focus:outline-2 focus:outline-ring">Saltar al formulario</a>
          <header className="px-5 pt-6 sm:px-8 lg:hidden">
            <Link href="/" aria-label="MiShowo, ir al inicio" className="inline-block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><Wordmark className="text-2xl" /></Link>
          </header>
          <main id="contenido" tabIndex={-1} className="flex flex-1 items-center justify-center px-4 py-8 outline-none sm:px-8">
            <div className="w-full max-w-md rounded-3xl border border-[#F5D9C8] bg-white p-6 shadow-[0_30px_60px_-35px_rgba(252,85,2,0.5)] sm:p-9">
              <h1 className="mk-display text-3xl font-extrabold tracking-tight text-[#0E1B2C]">{title}</h1>
              {subtitle && <p className="mt-2 text-base leading-relaxed text-[#47566A]">{subtitle}</p>}
              <div className="mt-7">{children}</div>
              {footer && <div className="mt-7 border-t border-[#F5D9C8] pt-5 text-[15px] text-[#47566A] [&_a]:font-semibold [&_a]:text-[#C73E00]-offset-4">{footer}</div>}
            </div>
          </main>
        </div>
      </div>
    </BrandScope>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-[15px] font-medium text-destructive">{message}</p>;
}

export function FormNotice({ children }: { children: ReactNode }) {
  return <p role="status" className="rounded-xl bg-[#FFEFE6] p-3.5 text-[15px] text-[#0E1B2C]">{children}</p>;
}
