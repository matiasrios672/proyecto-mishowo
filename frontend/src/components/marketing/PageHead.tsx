import Link from "next/link";

/** Encabezado de cada página de la web de MiShowo: un solo h1, bajada corta y camino de vuelta a la home. */
export function PageHead({ title, lead }: { title: string; lead: string }) {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-[#FFE2D0] to-[#FFEFE6]">
      <div aria-hidden className="mk-grid pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto w-full max-w-6xl px-5 pb-12 pt-8 sm:px-8 sm:pb-16 sm:pt-10">
        <nav aria-label="Ubicación" className="text-sm font-semibold text-[#C73E00]">
          <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><span aria-hidden>←</span> Inicio</Link>
        </nav>
        <h1 className="mk-display mt-2 max-w-[18ch] text-4xl font-extrabold leading-[1] tracking-tight text-[#0E1B2C] sm:text-6xl">{title}</h1>
        <p className="mt-5 max-w-[52ch] text-lg text-[#0E1B2C]/75 sm:text-xl">{lead}</p>
      </div>
    </section>
  );
}
