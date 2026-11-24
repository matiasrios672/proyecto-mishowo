import type { ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { BrandScope } from "@/components/brand/BrandScope";
import { SLOGAN } from "@/content/brand";
import { IconBolt, IconChart, IconChat } from "@/components/marketing/Doodles";

const glass = "border border-white/10 bg-white/[0.06] shadow-[0_24px_50px_-28px_rgba(0,0,0,0.6)] backdrop-blur-xl";

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
        <aside aria-hidden className="relative isolate hidden overflow-hidden bg-[linear-gradient(160deg,#0E1B2C_0%,#16263F_60%,#2A2230_100%)] p-12 lg:flex lg:flex-col lg:justify-between">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10"><div className="mk-orb absolute -right-32 -top-24 size-[34rem] rounded-full" style={{ "--orb": "rgb(252 85 2 / 0.42)" } as React.CSSProperties} /><div className="mk-orb absolute -bottom-40 -left-24 size-[30rem] rounded-full" style={{ "--orb": "rgb(255 176 0 / 0.18)" } as React.CSSProperties} /></div>
          <Wordmark className="text-3xl" variant="claro" />
          <div className="max-w-lg">
            <p className="mk-display text-5xl font-extrabold leading-[1.02] tracking-tight text-white xl:text-6xl">
              {SLOGAN.line1}<br /><span className="text-[#FF7A2E]">{SLOGAN.line2}</span>
            </p>
            <ul className="mt-10 space-y-4">
              {POINTS.map(({ I, t, d }) => (
                <li key={t} className={`flex gap-4 rounded-2xl p-4 ${glass}`}>
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#FC5502]/20 text-[#FF9A5C]"><I className="size-6" /></span>
                  <span><span className="block font-extrabold text-white">{t}</span><span className="text-sm text-white/65">{d}</span></span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-white/55">Sin tarjeta para empezar. Sin comisión por venta.</p>
        </aside>

        <div className="relative isolate flex flex-col bg-[radial-gradient(700px_380px_at_80%_-10%,rgba(252,85,2,0.09),transparent_70%),#FBFBFD]">
          <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2.5 focus:font-semibold focus:shadow-lg focus:outline-2 focus:outline-ring">Saltar al formulario</a>
          <header className="px-5 pt-6 sm:px-8 lg:hidden">
            <Link href="/" aria-label="MiShowo, ir al inicio" className="inline-block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><Wordmark className="text-2xl" /></Link>
          </header>
          <main id="contenido" tabIndex={-1} className="flex flex-1 items-center justify-center px-4 py-8 outline-none sm:px-8">
            <div className="auth-card w-full max-w-md rounded-[28px] border border-[#E8EAF0] bg-white p-6 shadow-[0_1px_2px_rgba(21,27,43,0.04),0_40px_70px_-40px_rgba(21,27,43,0.35)] sm:p-9">
              <h1 className="mk-display text-3xl font-extrabold tracking-tight text-[#0E1B2C]">{title}</h1>
              {subtitle && <p className="mt-2 text-base leading-relaxed text-[#47566A]">{subtitle}</p>}
              <div className="mt-7">{children}</div>
              {footer && <div className="mt-7 border-t border-[#EEF0F4] pt-5 text-[15px] text-[#47566A] [&_a]:font-semibold [&_a]:text-[#C73E00]-offset-4">{footer}</div>}
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
