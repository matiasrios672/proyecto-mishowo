import Link from "next/link";
import { StepsCycler } from "./StepsCycler";
import { Spotlight } from "./Spotlight";
import { IconChart, IconCheck, IconGoogle, IconQr, IconTag, IconCalendar } from "./Doodles";

const wrap = "mx-auto w-full max-w-6xl px-5 sm:px-8";

/** Cómo funciona, en tres pasos: una vista que cambia sola (sin librerías de animación, así no traba el scroll). */
export function ExplainerSection() {
  return (
    <section id="como-funciona" aria-labelledby="story-title" className="scroll-mt-20 overflow-hidden bg-[#0E1B2C] py-14 text-white sm:py-20">
      <div className={wrap}>
        <h2 id="story-title" className="mk-display max-w-[16ch] text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">Del celular a tus clientes, en tres pasos</h2>
        <StepsCycler />
        <Link href="/crear" className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-[#FC5502] px-7 font-bold text-[#0E1B2C] transition-transform hover:bg-[#FF6A1F] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Creá tu página gratis</Link>
      </div>
    </section>
  );
}

const tile = "group rounded-[1.75rem] border border-[#0E1B2C]/8 bg-white p-6 shadow-[0_1px_0_rgba(14,27,44,0.04),0_30px_60px_-40px_rgba(252,85,2,0.5)] transition-transform duration-300 hover:-translate-y-1 sm:p-7";

function Tile({ title, line, className = "", children }: { title: string; line: string; className?: string; children?: React.ReactNode }) {
  return (
    <Spotlight className={`${tile} ${className}`}>
      <div className="relative z-10 flex h-full flex-col">
        <div className="min-h-0 flex-1">{children}</div>
        <h3 className="mk-display mt-5 text-2xl font-extrabold leading-tight text-[#0E1B2C]">{title}</h3>
        <p className="mt-1 text-[15px] text-[#47566A]">{line}</p>
      </div>
    </Spotlight>
  );
}

/** Beneficios en formato bento: una imagen y una línea por cada uno, en vez de párrafos. */
export function Bento() {
  return (
    <section aria-labelledby="ben-title" className="bg-[#FFF7F1] py-14 sm:py-20">
      <div className={wrap}>
        <h2 id="ben-title" className="mk-display max-w-[18ch] text-4xl font-extrabold leading-[1.04] tracking-tight text-[#0E1B2C] sm:text-6xl">Todo lo que necesitás para vender</h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-[repeat(2,minmax(15rem,auto))]">
          <Tile className="sm:col-span-2 lg:row-span-2" title="Pedidos ordenados" line="Con productos, total y fecha. Listos para responder.">
            <div className="flex h-full min-h-56 flex-col justify-end gap-3 rounded-2xl bg-[#FFEFE6] p-4">
              <div className="mb-auto flex w-fit items-center gap-2.5 rounded-2xl bg-[#0E1B2C] px-4 py-3 text-sm font-semibold text-white shadow-lg"><span className="size-2.5 animate-pulse rounded-full bg-[#4ADE80]" />¡Pedido nuevo #12! · $ 17.700</div>
              <p className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-white p-3.5 text-sm font-medium text-[#0E1B2C] shadow-sm">Hola! Quiero hacer este pedido:<br />• 1 docena de empanadas<br />• 1 flan casero<br /><b>Total: $ 17.700</b></p>
              <p className="max-w-[80%] self-end rounded-2xl rounded-br-md bg-[#D9F7E4] p-3.5 text-sm font-medium text-[#0E1B2C] shadow-sm" style={{ animationDelay: "0.25s" }}>¡Genial! Te lo preparo para las 21 hs 🙌</p>
            </div>
          </Tile>
          <Tile title="Estadísticas" line="Visitas y clics, sin cookies.">
            <div aria-hidden className="flex h-24 items-end gap-1.5">
              {[30, 44, 36, 58, 52, 74, 66, 92].map((h, i) => <span key={i} className="mk-bar flex-1 rounded-t-md bg-gradient-to-t from-[#C73E00] to-[#FF8A4C]" style={{ height: `${h}%`, animationDelay: `${i * 70}ms` }} />)}
            </div>
            <IconChart className="sr-only" />
          </Tile>
          <Tile title="Tu QR" line="Descargalo e imprimilo.">
            <IconQr className="size-24 text-[#0E1B2C]" />
          </Tile>
          <Tile title="Cupones y turnos" line="Descuentos y reservas, sin apps extra.">
            <div className="flex flex-wrap gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#C73E00]/10 px-3.5 py-2 font-bold text-[#C73E00]"><IconTag className="size-5" />BIENVENIDA15</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#C73E00]/10 px-3.5 py-2 font-bold text-[#C73E00]"><IconCalendar className="size-5" />Sáb 17:30</span>
            </div>
          </Tile>
          <Tile title="Aparecés en Google" line="Con título, datos y fotos.">
            <div aria-hidden className="rounded-xl border border-[#0E1B2C]/10 p-3">
              <div className="flex items-center gap-2 text-xs text-[#47566A]"><IconGoogle className="size-4" />empanadas lupe</div>
              <p className="mt-2 text-sm font-bold text-[#C73E00]">Empanadas de Lupe</p>
              <p className="text-xs text-[#47566A]">lupe.mishowo.com</p>
            </div>
          </Tile>
        </div>
      </div>
    </section>
  );
}

const CARTA: { s: string; items: [string, string][] }[] = [
  { s: "Para picar", items: [["Picada para dos", "$ 14.800"], ["Rabas con alioli", "$ 11.500"], ["Provoleta a la parrilla", "$ 7.900"]] },
  { s: "Platos", items: [["Milanesa napolitana con papas", "$ 13.900"], ["Hamburguesa de la esquina", "$ 12.400"]] },
  { s: "Bebidas", items: [["Cerveza tirada · pinta", "$ 4.800"], ["Fernet con cola", "$ 5.600"]] },
];

/** Oferta específica para bares, restaurantes y cafeterías: la carta digital con QR en la mesa. */
export function BarsSection() {
  return (
    <section id="bares" aria-labelledby="bares-title" className="relative isolate overflow-hidden bg-[#F6EFE6] py-14 sm:py-20">
      <div className={`${wrap} grid items-center gap-12 lg:grid-cols-[1fr_1.05fr]`}>
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#0E1B2C] px-4 py-1.5 text-sm font-bold text-white"><IconQr className="size-4" />Para bares, cafés y restaurantes</p>
          <h2 id="bares-title" className="mk-display max-w-[14ch] text-4xl font-extrabold leading-[1.02] tracking-tight text-[#0E1B2C] sm:text-6xl">Tu carta, en el celular de cada mesa</h2>
          <p className="mt-5 max-w-[46ch] text-lg text-[#0E1B2C]/75">Diseño de carta de bar, con puntos guía hasta el precio. Cambiás un precio o marcás un plato agotado desde el celular y se actualiza al instante. Sin reimprimir nada.</p>
          <ul className="mt-6 space-y-3 text-[#0E1B2C]">
            {["Cartel con QR listo para imprimir y pegar en la mesa", "Pedidos para llevar por WhatsApp, si querés", "Platos agotados y precios al día en segundos", "Categorías, opciones (pinta o jarra) y fotos de tus platos"].map((t) => (
              <li key={t} className="flex gap-3"><IconCheck className="mt-0.5 size-5 shrink-0 text-[#15803D]" /><span>{t}</span></li>
            ))}
          </ul>
          <Link href="/crear" className="mt-8 inline-flex items-center justify-center rounded-xl bg-[#0E1B2C] px-7 py-4 text-base font-bold text-white transition-transform hover:bg-[#1a2d47] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Armá tu carta gratis</Link>
        </div>

        <div className="relative mx-auto w-full max-w-md" aria-hidden>
          <div className="mx-auto w-[17.5rem] rounded-[2.4rem] border-[10px] border-[#0E1B2C] bg-[#FFFBF5] p-4 shadow-[0_50px_90px_-40px_rgba(14,27,44,0.7)] sm:w-[19rem]">
            <div className="mx-auto mb-3 h-4 w-16 rounded-full bg-[#0E1B2C]" />
            <p className="text-center font-serif text-xl font-bold text-[#7A2E1C]">Bar La Esquina</p>
            <p className="mb-3 text-center text-[11px] text-[#7A2E1C]/70">Cocina de bodegón · cerveza tirada</p>
            {CARTA.map((c) => (
              <div key={c.s} className="mb-3">
                <p className="border-b-2 border-[#7A2E1C]/80 pb-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#7A2E1C]">{c.s}</p>
                <ul>
                  {c.items.map(([n, p]) => (
                    <li key={n} className="flex items-baseline gap-1.5 border-b border-[#7A2E1C]/10 py-1.5 text-[12px] text-[#2a1710]">
                      <span className="font-medium">{n}</span><span className="mb-0.5 flex-1 border-b border-dotted border-[#7A2E1C]/40" /><span className="font-bold">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="absolute -bottom-6 -right-2 w-36 -rotate-6 rounded-2xl bg-white p-3 text-center shadow-[0_30px_50px_-25px_rgba(14,27,44,0.6)] sm:-right-8 sm:w-40">
            <div className="mx-auto grid size-20 place-items-center rounded-lg bg-[#0E1B2C]/95 p-1.5 sm:size-24">
              <div className="grid size-full grid-cols-7 gap-px">{Array.from({ length: 49 }, (_, i) => <span key={i} className={((i * 5 + (i % 7) * 3) % 3 !== 0 || [0, 1, 7, 6, 8, 40, 41, 48, 42, 47].includes(i)) ? "bg-white" : "bg-transparent"} />)}</div>
            </div>
            <p className="mt-2 text-[11px] font-extrabold leading-tight text-[#0E1B2C]">Mesa 7<br /><span className="font-semibold text-[#C73E00]">Escaneá y mirá la carta</span></p>
          </div>
        </div>
      </div>
    </section>
  );
}
