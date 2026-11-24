import type { ReactNode } from "react";
import Link from "next/link";
import { Markdown } from "@/lib/markdown";

const cta = "inline-flex items-center justify-center rounded-xl bg-[#FC5502] px-6 py-3 text-base font-bold text-[#0E1B2C] transition-transform hover:bg-[#FF6A1F] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function PageWrap({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-20">{children}</main>;
}

export function ContentPage({
  title, intro, meta, body, back, showCta = false, children,
}: {
  title: string; intro?: string; meta?: string; body: string; back?: { href: string; label: string }; showCta?: boolean; children?: ReactNode;
}) {
  return (
    <PageWrap>
      {back && <Link href={back.href} className="mb-6 inline-block text-sm font-medium text-muted-foreground hover:underline">← {back.label}</Link>}
      <h1 className="mk-display text-[clamp(2.2rem,6vw,3.6rem)] font-extrabold leading-[1.02] tracking-tight [text-wrap:balance]">{title}</h1>
      {intro && <p className="mt-4 max-w-[52ch] text-xl leading-snug text-muted-foreground">{intro}</p>}
      {meta && <p className="mt-3 text-sm text-muted-foreground">{meta}</p>}
      <div className="mt-10"><Markdown source={body} /></div>
      {children}
      {showCta && (
        <aside className="mt-14 rounded-3xl bg-muted p-8">
          <p className="mk-display text-2xl font-bold">Armá la página de tu negocio gratis</p>
          <p className="mt-2 text-muted-foreground">Tu carta, catálogo o servicios online, con pedidos por WhatsApp si querés. Sin tarjeta.</p>
          <Link href="/crear" className={`${cta} mt-5`}>Creá tu página gratis</Link>
        </aside>
      )}
    </PageWrap>
  );
}
