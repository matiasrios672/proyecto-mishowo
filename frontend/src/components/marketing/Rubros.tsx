import Link from "next/link";
import { ProductIllustration } from "@/components/site/illustrations";
import { IconChat } from "./Doodles";
import { installmentLine } from "@/lib/installments";

const wrap = "mx-auto w-full max-w-6xl px-5 sm:px-8";

interface Rubro {
  id: string; ghost: string; kicker: string; title: string; line: string; cta: string; shop: string; tag: string; bg: string; accent: string;
  items: { n: string; p: number; tint: string; cuotas?: number }[];
}

const RUBROS: Rubro[] = [
  {
    id: "ropa", ghost: "TIENDA", kicker: "Tiendas de ropa y accesorios", title: "Cada prenda con su talle, su foto y sus cuotas.",
    line: "Variantes por talle y color, precios tachados, stock y «6 cuotas sin interés» bajo cada precio. Tus clientas arman el pedido y te llega listo por WhatsApp.",
    cta: "Crear mi tienda", shop: "Luna Indumentaria", tag: "luna.mishowo.com", bg: "#0E1B2C", accent: "#74ACDF",
    items: [
      { n: "Campera puffer corta", p: 189900, tint: "#E3EEF9", cuotas: 6 },
      { n: "Buzo canguro de frisa", p: 64900, tint: "#F3E6DC", cuotas: 6 },
      { n: "Remera oversize", p: 24900, tint: "#F8EFD2" },
    ],
  },
  {
    id: "comidas", ghost: "MENÚ", kicker: "Rotiserías, bares y casas de comidas", title: "Cambiás un precio y se actualiza en todas las mesas.",
    line: "Secciones, precios y platos agotados que cambiás en segundos. QR para la mesa y pedidos para llevar por WhatsApp, sin comisión.",
    cta: "Crear mi carta", shop: "Empanadas de Lupe", tag: "lupe.mishowo.com", bg: "#0B2A4A", accent: "#F6B40E",
    items: [
      { n: "Docena de empanadas", p: 14500, tint: "#FBEBD3" },
      { n: "Pizza muzzarella", p: 9800, tint: "#FBE0DA" },
      { n: "Flan casero", p: 3200, tint: "#F8EFD2" },
    ],
  },
  {
    id: "eventos", ghost: "EVENTOS", kicker: "Eventos, servicios y oficios", title: "Mostrá tus servicios en grande y cobrá en cuotas.",
    line: "Cada servicio con su foto, su precio y las cuotas que ofrecés. El cliente te escribe con el día y el lugar ya anotados.",
    cta: "Crear mi página", shop: "Fiestas Don Pepe", tag: "donpepe.mishowo.com", bg: "#12233A", accent: "#74ACDF",
    items: [
      { n: "Cabina de fotos", p: 120000, tint: "#E3EEF9", cuotas: 3 },
      { n: "Sonido y luces", p: 150000, tint: "#F3E6DC", cuotas: 3 },
      { n: "Castillo inflable", p: 60000, tint: "#FBE0DA", cuotas: 3 },
    ],
  },
];

const ars = (n: number) => `$ ${new Intl.NumberFormat("es-AR").format(n)}`;

/** Celular con la página de un negocio. Decorativo: lo que dice ya está en el título y el texto de la sección. */
function Phone({ r }: { r: Rubro }) {
  return (
    <div aria-hidden className="mk-phone-rise relative mx-auto w-[16.5rem] rounded-[2.4rem] border-[9px] border-[#05101D] bg-white p-3 shadow-[0_60px_100px_-30px_rgba(0,0,0,0.8)] ring-1 ring-white/15 sm:w-[18.5rem]">
      <div className="mx-auto mb-3 h-3.5 w-14 rounded-full bg-[#05101D]" />
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-full text-sm font-extrabold text-white" style={{ background: "#2F6FB0" }}>{r.shop[0]}</span>
        <span className="min-w-0 text-left"><span className="block truncate text-[13px] font-extrabold leading-tight text-[#0E1B2C]">{r.shop}</span><span className="block truncate text-[10px] text-[#0E1B2C]/55">{r.tag}</span></span>
      </div>
      <ul className="mt-3 space-y-2">
        {r.items.map((it) => (
          <li key={it.n} className="flex items-center gap-2.5 rounded-xl border border-[#0E1B2C]/8 p-1.5 text-left">
            <span className="grid size-14 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: it.tint }}><ProductIllustration name={it.n} /></span>
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-bold text-[#0E1B2C]">{it.n}</span>
              <span className="block text-[12px] font-semibold text-[#0E1B2C]/70">{ars(it.p)}</span>
              {it.cuotas && <span className="block text-[10.5px] font-bold text-[#2F6FB0]">{installmentLine(it.p, { enabled: true, count: it.cuotas, note: "", minAmount: 0 })}</span>}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid h-10 place-items-center rounded-xl bg-[#15803D] text-[13px] font-extrabold text-white"><span className="flex items-center gap-1.5"><IconChat className="size-4" />Pedir por WhatsApp</span></div>
    </div>
  );
}

/**
 * Una franja oscura por rubro, con la palabra gigante detrás del celular (se desplaza al hacer scroll).
 * El movimiento es CSS puro (animation-timeline) y solo si el navegador lo soporta y la persona no pidió menos movimiento.
 */
export function RubroShowcase() {
  return (
    <div id="rubros" className="scroll-mt-16">
      {RUBROS.map((r, i) => (
        <section key={r.id} aria-labelledby={`rubro-${r.id}`} className="relative isolate overflow-hidden py-16 text-white sm:py-24" style={{ backgroundColor: r.bg }}>
          <div aria-hidden className="mk-ghost-drift pointer-events-none absolute inset-x-0 bottom-[6%] -z-10 select-none text-center font-extrabold leading-none tracking-tighter mk-display"
            style={{ fontSize: "clamp(6rem, 30vw, 26rem)", backgroundImage: `linear-gradient(180deg, ${r.accent}55 0%, transparent 85%)`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            {r.ghost}
          </div>
          <div className={`${wrap} text-center`}>
            <p className="mx-auto mb-4 w-fit rounded-full border border-white/20 px-4 py-1.5 text-sm font-bold" style={{ color: r.accent }}>{r.kicker}</p>
            <h2 id={`rubro-${r.id}`} className="mk-display mx-auto max-w-[20ch] text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">{r.title}</h2>
            <p className="mx-auto mt-5 max-w-[52ch] text-lg text-white/80">{r.line}</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link href="/crear" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#F6B40E] px-7 font-bold text-[#0E1B2C] transition-transform hover:bg-[#FFC21F] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{r.cta}</Link>
            </div>
            <div className={`mt-12 ${i === 1 ? "sm:mt-14" : ""}`}><Phone r={r} /></div>
          </div>
        </section>
      ))}
    </div>
  );
}
