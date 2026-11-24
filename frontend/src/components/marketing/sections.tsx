import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import type { TemplateInput } from "@/lib/draft";
import { API_URL } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { LiveDemo } from "./LiveDemo";
import { FaqItems } from "./FaqItems";
import { HeroStage } from "./HeroStage";
import { Glow } from "./Story";
import { DEFAULT_FAQ, type FaqItem } from "@/content/faq";
import { getSiteConfig } from "@/lib/siteConfig";
import { SLOGAN } from "@/content/brand";

const SOL = "#F6B40E";
const TINTA = "#0E1B2C";
const wrap = "mx-auto w-full max-w-6xl px-5 sm:px-8";
const ctaSol = "inline-flex items-center justify-center rounded-2xl bg-gradient-to-b from-[#D14300] to-[#B83700] px-7 py-4 text-base font-bold text-white shadow-[0_14px_30px_-12px_rgba(184,55,0,0.7),inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_36px_-12px_rgba(252,85,2,0.85),inset_0_1px_0_rgba(255,255,255,0.35)] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const ctaGhost = "inline-flex items-center justify-center rounded-2xl border border-[#0E1B2C]/15 bg-white/70 px-7 py-4 text-base font-bold text-[#0E1B2C] shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-[#0E1B2C] hover:bg-[#0E1B2C] hover:text-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

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
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-[#FFE2D0] to-[#FFEFE6]">
      <Glow />
      <div aria-hidden className="mk-grid pointer-events-none absolute inset-0 -z-10" />
      <div className={`${wrap} grid items-center gap-4 pb-10 pt-12 lg:grid-cols-[1fr_1.1fr] lg:gap-12 lg:pb-16 lg:pt-16`}>
        <div>
          <h1 className="mk-display site-rise text-[clamp(3rem,7.4vw,5.6rem)] font-extrabold leading-[0.92] tracking-tight text-[#0E1B2C]">
            <span className="block">{SLOGAN.line1}</span>{" "}
            <span className="relative block w-fit bg-gradient-to-r from-[#E24E00] to-[#C73E00] bg-clip-text text-transparent">{SLOGAN.line2}</span>
          </h1>
          <p className="site-rise mt-8 max-w-[34ch] text-xl leading-snug text-[#0E1B2C]/80 sm:text-2xl" style={{ "--d": "120ms" } as React.CSSProperties}>
            {SLOGAN.sub}
          </p>
          <div className="site-rise mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4" style={{ "--d": "240ms" } as React.CSSProperties}>
            <Link href="/crear" className={`${ctaSol} w-full sm:w-auto`}>Creá tu página gratis</Link>
            <a href="#elegi-tu-rubro" className={`${ctaGhost} w-full sm:w-auto`}>Ver ejemplos</a>
            <p className="basis-full text-sm font-medium text-[#0E1B2C]/70">Gratis para empezar, listo en 5 minutos. Sin instalar nada.</p>
          </div>
        </div>
        <div className="mk-parallax"><HeroStage /></div>
      </div>
    </section>
  );
}

export function DemoSection() {
  return (
    <section id="probalo" aria-labelledby="demo-title" className="scroll-mt-16 bg-[#FFEFE6]">
      <div className={`${wrap} pb-16 pt-6 sm:pb-24`}>
        <h2 id="demo-title" className="mk-display mb-8 max-w-[20ch] text-4xl font-extrabold leading-tight tracking-tight text-[#0E1B2C] sm:text-5xl">Probalo vos mismo, ahora</h2>
        <Suspense fallback={<DemoSkeleton />}>
          <DemoSlot />
        </Suspense>
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
  { slug: "demo-eventos", name: "Fiestas Don Pepe", kind: "Eventos", color: "#FF9B63" },
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
  { t: "Pedidos por WhatsApp, si querés", d: "Elegís si tu página recibe pedidos o solo muestra tu carta o catálogo. Con pedidos, tu cliente arma el carrito y te llega a WhatsApp con todo escrito y registrado; sin pedidos, cada producto tiene un botón «Consultar»." },
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
    <section id="como-funciona" aria-labelledby="steps-title" className="scroll-mt-20 bg-[#FFEFE6]">
      <div className={`${wrap} py-16 sm:py-24`}>
        <h2 id="steps-title" className="mk-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Cómo funciona</h2>
        <ol className="mt-12 grid gap-10 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.t} className="flex gap-5">
              <span aria-hidden className="mk-display text-7xl font-extrabold leading-none text-[#C73E00]/35">{i + 1}</span>
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
    <ul className="mt-12 grid gap-6 md:grid-cols-3" data-fx-stagger>
      {plans.map((p) => (
        <li key={p.id} data-fx="zoom" className={`relative flex flex-col rounded-3xl border-2 bg-white p-7 ${p.priceMonthly === 0 ? "border-[#15803D] shadow-[0_30px_60px_-30px_rgba(21,128,61,0.55)] md:-translate-y-2" : "border-border"}`}>
          <h3 className="mk-display text-2xl font-bold">{p.name}</h3>
          {p.priceMonthly === 0 && <p className="mt-1 text-sm font-semibold text-[#15803D]">Para empezar hoy, sin tarjeta</p>}
          <p className="mk-display mt-3 text-4xl font-extrabold tracking-tight">
            {p.priceMonthly === 0 ? "$ 0" : formatPrice(p.priceMonthly)}<span className="text-base font-semibold text-muted-foreground">{p.priceMonthly === 0 ? " para siempre" : " por mes, por página"}</span>
          </p>
          <ul className="mt-6 flex-1 space-y-2.5 text-[0.95rem]">
            <li className="flex gap-2.5"><Check />{p.limits.products ? `Hasta ${p.limits.products} productos` : "Productos ilimitados"}</li>
            {p.features.filter((f) => f.trim().toLowerCase() !== (p.limits.products ? `hasta ${p.limits.products} productos` : "productos ilimitados")).map((f) => <li key={f} className="flex gap-2.5"><Check />{f}</li>)}
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
  <svg viewBox="0 0 20 20" aria-hidden className="mt-0.5 size-5 shrink-0 text-[#C73E00]"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export function Plans({ fallback }: { fallback: React.ReactNode }) {
  return (
    <section id="planes" aria-labelledby="plans-title" className={`${wrap} scroll-mt-20 py-16 sm:py-24`}>
      <h2 id="plans-title" data-fx="up" className="mk-display max-w-[22ch] text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Empezá gratis, crecé cuando lo necesites</h2>
      <p className="mt-4 max-w-[52ch] text-lg text-muted-foreground">Tu página que vende y crece con vos. Pagás con transferencia y cambiás de plan cuando quieras.</p>
      {fallback}
    </section>
  );
}
export { PlansList };

export function FaqSection({ limit }: { limit?: number } = {}) {
  return (
    <Suspense fallback={<FaqList items={DEFAULT_FAQ} initial={limit} />}>
      <FaqDynamic limit={limit} />
    </Suspense>
  );
}

async function FaqDynamic({ limit }: { limit?: number }) {
  return <FaqList items={(await getSiteConfig()).faq} initial={limit} />;
}

function FaqList({ items, initial }: { items: FaqItem[]; initial?: number }) {
  return (
    <section id="preguntas" aria-labelledby="faq-title" className={`${wrap} scroll-mt-20 py-16 sm:py-24`}>
      <h2 id="faq-title" data-fx="up" className="mk-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Preguntas frecuentes</h2>
      <FaqItems items={items} initial={initial} />
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="final-title" className="relative isolate overflow-hidden bg-[#0E1B2C] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="mk-orb absolute -right-20 -top-20 size-[30rem] rounded-full" style={{ "--orb": "rgb(252 85 2 / 0.40)" } as React.CSSProperties} />
        <div className="mk-orb absolute -bottom-32 left-10 size-96 rounded-full" style={{ "--orb": "rgb(255 176 0 / 0.20)" } as React.CSSProperties} />
      </div>
      <div className={`${wrap} py-24 sm:py-32`}>
        <h2 id="final-title" data-fx="up" className="mk-display max-w-[14ch] text-5xl font-extrabold leading-[0.98] tracking-tight sm:text-7xl">Que te encuentren y te pidan.</h2>
        <p data-fx="up" style={{ "--fx-d": "100ms" } as React.CSSProperties} className="mt-5 max-w-[38ch] text-xl text-white/80">En 5 minutos tenés tu página y tu link listos para la bio de Instagram, el estado de WhatsApp y un QR para el local.</p>
        <Link href="/crear" className={`${ctaSol} mt-9`}>Crear mi página gratis</Link>
        <p className="mt-5 text-sm font-medium text-white/70">Hecho en Argentina. Sin tarjeta, sin comisión por venta y con soporte por WhatsApp.</p>
      </div>
    </section>
  );
}

export { TINTA };
