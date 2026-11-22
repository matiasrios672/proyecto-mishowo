import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  IconBolt, IconChair, IconChart, IconChat, IconCheck, IconCross, IconDumbbell, IconFood, IconGoogle, IconLink, IconParty, IconQr, IconShirt, IconSparkle, IconStore,
} from "./Doodles";

const wrap = "mx-auto w-full max-w-6xl px-5 sm:px-8";
const at = (i: number) => ({ "--i": i }) as CSSProperties;
const glass = "border border-white/80 bg-white/60 shadow-[0_30px_60px_-30px_rgba(47,111,176,0.4)] backdrop-blur-xl";

/** Luces translúcidas de fondo (reemplazan al sol de la versión anterior). */
export function Glow({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}>
      <div className="mk-blob absolute -left-24 top-10 size-96 rounded-full bg-[#74ACDF]/35 blur-3xl" />
      <div className="mk-blob absolute -right-24 bottom-0 size-[28rem] rounded-full bg-[#2F6FB0]/20 blur-3xl" style={{ animationDelay: "-8s" }} />
    </div>
  );
}

/** Tira de beneficios concretos, justo debajo del hero. */
export function TrustStrip() {
  const items = [
    { I: IconBolt, t: "Lista en minutos", d: "Elegís tu rubro y ya tenés una página armada." },
    { I: IconChat, t: "Pedidos por WhatsApp", d: "Te llegan completos, con total y aclaraciones." },
    { I: IconCheck, t: "Sin comisión por venta", d: "Lo que vendés es tuyo: cobrás como siempre." },
    { I: IconStore, t: "Empezás gratis", d: "Sin tarjeta. Pasás de plan cuando lo necesites." },
  ];
  return (
    <section aria-label="Por qué MiShowo" className="relative bg-[#EAF4FC]">
      <div className={`${wrap} pb-14`}>
        <ul className={`grid gap-px overflow-hidden rounded-3xl bg-white/70 sm:grid-cols-2 lg:grid-cols-4 ${glass}`}>
          {items.map(({ I, t, d }) => (
            <li key={t} className="flex gap-3.5 bg-white/55 p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#2F6FB0]/10 text-[#2F6FB0]"><I className="size-6" /></span>
              <span><span className="block font-extrabold text-[#0E1B2C]">{t}</span><span className="mt-0.5 block text-sm leading-snug text-[#0E1B2C]/70">{d}</span></span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Cinta de rubros: dice "esto es para negocios como el tuyo" sin una sola frase. */
export function RubrosMarquee() {
  const items = [
    { t: "Comidas", I: IconFood }, { t: "Ropa", I: IconShirt }, { t: "Belleza", I: IconSparkle }, { t: "Gimnasios", I: IconDumbbell },
    { t: "Muebles", I: IconChair }, { t: "Fiestas y eventos", I: IconParty }, { t: "Tiendas", I: IconStore },
  ];
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-12 pr-12" aria-hidden={hidden || undefined}>
      {items.map(({ t, I }) => (
        <li key={t} className="flex items-center gap-3 whitespace-nowrap text-[#0E1B2C]/70">
          <I className="size-7 text-[#2F6FB0]" /><span className="mk-display text-xl font-bold">{t}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="Rubros que usan MiShowo" className="mk-marquee overflow-hidden border-y border-[#0E1B2C]/8 bg-white/70 py-5 backdrop-blur">
      <div className="mk-marquee-track flex w-max">{row(false)}{row(true)}</div>
    </section>
  );
}

function Scene({ n, title, text, children }: { n: number; title: string; text: string; children: ReactNode }) {
  return (
    <li className="mk-reveal grid items-center gap-8 md:grid-cols-2 md:gap-16 md:[&:nth-child(even)>div:first-child]:order-2">
      <div className={`relative min-h-72 overflow-hidden rounded-[2rem] p-6 sm:p-8 ${glass}`}>{children}</div>
      <div>
        <p className="mk-display bg-gradient-to-br from-[#74ACDF] to-[#2F6FB0] bg-clip-text text-6xl font-extrabold text-transparent" aria-hidden>{n}</p>
        <h3 className="mk-display mt-2 text-3xl font-extrabold leading-tight text-[#0E1B2C] sm:text-4xl">{title}</h3>
        <p className="mt-3 max-w-[40ch] text-lg leading-relaxed text-[#0E1B2C]/72">{text}</p>
      </div>
    </li>
  );
}

const row = "mk-drop flex items-center gap-3 rounded-2xl border border-[#0E1B2C]/8 bg-white p-3 shadow-sm";

/** Historia en tres escenas. Cada una cobra vida al entrar en pantalla (solo CSS, sin JavaScript). */
export function Story() {
  return (
    <section id="como-funciona" aria-labelledby="story-title" className="scroll-mt-20 relative isolate bg-gradient-to-b from-[#EAF4FC] via-white to-[#EAF4FC] py-20 sm:py-28">
      <Glow />
      <div className={wrap}>
        <h2 id="story-title" className="mk-display max-w-[18ch] text-4xl font-extrabold leading-[1.05] tracking-tight text-[#0E1B2C] sm:text-6xl">Del celular a tus clientes, en tres pasos</h2>
        <ol className="mt-16 space-y-24">
          <Scene n={1} title="Cargás lo que vendés" text="Ponés nombre, foto y precio. Tu catálogo se arma mientras mirás cómo queda en el celular.">
            <ul className="space-y-3">
              {[["Alfajor de maicena", "$ 1.800", "from-[#F3C98B] to-[#E8A55B]"], ["Torta de ricota", "$ 6.500", "from-[#F5A3BC] to-[#E9759B]"], ["Budín de limón", "$ 3.900", "from-[#FBE08A] to-[#F6B40E]"]].map(([n, p, c], i) => (
                <li key={n} className={row} style={at(i)}>
                  <span className={`size-12 rounded-xl bg-gradient-to-br ${c}`} />
                  <span className="flex-1 font-bold text-[#0E1B2C]">{n}</span><span className="font-extrabold text-[#2F6FB0]">{p}</span>
                </li>
              ))}
            </ul>
          </Scene>

          <Scene n={2} title="Compartís tu link" text="Un solo link para tu bio de Instagram, tus historias y tu estado de WhatsApp. O un QR para pegar en tu local.">
            <div className="flex h-full flex-col items-center justify-center gap-5">
              <p className="mk-drop flex items-center gap-2 rounded-full bg-[#2F6FB0] px-5 py-2.5 text-lg font-extrabold text-white shadow-lg" style={at(0)}><IconLink className="size-5" />lupe.mishowo.com</p>
              <svg viewBox="0 0 24 40" aria-hidden className="h-10 w-6 text-[#2F6FB0]"><path className="mk-draw-scroll" pathLength={1} d="M12 2v32M5 28l7 8 7-8" stroke="currentColor" strokeWidth="2.500" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
              <div className="grid w-full max-w-sm gap-3 sm:grid-cols-[1fr_auto]">
                <div className={`${row} flex-col items-start gap-1`} style={at(2)}>
                  <span className="flex items-center gap-2"><span className="size-8 rounded-full bg-gradient-to-br from-[#E9759B] to-[#F6B40E]" /><span className="text-sm font-extrabold text-[#0E1B2C]">@lupe.empanadas</span></span>
                  <span className="text-xs text-[#0E1B2C]/70">Empanadas caseras. Pedí por acá 👇</span>
                  <span className="text-xs font-bold text-[#2F6FB0] underline">lupe.mishowo.com</span>
                </div>
                <div className={`${row} justify-center`} style={at(3)}><IconQr className="size-16 text-[#0E1B2C]" /></div>
              </div>
            </div>
          </Scene>

          <Scene n={3} title="Te piden por WhatsApp" text="Tu cliente arma el pedido en tu página y te llega ordenado: qué quiere, cuánto es y para cuándo.">
            <div className="flex flex-col gap-3 text-sm">
              <p className="mk-drop max-w-[85%] self-start rounded-2xl rounded-bl-md border border-[#0E1B2C]/8 bg-white p-3.5 font-medium text-[#0E1B2C] shadow-sm" style={at(0)}>Hola! Quiero hacer este pedido:<br />• 1 docena de empanadas<br />• 1 flan casero<br /><strong>Total: $ 17.700</strong></p>
              <p className="mk-drop max-w-[85%] self-end rounded-2xl rounded-br-md bg-[#D9F7E4] p-3.5 font-medium text-[#0E1B2C] shadow-sm" style={at(2)}>¡Genial! Te lo preparo para las 21 hs 🙌</p>
              <p className="mk-drop max-w-[85%] self-start rounded-2xl rounded-bl-md border border-[#0E1B2C]/8 bg-white p-3.5 font-medium text-[#0E1B2C] shadow-sm" style={at(4)}>¡Gracias! 😍</p>
            </div>
          </Scene>
        </ol>
      </div>
    </section>
  );
}

/** Antes y después: el problema real de vender solo por chat, dicho sin vueltas. */
export function Compare() {
  const sin = ["Pedidos que se pierden entre mil chats", "Mandar fotos y precios de a uno", "Responder lo mismo todo el día", "Sin saber cuánta gente te mira"];
  const con = ["Un catálogo siempre actualizado, con tu link", "El pedido llega completo, con el total hecho", "Tus clientes eligen solos, a cualquier hora", "Ves visitas, clics y de dónde vienen"];
  return (
    <section aria-labelledby="cmp-title" className="relative isolate bg-white py-20 sm:py-28">
      <div className={wrap}>
        <h2 id="cmp-title" className="mk-display max-w-[22ch] text-4xl font-extrabold leading-tight tracking-tight text-[#0E1B2C] sm:text-5xl">Vender por chat cansa. Tu página trabaja por vos.</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-[#0E1B2C]/10 bg-[#0E1B2C]/[0.03] p-7">
            <p className="mk-display text-xl font-extrabold text-[#0E1B2C]/60">Sin MiShowo</p>
            <ul className="mt-5 space-y-4">
              {sin.map((t) => <li key={t} className="flex gap-3 text-[#0E1B2C]/70"><IconCross className="mt-0.5 size-5 shrink-0 text-rose-500/80" />{t}</li>)}
            </ul>
          </div>
          <div className={`relative rounded-3xl p-7 ${glass} bg-gradient-to-br from-[#74ACDF]/25 to-white/70`}>
            <p className="mk-display text-xl font-extrabold text-[#2F6FB0]">Con MiShowo</p>
            <ul className="mt-5 space-y-4">
              {con.map((t) => <li key={t} className="flex gap-3 font-medium text-[#0E1B2C]"><IconCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />{t}</li>)}
            </ul>
            <Link href="/crear" className="mt-7 inline-flex items-center justify-center rounded-xl bg-[#2F6FB0] px-6 py-3.5 font-bold text-white transition-transform hover:bg-[#2A649F] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Creá tu página gratis</Link>
          </div>
        </div>
        <ul className="mt-10 grid gap-4 sm:grid-cols-3">
          {[{ I: IconChart, t: "Estadísticas propias", d: "Visitas, productos más vistos y clics a WhatsApp." }, { I: IconQr, t: "QR para tu local", d: "Descargalo e imprimilo en un clic." }, { I: IconGoogle, t: "Listo para Google", d: "Título, descripción y datos del negocio para buscadores." }].map(({ I, t, d }) => (
            <li key={t} className="flex gap-3.5 rounded-2xl border border-[#0E1B2C]/8 p-4">
              <I className="size-7 shrink-0 text-[#2F6FB0]" />
              <span><span className="block font-bold text-[#0E1B2C]">{t}</span><span className="text-sm text-[#0E1B2C]/70">{d}</span></span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
