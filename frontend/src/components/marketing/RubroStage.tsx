"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ProductIllustration } from "@/components/site/illustrations";
import { installmentLine } from "@/lib/installments";
import { IconChat } from "./Doodles";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const SCHEME = process.env.NEXT_PUBLIC_ROOT_SCHEME ?? "http";
const exampleUrl = (slug: string) => `${SCHEME}://${slug}.${ROOT}`;

interface Item { n: string; p: number; tint: string; cuotas?: number }
interface Rubro {
  id: string; tab: string; ghost: string; title: string; line: string; points: string[];
  shop: string; tag: string; accent: string; items: Item[]; example?: { href: string; slug: string };
}

const RUBROS: Rubro[] = [
  {
    id: "ropa", tab: "Ropa", ghost: "TIENDA", title: "Tu tienda de ropa, con talles y cuotas a la vista", line: "Fotos grandes, variantes por talle y color, stock y precios tachados. Tus clientas arman el pedido solas.",
    points: ["Talles y colores con stock", "«6 cuotas sin interés» bajo cada precio", "Pedido armado por WhatsApp"],
    shop: "Luna Indumentaria", tag: "luna.mishowo.com", accent: "#FF8A4C", example: { href: exampleUrl("demo-ropa"), slug: "demo-ropa" },
    items: [{ n: "Campera puffer corta", p: 189900, tint: "#FFEADB", cuotas: 6 }, { n: "Buzo canguro de frisa", p: 64900, tint: "#F3E6DC", cuotas: 6 }, { n: "Remera oversize", p: 24900, tint: "#F8EFD2" }],
  },
  {
    id: "comidas", tab: "Comidas y bares", ghost: "MENÚ", title: "Tu carta, al día en cada mesa", line: "Secciones, precios y platos agotados que cambiás en segundos. Con QR para la mesa y, si querés, pedidos para llevar.",
    points: ["Carta con puntos guía hasta el precio", "Cartel con QR listo para imprimir", "Platos agotados en un toque"],
    shop: "Empanadas de Lupe", tag: "lupe.mishowo.com", accent: "#F6B40E", example: { href: exampleUrl("lupe-empanadas"), slug: "lupe-empanadas" },
    items: [{ n: "Docena de empanadas", p: 14500, tint: "#FBEBD3" }, { n: "Pizza muzzarella", p: 9800, tint: "#FBE0DA" }, { n: "Flan casero", p: 3200, tint: "#F8EFD2" }],
  },
  {
    id: "eventos", tab: "Eventos", ghost: "EVENTOS", title: "Mostrá tus servicios en grande y cobrá en cuotas", line: "Cada servicio con su foto, su precio y las cuotas que ofrecés. El cliente te escribe con el día y el lugar anotados.",
    points: ["Fecha del evento en el pedido", "Cuotas sin interés por servicio", "Reseñas de clientes reales"],
    shop: "Fiestas Don Pepe", tag: "donpepe.mishowo.com", accent: "#FF8A4C", example: { href: exampleUrl("demo-eventos"), slug: "demo-eventos" },
    items: [{ n: "Cabina de fotos", p: 120000, tint: "#FFEADB", cuotas: 3 }, { n: "Sonido y luces", p: 150000, tint: "#F3E6DC", cuotas: 3 }, { n: "Castillo inflable", p: 60000, tint: "#FBE0DA", cuotas: 3 }],
  },
  {
    id: "muebles", tab: "Muebles y deco", ghost: "DECO", title: "Cada pieza en primer plano", line: "Medidas claras, maderas y terminaciones, y consultas directas. Ideal para talleres y casas de deco.",
    points: ["Variantes de madera y medida", "Cuotas para piezas grandes", "Consulta directa por WhatsApp"],
    shop: "Taller Nogal Muebles", tag: "nogal.mishowo.com", accent: "#F6B40E", example: { href: exampleUrl("demo-muebles"), slug: "demo-muebles" },
    items: [{ n: "Mesa ratona de paraíso", p: 185000, tint: "#F3E6DC", cuotas: 6 }, { n: "Biblioteca con 5 estantes", p: 240000, tint: "#F8EFD2", cuotas: 6 }, { n: "Banco bajo", p: 68000, tint: "#FFEADB" }],
  },
  {
    id: "belleza", tab: "Belleza y salud", ghost: "TURNOS", title: "Servicios con duración, precio y turno", line: "Belleza, salud y deporte: tus servicios, tus profesionales y la agenda que ya tenés, con recordatorios por mail.",
    points: ["Turnos con profesionales y duración", "Recordatorio 24 h antes", "Clases y pases para gimnasios"],
    shop: "Estudio Aura", tag: "aura.mishowo.com", accent: "#FF8A4C", example: { href: exampleUrl("demo-belleza"), slug: "demo-belleza" },
    items: [{ n: "Esmaltado semipermanente", p: 12000, tint: "#FBE0DA" }, { n: "Corte y peinado", p: 9500, tint: "#F8EFD2" }, { n: "Limpieza facial", p: 15000, tint: "#FFEADB" }],
  },
  {
    id: "oficios", tab: "Oficios y servicios", ghost: "OFICIOS", title: "Mostrá lo que hacés y dónde atendés", line: "Tus trabajos, tu zona y consultas por WhatsApp. Para quienes viven de su oficio y quieren verse profesionales.",
    points: ["Trabajos realizados con fotos", "Zona y horarios a la vista", "Link para tu bio y tu QR"],
    shop: "Servicios Rivas", tag: "rivas.mishowo.com", accent: "#F6B40E",
    items: [{ n: "Instalación de luz", p: 45000, tint: "#F8EFD2" }, { n: "Arreglo de canilla", p: 18000, tint: "#FFEADB" }, { n: "Service de aire", p: 35000, tint: "#F3E6DC" }],
  },
];

const ars = (n: number) => `$ ${new Intl.NumberFormat("es-AR").format(n)}`;

/** Celular con la página del negocio del rubro elegido. Decorativo: el texto de al lado ya dice lo mismo. */
function Phone({ r }: { r: Rubro }) {
  return (
    <div aria-hidden className="relative mx-auto w-[16.5rem] rounded-[2.4rem] border-[9px] border-[#05101D] bg-white p-3 shadow-[0_60px_100px_-30px_rgba(0,0,0,0.85)] ring-1 ring-white/15 sm:w-[18.5rem]">
      <div className="mx-auto mb-3 h-3.5 w-14 rounded-full bg-[#05101D]" />
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-full bg-[#D14300] text-sm font-extrabold text-white">{r.shop[0]}</span>
        <span className="min-w-0 text-left"><span className="block truncate text-[13px] font-extrabold leading-tight text-[#0E1B2C]">{r.shop}</span><span className="block truncate text-[10px] text-[#0E1B2C]/55">{r.tag}</span></span>
      </div>
      <ul className="mt-3 space-y-2">
        {r.items.map((it) => (
          <li key={it.n} className="flex items-center gap-2.5 rounded-xl border border-[#0E1B2C]/8 p-1.5 text-left">
            <span className="grid size-14 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: it.tint }}><ProductIllustration name={it.n} /></span>
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-bold text-[#0E1B2C]">{it.n}</span>
              <span className="block text-[12px] font-semibold text-[#0E1B2C]/70">{ars(it.p)}</span>
              {it.cuotas && <span className="block text-[10.5px] font-bold text-[#C73E00]">{installmentLine(it.p, { enabled: true, count: it.cuotas, note: "", minAmount: 0 })}</span>}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid h-10 place-items-center rounded-xl bg-[#15803D] text-[13px] font-extrabold text-white"><span className="flex items-center gap-1.5"><IconChat className="size-4" />Pedir por WhatsApp</span></div>
    </div>
  );
}

/**
 * Home: la vitrina de rubros. Un rubro grande a la vez (el celular con su ejemplo y la palabra gigante detrás), con pestañas
 * accesibles (flechas, Inicio y Fin). Agrupa los rubros en seis para no abrumar.
 */
export function RubroStage() {
  const [current, setCurrent] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const r = RUBROS[current]!;

  const go = (i: number) => {
    const next = (i + RUBROS.length) % RUBROS.length;
    setCurrent(next);
    tabs.current[next]?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(current + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(current - 1); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(RUBROS.length - 1); }
  };

  return (
    <section id="elegi-tu-rubro" aria-labelledby="rubro-title" className="relative isolate scroll-mt-16 overflow-hidden bg-[#0E1B2C] py-16 text-white sm:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="mk-orb absolute -left-24 top-0 size-[28rem] rounded-full" style={{ "--orb": "rgb(252 85 2 / 0.30)" } as React.CSSProperties} />
        <div className="mk-orb absolute -right-24 bottom-0 size-[30rem] rounded-full" style={{ "--orb": "rgb(255 176 0 / 0.14)" } as React.CSSProperties} />
      </div>
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="text-center">
          <h2 id="rubro-title" className="mk-display mx-auto max-w-[20ch] text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">Páginas hechas para negocios como el tuyo</h2>
          <p className="mx-auto mt-4 max-w-[46ch] text-lg text-white/75">Elegí tu rubro y mirá cómo queda: catálogo, colores y botón de WhatsApp ya armados.</p>
        </div>

        <div role="tablist" aria-label="Rubros" onKeyDown={onKey} className="mx-auto mt-9 flex w-full max-w-3xl snap-x justify-start gap-7 overflow-x-auto overflow-y-hidden border-b border-white/15 px-1 [scrollbar-width:none] sm:justify-center [&::-webkit-scrollbar]:hidden">
          {RUBROS.map((x, i) => (
            <button key={x.id} ref={(el) => { tabs.current[i] = el; }} role="tab" type="button" id={`rubro-tab-${x.id}`} aria-selected={i === current} aria-controls="rubro-panel" tabIndex={i === current ? 0 : -1}
              onClick={() => setCurrent(i)}
              className={`-mb-px min-h-12 shrink-0 snap-center border-b-2 px-0.5 text-base font-bold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${i === current ? "border-[#FF7A2E] text-white" : "border-transparent text-white/65 hover:text-white"}`}>
              {x.tab}
            </button>
          ))}
        </div>

        <div id="rubro-panel" role="tabpanel" aria-labelledby={`rubro-tab-${r.id}`} key={r.id} className="mk-stage-in mt-12 grid items-center gap-12 lg:grid-cols-[1fr_1fr]" data-testid="rubro-panel">
          <div className="text-center lg:text-left">
            <h3 className="mk-display mx-auto max-w-[20ch] text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:mx-0" data-testid="rubro-title">{r.title}</h3>
            <p className="mx-auto mt-5 max-w-[48ch] text-lg text-white/80 lg:mx-0">{r.line}</p>
            <ul className="mx-auto mt-6 inline-flex max-w-md flex-col gap-2.5 text-left">
              {r.points.map((p) => (
                <li key={p} className="flex gap-2.5 text-[15px] text-white/90">
                  <svg viewBox="0 0 20 20" aria-hidden className="mt-0.5 size-5 shrink-0" style={{ color: r.accent }}><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>{p}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link href="/crear" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#D14300] px-7 font-bold text-white transition-transform hover:bg-[#B83700] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Crear mi página</Link>
              {r.example && (
                <a href={r.example.href} target="_blank" rel="noopener noreferrer" aria-label={`Ver el ejemplo de ${r.tab} (se abre en una pestaña nueva)`} className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-white/25 px-6 font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  Ver ejemplo <span aria-hidden>↗</span>
                </a>
              )}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md py-6">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 -translate-y-1/2 select-none text-center font-extrabold leading-none tracking-tighter mk-display"
              style={{ fontSize: "clamp(5rem, 22vw, 15rem)", backgroundImage: `linear-gradient(180deg, ${r.accent}66 0%, transparent 90%)`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              {r.ghost}
            </div>
            <Phone r={r} />
          </div>
        </div>
      </div>
    </section>
  );
}
