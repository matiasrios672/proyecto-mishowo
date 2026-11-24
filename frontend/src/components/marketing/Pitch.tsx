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
        <h2 id="contrast-title" data-fx="up" className="mk-display max-w-[20ch] text-4xl font-extrabold leading-[1.05] tracking-tight text-[#0E1B2C] sm:text-6xl">
          Dejá de contestar lo mismo cuarenta veces por día.
        </h2>
        <p data-fx="up" style={{ "--fx-d": "100ms" } as React.CSSProperties} className="mt-5 max-w-[54ch] text-lg leading-relaxed text-[#0E1B2C]/70 sm:text-xl">
          Tus clientes preguntan precios, fotos y horarios por mensaje, y vos perdés ventas entre un chat y otro. Con tu página, todo eso ya está respondido antes de que escriban.
        </p>

        <div className="mt-14 grid gap-6 lg:grid-cols-2 lg:gap-8">
          <div data-fx="left" className="flex flex-col rounded-[2rem] bg-[#F3F1EE] p-6 sm:p-9">
            <h3 className="mk-display text-3xl font-extrabold tracking-tight text-[#0E1B2C]">Sin MiShowo</h3>
            <ul className="mt-6 space-y-2.5" aria-label="Ejemplo de chat con un cliente" data-fx-stagger>
              {CHAT.map((m, i) => (
                <li key={i} data-fx="up" className={`flex ${m.me ? "justify-end" : ""}`}>
                  <span className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-[15px] leading-snug ${m.me ? "rounded-br-md bg-[#DCF8C6] text-[#0E1B2C]" : "rounded-bl-md bg-white text-[#0E1B2C] shadow-sm"}`}>{m.t}</span>
                </li>
              ))}
            </ul>
            <ul className="mt-8 space-y-3.5 border-t border-[#0E1B2C]/12 pt-7 text-[17px] leading-snug text-[#0E1B2C]" data-fx-stagger>
              {SIN.map((t) => <li key={t} data-fx="up" className="flex gap-3"><Cross />{t}</li>)}
            </ul>
          </div>

          <div data-fx="right" className="relative flex flex-col overflow-hidden rounded-[2rem] bg-[#0E1B2C] p-6 text-white sm:p-9">
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
            <ul className="relative mt-8 space-y-3.5 border-t border-white/15 pt-7 text-[17px] leading-snug" data-fx-stagger>
              {CON.map((t) => <li key={t} data-fx="up" className="flex gap-3"><Tick />{t}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

const LIVE = [
  ["Pedidos por WhatsApp", "con carrito, total armado y sin comisión por venta"],
  ["Turnos y reservas", "con agenda, profesionales y recordatorio por mail"],
  ["Cupones y cuotas a la vista", "descuentos propios y «6 cuotas sin interés» bajo cada precio"],
  ["Reseñas de clientes", "que se muestran en tu página una vez aprobadas"],
  ["Estadísticas sin cookies", "visitas, productos más vistos y de dónde llegan"],
  ["QR para imprimir y varias páginas", "un mismo acceso para todos tus negocios"],
];
const SOON = [
  ["Cobro online con Mercado Pago", "para que tu cliente pague sin salir de tu página"],
  ["Cálculo de envíos", "costo según zona, calculado en el pedido"],
  ["Asistente con IA", "para redactar descripciones y armar tu catálogo más rápido"],
];

/** Lo que MiShowo ya hace y lo que viene, dicho con sobriedad. Muestra que el producto sigue creciendo con lo que piden los clientes. */
export function Improving() {
  return (
    <section aria-labelledby="improving-title" className="bg-[#FFF7F1]">
      <div className={`${wrap} py-20 sm:py-28`}>
        <h2 id="improving-title" data-fx="up" className="mk-display max-w-[20ch] text-4xl font-extrabold leading-[1.05] tracking-tight text-[#0E1B2C] sm:text-6xl">Un producto que sigue creciendo con vos.</h2>
        <p data-fx="up" style={{ "--fx-d": "100ms" } as React.CSSProperties} className="mt-5 max-w-[56ch] text-lg leading-relaxed text-[#0E1B2C]/75 sm:text-xl">
          Trabajamos todos los días para que tu página venda más y te dé menos trabajo. Lo que sumamos sale de lo que nos piden los negocios que ya la usan.
        </p>
        <div className="mt-14 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
          <div data-fx="left">
            <h3 className="mk-display text-2xl font-extrabold text-[#0E1B2C]">Ya disponible</h3>
            <ul className="mt-5 divide-y divide-[#0E1B2C]/12 border-t border-[#0E1B2C]/12">
              {LIVE.map(([t, d]) => (
                <li key={t} className="grid gap-1 py-4 sm:grid-cols-[1fr_1.3fr] sm:gap-6">
                  <p className="font-bold text-[#0E1B2C]">{t}</p>
                  <p className="text-[#0E1B2C]/75">{d}</p>
                </li>
              ))}
            </ul>
          </div>
          <div data-fx="right">
            <h3 className="mk-display text-2xl font-extrabold text-[#0E1B2C]">En camino</h3>
            <ul className="mt-5 divide-y divide-[#0E1B2C]/12 border-t border-[#0E1B2C]/12">
              {SOON.map(([t, d]) => (
                <li key={t} className="py-4">
                  <p className="font-bold text-[#0E1B2C]">{t}</p>
                  <p className="mt-1 text-[#0E1B2C]/75">{d}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[#0E1B2C]/80">¿Te falta algo para tu negocio? <a href="/contacto" className="font-bold text-[#C73E00] underline underline-offset-4">Contanos</a> y lo sumamos a la lista.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
