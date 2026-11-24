import { ProductIllustration } from "@/components/site/illustrations";
import { IconChat } from "./Doodles";

const PRODUCTS = [
  { n: "Docena de empanadas", p: "$ 14.500", tint: "#FBEBD3" },
  { n: "Pizza muzzarella", p: "$ 9.800", tint: "#FBE0DA" },
  { n: "Flan casero", p: "$ 3.200", tint: "#F8EFD2" },
  { n: "Cerveza artesanal", p: "$ 4.800", tint: "#FFEADB" },
  { n: "Torta de ricota", p: "$ 6.500", tint: "#F3E6DC" },
  { n: "Hamburguesa doble", p: "$ 12.400", tint: "#F4E4CF" },
];

/**
 * Escenario del hero: la página real de un negocio, en una ventana de navegador. Es el producto, sin adornos que le
 * compitan: un solo aviso de pedido nuevo y nada animado. Se adapta de 3 columnas (compu y tablet) a 3 más chicas en celular.
 */
export function HeroStage() {
  return (
    <div className="relative mx-auto w-full max-w-[34rem] pb-16 sm:pb-6 lg:max-w-none">
      <div
        role="img"
        aria-label="Vista de la página de un negocio: nombre, estado abierto, productos con foto y precio, y el botón Pedir por WhatsApp."
        className="overflow-hidden rounded-2xl border border-[#0E1B2C]/10 bg-white shadow-[0_40px_80px_-40px_rgba(14,27,44,0.45)]"
      >
        <div className="flex items-center gap-3 border-b border-[#0E1B2C]/8 bg-[#FFFBF8] px-4 py-2.5">
          <span aria-hidden className="flex gap-1.5"><i className="size-2.5 rounded-full bg-[#0E1B2C]/15" /><i className="size-2.5 rounded-full bg-[#0E1B2C]/15" /><i className="size-2.5 rounded-full bg-[#0E1B2C]/15" /></span>
          <span className="min-w-0 flex-1 truncate rounded-md bg-white px-3 py-1 text-center text-[11px] font-medium text-[#0E1B2C]/60 sm:text-xs">lupe.mishowo.com</span>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#D14300] text-base font-extrabold text-white">L</span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-extrabold leading-tight text-[#0E1B2C] sm:text-base">Lupe Empanadas</span>
              <span className="block text-[11px] font-semibold text-emerald-700 sm:text-xs">● Abierto ahora · pedidos hasta las 21 hs</span>
            </span>
            <span className="hidden shrink-0 items-center gap-1.5 rounded-lg bg-[#15803D] px-3 py-2 text-xs font-bold text-white sm:inline-flex"><IconChat className="size-4" />Pedir por WhatsApp</span>
          </div>

          <ul className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
            {PRODUCTS.map((p, i) => (
              <li key={p.n} className={`overflow-hidden rounded-xl border border-[#0E1B2C]/8 text-left ${i > 2 ? "hidden sm:block" : ""}`}>
                <div className="grid aspect-[4/3] place-items-center" style={{ backgroundColor: p.tint }}><ProductIllustration name={p.n} /></div>
                <div className="p-2 sm:p-2.5">
                  <p className="truncate text-[11px] font-bold text-[#0E1B2C] sm:text-xs">{p.n}</p>
                  <p className="text-[11px] font-semibold text-[#0E1B2C]/60 sm:text-xs">{p.p}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 grid h-11 place-items-center rounded-xl bg-[#15803D] text-sm font-extrabold text-white sm:hidden">
            <span className="flex items-center gap-2"><IconChat className="size-5" />Pedir por WhatsApp</span>
          </div>
        </div>
      </div>

      <div aria-hidden className="absolute -bottom-1 right-3 flex items-center gap-3 rounded-xl border border-[#0E1B2C]/8 bg-white px-4 py-3 shadow-[0_20px_40px_-20px_rgba(14,27,44,0.4)] sm:right-6">
        <span className="grid size-9 place-items-center rounded-full bg-[#15803D]/12"><span className="size-2.5 rounded-full bg-[#15803D]" /></span>
        <span className="text-left"><span className="block text-sm font-extrabold leading-tight text-[#0E1B2C]">¡Pedido nuevo #12!</span><span className="block text-xs text-[#0E1B2C]/65">Empanadas y pizza · $ 24.300</span></span>
      </div>
    </div>
  );
}
