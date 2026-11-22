import type { Metadata } from "next";
import Link from "next/link";
import { HELP } from "@/content/help";
import { PageWrap } from "@/components/marketing/ContentPage";

export const metadata: Metadata = {
  title: "Centro de ayuda",
  description: "Respuestas para crear tu página, cargar productos, recibir pedidos y administrar tu plan.",
  alternates: { canonical: "/ayuda" },
};

export default function HelpIndex() {
  return (
    <PageWrap>
      <h1 className="mk-display text-[clamp(2.4rem,6vw,3.8rem)] font-extrabold leading-none tracking-tight">Centro de ayuda</h1>
      <p className="mt-4 max-w-[48ch] text-xl text-muted-foreground">Respuestas cortas para sacarle el jugo a tu página.</p>
      <ul className="mt-12 grid gap-x-10 sm:grid-cols-2">
        {HELP.map((h) => (
          <li key={h.slug} className="border-t border-border">
            <Link href={`/ayuda/${h.slug}`} className="group block py-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <h2 className="mk-display text-xl font-bold leading-tight group-hover:text-primary">{h.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{h.description}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-10 text-muted-foreground">¿No encontrás lo que buscás? Escribinos desde el <Link href="/contacto" className="underline underline-offset-4">formulario de contacto</Link>.</p>
    </PageWrap>
  );
}
