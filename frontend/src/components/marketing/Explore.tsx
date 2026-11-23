import Link from "next/link";
import { IconCalendar, IconChart, IconChat, IconCheck, IconTag } from "./Doodles";

export const EXPLORE = [
  { href: "/como-funciona", title: "Cómo funciona", line: "De la idea a tu link en tres pasos, desde el celular.", Icon: IconCheck },
  { href: "/rubros", title: "Para tu rubro", line: "Ropa, comidas, bares, eventos y más: mirá cómo queda la tuya.", Icon: IconTag },
  { href: "/cuotas", title: "Cuotas sin interés", line: "Mostrá «6 cuotas de $X» en cada precio y vendé más.", Icon: IconCalendar, badge: "Nuevo" },
  { href: "/funciones", title: "Todo lo que incluye", line: "Pedidos, estadísticas, QR, Google y mucho más.", Icon: IconChart },
  { href: "/precios", title: "Precios y preguntas", line: "Empezá gratis y crecé cuando lo necesites.", Icon: IconChat },
] as const;

/** Menú de la home: en vez de volcar todo en una página larga, la persona elige qué quiere ver. */
export function ExploreGrid() {
  return (
    <section id="explorar" aria-labelledby="explorar-title" className="bg-[#F4F9FE] py-16 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <h2 id="explorar-title" className="mk-display max-w-[18ch] text-4xl font-extrabold leading-[1.04] tracking-tight text-[#0E1B2C] sm:text-5xl">¿Qué querés ver?</h2>
        <p className="mt-4 max-w-[48ch] text-lg text-[#47566A]">Elegí por dónde empezar. Cada tema tiene su propia página, corta y al grano.</p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXPLORE.map(({ href, title, line, Icon, ...rest }) => (
            <li key={href}>
              <Link href={href} className="group flex h-full flex-col rounded-[1.75rem] border border-[#0E1B2C]/8 bg-white p-6 shadow-[0_1px_0_rgba(14,27,44,0.04),0_30px_60px_-40px_rgba(47,111,176,0.5)] transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                <span className="flex items-center justify-between">
                  <span aria-hidden className="grid size-12 place-items-center rounded-2xl bg-[#2F6FB0]/10 text-[#2F6FB0]"><Icon className="size-6" /></span>
                  {"badge" in rest && <span className="rounded-full bg-[#F6B40E] px-3 py-1 text-xs font-extrabold text-[#0E1B2C]">{rest.badge}</span>}
                </span>
                <span className="mk-display mt-5 block text-2xl font-extrabold leading-tight text-[#0E1B2C]">{title}</span>
                <span className="mt-1.5 block flex-1 text-[15px] text-[#47566A]">{line}</span>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[#2F6FB0]">Ver más <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span></span>
              </Link>
            </li>
          ))}
          <li className="sm:col-span-2 lg:col-span-1">
            <Link href="/crear" className="flex h-full min-h-40 flex-col justify-center rounded-[1.75rem] bg-[#0E1B2C] p-6 text-white transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              <span className="mk-display text-2xl font-extrabold leading-tight">¿Ya lo tenés claro?</span>
              <span className="mt-1.5 text-[15px] text-white/80">Creá tu página gratis en 5 minutos.</span>
              <span className="mt-4 inline-flex w-fit rounded-xl bg-[#F6B40E] px-5 py-2.5 text-sm font-bold text-[#0E1B2C]">Empezar ahora</span>
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
