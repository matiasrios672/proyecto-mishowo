import type { Metadata } from "next";
import Link from "next/link";
import { BLOG } from "@/content/blog";
import { PageWrap } from "@/components/marketing/ContentPage";

export const metadata: Metadata = {
  title: "Blog",
  description: "Consejos para vender más con la página de tu negocio: fotos, Instagram, precios y más.",
  alternates: { canonical: "/blog" },
};

const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

export default function BlogIndex() {
  return (
    <PageWrap>
      <h1 className="mk-display text-[clamp(2.4rem,6vw,3.8rem)] font-extrabold leading-none tracking-tight">Blog</h1>
      <p className="mt-4 max-w-[48ch] text-xl text-muted-foreground">Consejos simples para vender más con la página de tu negocio.</p>
      <ul className="mt-12 divide-y divide-border border-y border-border">
        {BLOG.map((a) => (
          <li key={a.slug}>
            <Link href={`/blog/${a.slug}`} className="group block py-7 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <h2 className="mk-display text-2xl font-bold leading-tight group-hover:text-primary sm:text-3xl">{a.title}</h2>
              <p className="mt-2 max-w-[56ch] text-muted-foreground">{a.description}</p>
              <p className="mt-3 text-sm text-muted-foreground">{fmt(a.date)} · {a.minutes} min de lectura</p>
            </Link>
          </li>
        ))}
      </ul>
    </PageWrap>
  );
}
