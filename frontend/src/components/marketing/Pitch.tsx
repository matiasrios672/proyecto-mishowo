import Link from "next/link";

const wrap = "mx-auto w-full max-w-6xl px-5 sm:px-8";

const CHAT = [
  { me: false, t: "Hola! tenés carta?" },
  { me: true, t: "Sí, te la paso" },
  { me: false, t: "cuánto sale la docena?" },
  { me: false, t: "hacen envíos? hasta qué hora?" },
  { me: false, t: "me pasás foto de la torta de ricota?" },
];

const TICKET = [["1 x Torta de ricota", "$ 18.500"], ["2 x Alfajor de maicena", "$ 3.600"], ["1 x Café con leche", "$ 2.900"]];

const SIN = [
  "Mandás la carta y los precios por chat, y quedan viejos",
  "Contestás «¿están abiertos?» una y otra vez",
  "Anotás los pedidos a mano, entre mensajes",
  "Explicás las cuotas cliente por cliente",
  "No sabés cuánta gente te mira ni qué elige",
];
const CON = [
  "Una página siempre al día, con fotos y precios",
  "Muestra sola si estás abierto y cuándo volvés",
  "Cada pedido llega armado, con total y sin comisión",
  "«6 cuotas sin interés» a la vista bajo cada precio",
  "Ves visitas, productos más vistos y de dónde vienen",
];

const Cross = () => (
  <svg viewBox="0 0 20 20" aria-hidden className="mt-0.5 size-5 shrink-0 text-[#0E1B2C]/45"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
);
const Tick = () => (
  <svg viewBox="0 0 20 20" aria-hidden className="mt-0.5 size-5 shrink-0 text-[#FF9A5C]"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/** «Sin MiShowo» y «Con MiShowo», lado a lado: lo que pasa hoy en el chat, el pedido que llega armado y las ventajas punto por punto. */
export function Contrast() {
  return (
    <section aria-labelledby="contrast-title" className="bg-white">
      <div className={`${wrap} py-20 sm:py-28`}>
        <h2 id="contrast-title" className="mk-display max-w-[20ch] text-4xl font-extrabold leading-[1.05] tracking-tight text-[#0E1B2C] sm:text-6xl">
          Dejá de contestar lo mismo cuarenta veces por día.
        </h2>
        <p className="mt-5 max-w-[54ch] text-lg leading-relaxed text-[#0E1B2C]/70 sm:text-xl">
          Tus clientes preguntan precios, fotos y horarios por mensaje, y vos perdés ventas entre un chat y otro. Con tu página, todo eso ya está respondido antes de que escriban.
        </p>

        <div className="mt-14 grid gap-6 lg:grid-cols-2 lg:gap-8">
          <div className="flex flex-col rounded-[2rem] bg-[#F3F1EE] p-6 sm:p-9">
            <h3 className="mk-display text-3xl font-extrabold tracking-tight text-[#0E1B2C]">Sin MiShowo</h3>
            <ul className="mt-6 space-y-2.5" aria-label="Ejemplo de chat con un cliente">
              {CHAT.map((m, i) => (
                <li key={i} className={`flex ${m.me ? "justify-end" : ""}`}>
                  <span className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-[15px] leading-snug ${m.me ? "rounded-br-md bg-[#DCF8C6] text-[#0E1B2C]" : "rounded-bl-md bg-white text-[#0E1B2C] shadow-sm"}`}>{m.t}</span>
                </li>
              ))}
            </ul>
            <ul className="mt-8 space-y-3.5 border-t border-[#0E1B2C]/12 pt-7 text-[17px] leading-snug text-[#0E1B2C]">
              {SIN.map((t) => <li key={t} className="flex gap-3"><Cross />{t}</li>)}
            </ul>
          </div>

          <div className="relative flex flex-col overflow-hidden rounded-[2rem] bg-[#0E1B2C] p-6 text-white sm:p-9">
            <div aria-hidden className="mk-orb pointer-events-none absolute -right-24 -top-24 size-80 rounded-full" style={{ "--orb": "rgb(252 85 2 / 0.38)" } as React.CSSProperties} />
            <h3 className="mk-display relative text-3xl font-extrabold tracking-tight">Con MiShowo</h3>
            <div className="relative mt-6 rounded-2xl bg-white p-5 text-[#0E1B2C] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)]">
              <div className="flex items-baseline justify-between">
                <p className="mk-display text-lg font-extrabold">Pedido nuevo #37</p>
                <p className="text-xs font-semibold text-[#15803D]">Llegó por WhatsApp</p>
              </div>
              <ul className="mt-4 divide-y divide-[#0E1B2C]/10 text-[15px]">
                {TICKET.map(([n, p]) => <li key={n} className="flex justify-between gap-4 py-2.5"><span>{n}</span><span className="font-semibold tabular-nums">{p}</span></li>)}
              </ul>
              <p className="mt-3 flex justify-between border-t-2 border-[#0E1B2C] pt-3 text-lg font-extrabold"><span>Total</span><span className="tabular-nums">$ 25.000</span></p>
              <p className="mt-3 text-sm text-[#0E1B2C]/70">Retira en el local, hoy 18 hs. Cliente: Sofi.</p>
            </div>
            <ul className="relative mt-8 space-y-3.5 border-t border-white/15 pt-7 text-[17px] leading-snug">
              {CON.map((t) => <li key={t} className="flex gap-3"><Tick />{t}</li>)}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link href="/crear" className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-b from-[#D14300] to-[#B83700] px-8 py-4 text-base font-bold text-white shadow-[0_14px_30px_-12px_rgba(184,55,0,0.7),inset_0_1px_0_rgba(255,255,255,0.3)] transition hover:-translate-y-0.5 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Armá la tuya gratis</Link>
          <p className="text-base font-medium text-[#0E1B2C]/70">Sin tarjeta, sin comisión por venta y la cancelás cuando quieras.</p>
        </div>
      </div>
    </section>
  );
}
