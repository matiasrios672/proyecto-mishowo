import type { Metadata } from "next";
import { Isotipo, Wordmark } from "@/components/brand/Wordmark";
import { PageHead } from "@/components/marketing/PageHead";

export const metadata: Metadata = {
  title: "Manual de marca",
  description: "Logo, colores, degradés, tipografía y usos de la identidad de MiShowo.",
  robots: { index: false, follow: false },
};

const COLORS = [
  { name: "Naranja MiShowo", hex: "#FC5502", rgb: "252 85 2", use: "Botones principales (con texto tinta en negrita, contraste 5,3:1), logo, íconos y titulares grandes. Un solo botón naranja por pantalla.", text: "#0E1B2C" },
  { name: "Naranja intenso", hex: "#C73E00", rgb: "199 62 0", use: "Links y texto de acento chico sobre fondo claro (contraste 5,1:1, cumple AA). Nunca como relleno de botón.", text: "#fff" },
  { name: "Ámbar sol", hex: "#FFB000", rgb: "255 176 0", use: "Segundo acento y final de los degradés cálidos.", text: "#0E1B2C" },
  { name: "Tinta", hex: "#0E1B2C", rgb: "14 27 44", use: "Texto principal, «Mi» del logo y fondos oscuros.", text: "#fff" },
  { name: "Crema", hex: "#FFF7F1", rgb: "255 247 241", use: "Fondos claros y hojas de los paneles.", text: "#0E1B2C" },
  { name: "Durazno", hex: "#FFE2D0", rgb: "255 226 208", use: "Fondos suaves, tarjetas y estados activos.", text: "#0E1B2C" },
  { name: "Verde OK", hex: "#15803D", rgb: "21 128 61", use: "Confirmaciones y «gratis». Solo para estados.", text: "#fff" },
];

const GRADIENTS = [
  { name: "Brasa (principal)", css: "var(--brand-gradient)", stops: "#FF8A00 → #FC5502 → #E03E00 · 135°", use: "Héroes, botones destacados, portadas y piezas para redes." },
  { name: "Sol", css: "var(--brand-gradient-sun)", stops: "#FFB000 → #FF7A00 → #FC5502 · 135°", use: "Promos, etiquetas, ilustraciones cálidas." },
  { name: "Noche", css: "var(--brand-gradient-night)", stops: "#0E1B2C → #1B2B44 → #3A2A2A · 160°", use: "Franjas oscuras y pies. Sobre este fondo se usa el logo claro." },
  { name: "Amanecer suave", css: "var(--brand-gradient-soft)", stops: "#FFE2D0 → #FFF7F1 · 180°", use: "Fondo de encabezados y secciones claras." },
];

const h2 = "mk-display text-3xl font-extrabold tracking-tight text-[#0E1B2C] sm:text-4xl";
const box = "rounded-xl bg-[#FFF7F1] px-4 py-3";

export default function Marca() {
  return (
    <>
      <PageHead title="Manual de marca" lead="Cómo se ve y cómo suena MiShowo. Si lo respetás, todo lo que hagamos parece de la misma casa." />
      <div className="mx-auto w-full max-w-6xl space-y-16 px-5 py-12 sm:px-8 sm:py-16">
        <section aria-labelledby="m-logo" className="space-y-6">
          <h2 id="m-logo" className={h2}>Logo</h2>
          <p className="max-w-[62ch] text-[#0E1B2C]/75">Dos piezas: el <strong>logotipo</strong> («Mi» en tinta, «Showo.» en naranja) y el <strong>isotipo</strong> (la M con punto sobre un cuadrado redondeado). El punto final es parte de la marca: no se saca.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <figure className="grid place-items-center gap-3 rounded-2xl border border-[#F5D9C8] bg-white p-8"><Wordmark className="text-4xl" /><figcaption className="text-sm text-[#47566A]">Sobre fondo claro</figcaption></figure>
            <figure className="grid place-items-center gap-3 rounded-2xl p-8" style={{ background: "var(--brand-gradient-night)" }}><Wordmark variant="claro" className="text-4xl" /><figcaption className="text-sm text-white/80">Sobre fondo oscuro (logo claro)</figcaption></figure>
            <figure className="grid place-items-center gap-3 rounded-2xl border border-[#F5D9C8] bg-[#FFF7F1] p-8"><Isotipo className="size-24" /><figcaption className="text-sm text-[#47566A]">Isotipo: íconos, favicon, perfiles</figcaption></figure>
          </div>
          <ul className="grid gap-3 text-sm sm:grid-cols-2">
            {["Espacio libre alrededor: como mínimo la altura de la «M».", "Tamaño mínimo: logotipo 96 px de ancho; isotipo 24 px.", "Usá siempre los archivos de /brand (un solo archivo por pieza).", "No lo estires, no lo gires, no cambies los colores, no le pongas sombras."].map((t) => <li key={t} className={box}>{t}</li>)}
          </ul>
        </section>

        <section aria-labelledby="m-color" className="space-y-6">
          <h2 id="m-color" className={h2}>Colores</h2>
          <p className="max-w-[62ch] text-[#0E1B2C]/75">Naranja como protagonista, tinta para el texto y crema para respirar. Regla de oro: el naranja vivo es para actuar (botones con texto tinta, nunca blanco); para <em>leer</em> texto chico usá el naranja intenso.</p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="brand-colors">
            {COLORS.map((c) => (
              <li key={c.hex} className="overflow-hidden rounded-2xl border border-[#F5D9C8] bg-white">
                <div className="flex h-24 items-end p-3 text-sm font-bold" style={{ background: c.hex, color: c.text }}>{c.hex}</div>
                <div className="space-y-1 p-4 text-sm"><p className="font-extrabold">{c.name}</p><p className="text-[#47566A]">RGB {c.rgb}</p><p>{c.use}</p></div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="m-grad" className="space-y-6">
          <h2 id="m-grad" className={h2}>Degradés</h2>
          <p className="max-w-[62ch] text-[#0E1B2C]/75">Siempre en diagonal y de cálido a más cálido. Un degradé por pieza; no se mezclan entre sí ni se usan detrás de texto largo.</p>
          <ul className="grid gap-4 sm:grid-cols-2" data-testid="brand-gradients">
            {GRADIENTS.map((g) => (
              <li key={g.name} className="overflow-hidden rounded-2xl border border-[#F5D9C8] bg-white">
                <div className="h-32" style={{ background: g.css }} role="img" aria-label={`Degradé ${g.name}`} />
                <div className="space-y-1 p-4 text-sm"><p className="font-extrabold">{g.name}</p><p className="font-mono text-xs text-[#47566A]">{g.stops}</p><p>{g.use}</p></div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="m-type" className="space-y-6">
          <h2 id="m-type" className={h2}>Tipografía</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#F5D9C8] bg-white p-6"><p className="mk-display text-5xl font-extrabold leading-none">Aa</p><p className="mt-3 font-extrabold">Títulos: redonda, gruesa y compacta</p><p className="text-sm text-[#47566A]">Peso 800, interlineado ajustado.</p></div>
            <div className="rounded-2xl border border-[#F5D9C8] bg-white p-6"><p className="text-5xl leading-none">Aa</p><p className="mt-3 font-extrabold">Texto: sans-serif simple</p><p className="text-sm text-[#47566A]">Mínimo 16 px en celular; renglones de hasta ~60 caracteres.</p></div>
          </div>
        </section>

        <section aria-labelledby="m-voz" className="space-y-6">
          <h2 id="m-voz" className={h2}>Voz y tono</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {["Rioplatense con voseo: «armá», «elegí», «contanos».", "Cercana y directa: frases cortas, sin jerga técnica.", "Honesta: sin promesas exageradas ni letra chica.", "Cada página de cliente lleva «Hecho por MiShowo»."].map((t) => <li key={t} className={box}>{t}</li>)}
          </ul>
        </section>
      </div>
    </>
  );
}
