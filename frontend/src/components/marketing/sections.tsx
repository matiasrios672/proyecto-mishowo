import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import type { TemplateInput } from "@/lib/draft";
import { API_URL } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { LiveDemo } from "./LiveDemo";

const SOL = "#F6B40E";
const TINTA = "#0E1B2C";
const wrap = "mx-auto w-full max-w-6xl px-5 sm:px-8";
const ctaSol = "inline-flex items-center justify-center rounded-xl bg-[#F6B40E] px-7 py-4 text-base font-bold text-[#0E1B2C] transition-transform hover:bg-[#FFC21F] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const ctaGhost = "inline-flex items-center justify-center rounded-xl border-2 border-[#0E1B2C] px-7 py-3.5 text-base font-bold text-[#0E1B2C] transition-transform hover:bg-[#0E1B2C] hover:text-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** El sol: símbolo de la marca. Los rayos giran despacio (se quedan quietos con movimiento reducido). */
export function Sun({ className = "", rays = 16 }: { className?: string; rays?: number }) {
  return (
    <svg viewBox="-100 -100 200 200" aria-hidden className={className}>
      <g className="mk-sun-spin" style={{ transformOrigin: "center", transformBox: "fill-box" }}>
        {Array.from({ length: rays }, (_, i) => (
          <path key={i} d={i % 2 ? "M0 -62 L6 -96 L-6 -96Z" : "M0 -62 L4 -84 L-4 -84Z"} fill={SOL} transform={`rotate(${(i * 360) / rays})`} />
        ))}
      </g>
      <circle r="52" fill={SOL} />
    </svg>
  );
}

/** Trae el primer rubro de la demo al atender la visita (no al compilar: el build de Docker no tiene backend). */
async function DemoSlot() {
  await connection();
  let initial: TemplateInput | null = null;
  try {
    const res = await fetch(`${API_URL}/public/templates/rotiseria`);
    if (res.ok) initial = (await res.json()) as TemplateInput;
  } catch { /* la demo lo pide desde el navegador */ }
  return <LiveDemo initial={initial} />;
}

// Mismo alto que la demo real: así no hay saltos de diseño mientras llega.
const DemoSkeleton = () => <div aria-hidden className="h-[640px] rounded-3xl bg-white/50" />;

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-[#EAF4FC]">
      <Sun className="absolute -right-40 -top-32 -z-10 size-[30rem] opacity-90 sm:-right-44 sm:-top-28 sm:size-[40rem]" />
      <div className={`${wrap} pb-8 pt-14 sm:pt-20`}>
        <h1 className="mk-display site-rise text-[clamp(3.1rem,9vw,6.4rem)] font-extrabold leading-[0.95] tracking-tight text-[#0E1B2C]">
          <span className="block">Tu negocio,</span>{" "}
          <span className="block text-primary">en un link.</span>
        </h1>
        <p className="site-rise mt-6 max-w-[36ch] text-xl leading-snug text-[#0E1B2C]/80 sm:text-2xl" style={{ "--d": "120ms" } as React.CSSProperties}>
          Armá la página de tu negocio desde el celular en minutos. Catálogo, pedidos por WhatsApp y un link listo para tu bio de Instagram.
        </p>
        <div className="site-rise mt-9 flex flex-wrap items-center gap-4" style={{ "--d": "240ms" } as React.CSSProperties}>
          <Link href="/crear" className={ctaSol}>Creá tu página gratis</Link>
          <a href="#probalo" className={ctaGhost}>Probalo ahora</a>
          <p className="basis-full text-sm font-medium text-[#0E1B2C]/70 sm:basis-auto">Sin tarjeta. Sin instalar nada.</p>
        </div>
      </div>
      <div id="probalo" className={`${wrap} scroll-mt-20 pb-16 pt-10 sm:pb-24`}>
        <Suspense fallback={<DemoSkeleton />}>
          <DemoSlot />
        </Suspense>
      </div>
    </section>
  );
}

export function VideoSection() {
  return (
    <section aria-labelledby="video-title" className={`${wrap} py-16 sm:py-24`}>
      <h2 id="video-title" className="mk-display max-w-[20ch] text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Mirá cómo se arma en 15 segundos</h2>
      <div className="mt-8 overflow-hidden rounded-3xl bg-[#0E1B2C] shadow-[0_40px_80px_-30px_rgba(14,27,44,0.5)]">
        <video controls preload="none" playsInline poster="/video/poster.jpg" className="aspect-video w-full" aria-label="Video: cómo armar tu página en MiShowo">
          <source src="/video/mishowo-demo.mp4" type="video/mp4" />
          Tu navegador no puede reproducir este video.
        </video>
      </div>
    </section>
  );
}

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const SCHEME = process.env.NEXT_PUBLIC_ROOT_SCHEME ?? "http";
const EXAMPLES = [
  { slug: "lupe-empanadas", name: "Empanadas de Lupe", kind: "Comidas", color: "#AE432A" },
  { slug: "demo-ropa", name: "Luna Indumentaria", kind: "Ropa", color: "#B8335D" },
  { slug: "demo-belleza", name: "Estudio Aura Nails", kind: "Belleza", color: "#B8335D" },
  { slug: "demo-gimnasio", name: "Fuerza Box Club", kind: "Gimnasio", color: "#F5C542" },
  { slug: "demo-muebles", name: "Taller Nogal Muebles", kind: "Muebles", color: "#7A4F24" },
  { slug: "demo-eventos", name: "Fiestas Don Pepe", kind: "Eventos", color: "#8DB2FF" },
];

export function Examples() {
  return (
    <section id="ejemplos" aria-labelledby="ej-title" className="scroll-mt-20 bg-[#0E1B2C] text-white">
      <div className={`${wrap} py-16 sm:py-24`}>
        <h2 id="ej-title" className="mk-display max-w-[22ch] text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Páginas reales, de rubros como el tuyo</h2>
        <p className="mt-4 max-w-[52ch] text-lg text-white/75">Abrilas desde el celular y probá pedir algo: así las van a ver tus clientes.</p>
        <ul className="mt-10 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {EXAMPLES.map((e) => (
            <li key={e.slug} className="border-t border-white/15">
              <a href={`${SCHEME}://${e.slug}.${ROOT}`} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-4 py-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                <span>
                  <span className="mk-display block text-2xl font-bold leading-tight">{e.name}</span>
                  <span className="mt-1 flex items-center gap-2 text-sm text-white/70"><span aria-hidden className="size-2.5 rounded-full" style={{ background: e.color }} />{e.kind}</span>
                </span>
                <span aria-hidden className="text-2xl transition-transform group-hover:translate-x-1">↗</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const BENEFITS = [
  { t: "Pedidos por WhatsApp, ordenados", d: "Tu cliente arma el pedido en tu página y llega a tu WhatsApp con todo escrito: productos, total y aclaraciones. Además, cada pedido queda registrado." },
  { t: "Se ve bien en el celular y en la compu", d: "Tu página se adapta sola a cada pantalla, con animaciones suaves que no pesan. Carga rápido incluso con datos móviles." },
  { t: "Tu estilo, no una plantilla", d: "9 estilos de color, 4 diseños, 4 tipografías y el color de tu marca (lo detectamos desde tu logo). Cambiás todo sin perder nada." },
  { t: "Talles, colores y stock", d: "Variantes por talle y color, precios por opción, precio tachado para ofertas y stock numérico: cuando se acaba, aparece como agotado solo." },
  { t: "Abierto ahora, siempre al día", d: "Cargás tus horarios por día y tu página muestra si estás abierto o cerrado, y cuándo volvés a abrir." },
  { t: "Cargá todo en un minuto", d: "Pegá una lista de productos con sus precios o subí un archivo CSV. Sin cargar de a uno." },
  { t: "Fotos que cargan rápido", d: "Subís tus fotos desde el celular y las achicamos solas para que se vean nítidas sin gastar los datos de tus clientes. También podés sumar un video." },
  { t: "Sabé cuánta gente te mira", d: "Mirá cuántas personas entran, qué productos miran más y cuántas tocan WhatsApp, y de dónde vienen: Instagram, tu QR o un link directo. Sin cookies." },
  { t: "Tu código QR para imprimir", d: "Bajá tu QR en un clic y pegalo en tu local o en los paquetes: quien lo escanea entra directo a tu página, y vos ves cuántos llegaron así." },
  { t: "Aparecé en Google", d: "Tu página sale con título, descripción, fotos y datos del negocio listos para buscadores y para cuando la compartan en redes." },
];

export function Benefits() {
  return (
    <section aria-labelledby="ben-title" className={`${wrap} py-16 sm:py-24`}>
      <h2 id="ben-title" className="mk-display max-w-[20ch] text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Todo lo que necesitás para vender</h2>
      <ul className="mt-12 grid gap-x-14 gap-y-10 md:grid-cols-2">
        {BENEFITS.map((b) => (
          <li key={b.t} className="flex gap-4 border-t border-border pt-6">
            <span aria-hidden className="mt-2 size-3 shrink-0 rounded-full" style={{ background: SOL }} />
            <div>
              <h3 className="mk-display text-2xl font-bold leading-tight">{b.t}</h3>
              <p className="mt-2 max-w-[48ch] leading-relaxed text-muted-foreground">{b.d}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Steps() {
  const steps = [
    { t: "Elegí tu rubro", d: "Arrancás con una página de ejemplo hecha para negocios como el tuyo." },
    { t: "Personalizala", d: "Cambiás textos, productos, colores y fotos. Ves el resultado en vivo mientras editás." },
    { t: "Compartí tu link", d: "Publicás y ponés tu link en la bio de Instagram, en WhatsApp y en tus bolsas." },
  ];
  return (
    <section id="como-funciona" aria-labelledby="steps-title" className="scroll-mt-20 bg-[#EAF4FC]">
      <div className={`${wrap} py-16 sm:py-24`}>
        <h2 id="steps-title" className="mk-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Cómo funciona</h2>
        <ol className="mt-12 grid gap-10 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.t} className="flex gap-5">
              <span aria-hidden className="mk-display text-7xl font-extrabold leading-none text-primary/35">{i + 1}</span>
              <div>
                <h3 className="mk-display text-2xl font-bold">{s.t}</h3>
                <p className="mt-2 text-muted-foreground">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

interface Plan { id: string; name: string; priceMonthly: number; limits: { products?: number | null; photosPerProduct?: number }; features: string[] }

async function PlansList() {
  await connection(); // los precios los edita el admin: se piden al atender la visita, no al compilar
  let plans: Plan[] = [];
  try {
    const res = await fetch(`${API_URL}/public/plans`);
    if (res.ok) plans = (await res.json()) as Plan[];
  } catch { /* se muestra el mensaje de abajo */ }

  if (plans.length === 0)
    return <p className="mt-10 text-lg text-muted-foreground">Escribinos y te contamos los planes. Podés empezar gratis ahora mismo.</p>;

  return (
    <ul className="mt-12 grid gap-6 md:grid-cols-3">
      {plans.map((p) => (
        <li key={p.id} className="flex flex-col rounded-3xl border-2 border-border bg-white p-7">
          <h3 className="mk-display text-2xl font-bold">{p.name}</h3>
          <p className="mk-display mt-3 text-4xl font-extrabold tracking-tight">
            {formatPrice(p.priceMonthly) || "$ 0"}<span className="text-base font-semibold text-muted-foreground"> /mes</span>
          </p>
          <ul className="mt-6 flex-1 space-y-2.5 text-[0.95rem]">
            <li className="flex gap-2.5"><Check />{p.limits.products ? `Hasta ${p.limits.products} productos` : "Productos ilimitados"}</li>
            {p.features.map((f) => <li key={f} className="flex gap-2.5"><Check />{f}</li>)}
          </ul>
          <Link href={p.priceMonthly === 0 ? "/crear" : `/registro?next=${encodeURIComponent("/planes")}`} className={`mt-8 ${p.priceMonthly === 0 ? ctaSol : ctaGhost}`}>
            {p.priceMonthly === 0 ? "Empezar gratis" : `Elegir ${p.name}`}
          </Link>
        </li>
      ))}
    </ul>
  );
}

const Check = () => (
  <svg viewBox="0 0 20 20" aria-hidden className="mt-0.5 size-5 shrink-0 text-primary"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export function Plans({ fallback }: { fallback: React.ReactNode }) {
  return (
    <section id="planes" aria-labelledby="plans-title" className={`${wrap} scroll-mt-20 py-16 sm:py-24`}>
      <h2 id="plans-title" className="mk-display max-w-[22ch] text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Empezá gratis, crecé cuando lo necesites</h2>
      <p className="mt-4 max-w-[52ch] text-lg text-muted-foreground">Tu página que vende y crece con vos. Pagás con transferencia y cambiás de plan cuando quieras.</p>
      {fallback}
    </section>
  );
}
export { PlansList };

const QUOTES = [
  { q: "Antes me escribían por Instagram y se me perdían los pedidos. Ahora llegan ordenados y sé qué preparar.", who: "Dueña de una rotisería" },
  { q: "Armé la página desde el celular mientras esperaba un cliente. Esa misma tarde ya la estaba compartiendo.", who: "Vendedora de ropa" },
  { q: "Mis alumnos ven los planes y los horarios sin preguntarme nada. Me ahorra un montón de mensajes.", who: "Profe de entrenamiento" },
];

export function Testimonials() {
  return (
    <section aria-labelledby="test-title" className="bg-[#EAF4FC]">
      <div className={`${wrap} py-16 sm:py-24`}>
        <h2 id="test-title" className="mk-display max-w-[22ch] text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Lo que cuentan quienes ya venden con su link</h2>
        <p className="mt-3 text-sm font-medium text-muted-foreground">Testimonios de ejemplo: los vamos a reemplazar por los de clientes reales.</p>
        <ul className="mt-10 grid gap-10 md:grid-cols-3">
          {QUOTES.map((x) => (
            <li key={x.who}>
              <blockquote className="mk-display text-2xl font-semibold leading-snug">“{x.q}”</blockquote>
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                {x.who}
                <span className="rounded-full border border-dashed border-muted-foreground/60 px-2 py-0.5 text-xs">Ejemplo</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export const FAQ = [
  { q: "¿Cuánto cuesta?", a: "Podés empezar gratis, sin tarjeta. Si tu negocio crece, hay planes con más productos y herramientas. Los precios están en esta página, siempre actualizados." },
  { q: "¿Necesito saber de tecnología?", a: "No. Elegís un rubro, cambiás lo que quieras y ves el resultado en vivo. Si sabés usar WhatsApp, sabés usar MiShowo." },
  { q: "¿Cómo me llegan los pedidos?", a: "Por WhatsApp, con el pedido armado: productos, cantidades, total y aclaraciones. Además queda registrado en tu panel." },
  { q: "¿Cómo cobro?", a: "El pago lo coordinás directamente con tu cliente (transferencia, efectivo, como prefieras). MiShowo no cobra comisión por tus ventas." },
  { q: "¿Puedo usar mi propio dominio?", a: "Cada negocio tiene su link tunegocio.mishowo.com. Los dominios propios van a estar disponibles más adelante." },
  { q: "¿Qué pasa con los datos de mis clientes?", a: "Son tuyos. Los tratamos según la Ley 25.326 de Protección de Datos Personales y podés pedirnos acceso o eliminación cuando quieras." },
  { q: "¿Puedo cancelar cuando quiera?", a: "Sí. Si cancelás un plan pago, tu página sigue activa hasta que termine el período y después pasa al plan gratuito." },
];

export function FaqSection() {
  return (
    <section id="preguntas" aria-labelledby="faq-title" className={`${wrap} scroll-mt-20 py-16 sm:py-24`}>
      <h2 id="faq-title" className="mk-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Preguntas frecuentes</h2>
      <div className="mt-10 max-w-3xl divide-y divide-border border-y border-border">
        {FAQ.map((f) => (
          <details key={f.q} className="group py-5">
            <summary className="mk-display flex cursor-pointer list-none items-center justify-between gap-4 text-xl font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              {f.q}
              <span aria-hidden className="text-2xl font-normal transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 max-w-[60ch] leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function Soon() {
  const items = ["Crear tu página contándonos tu idea", "Armar el catálogo a partir de fotos", "Generador de posteos para Instagram", "Mejorar las fotos de tus productos", "Cobros online y envíos"];
  return (
    <section aria-labelledby="soon-title" className="border-y border-border bg-muted/50">
      <div className={`${wrap} py-14 sm:py-20`}>
        <h2 id="soon-title" className="mk-display text-3xl font-extrabold tracking-tight sm:text-4xl">Próximamente</h2>
        <ul className="mt-6 flex flex-wrap gap-3">
          {items.map((i) => (
            <li key={i} className="rounded-full border border-border bg-white px-4 py-2 text-sm font-medium">{i}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="final-title" className="relative isolate overflow-hidden bg-[#0E1B2C] text-white">
      {/* El sol va a un costado: el texto blanco nunca queda sobre el amarillo. */}
      <Sun className="absolute -bottom-44 -right-40 -z-10 size-[30rem] opacity-95 sm:-right-24 sm:size-[38rem]" />
      <div className={`${wrap} py-24 sm:py-32`}>
        <h2 id="final-title" className="mk-display max-w-[12ch] text-5xl font-extrabold leading-[0.98] tracking-tight sm:text-7xl">Creá tu página gratis</h2>
        <p className="mt-5 max-w-[34ch] text-xl text-white/80">En unos minutos tenés tu link listo para compartir.</p>
        <Link href="/crear" className={`${ctaSol} mt-9`}>Empezar ahora</Link>
      </div>
    </section>
  );
}

export { TINTA };
