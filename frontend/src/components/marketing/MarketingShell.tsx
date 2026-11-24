import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { MobileNav } from "./MobileNav";
import { NAV_LINKS } from "./navLinks";

export const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "";

const cta = "inline-flex items-center justify-center rounded-xl bg-[#FC5502] px-3.5 py-2.5 text-[13px] font-bold whitespace-nowrap text-[#0E1B2C] transition-transform sm:px-5 sm:text-sm hover:bg-[#FF6A1F] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-8">
        <Link href="/" aria-label="MiShowo, ir al inicio"><Wordmark className="text-xl sm:text-2xl" /></Link>
        <nav aria-label="Principal" className="ml-6 hidden gap-6 text-sm font-medium lg:flex">
          {NAV_LINKS.filter(([, href]) => href !== "/funciones" && href !== "/blog").map(([label, href]) => (
            <Link key={href} href={href} className="hover:text-[#C73E00]">{label === "Cuotas sin interés" ? "Cuotas" : label}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/ingresar" className="hidden text-sm font-medium hover:text-[#C73E00] sm:inline">Ingresar</Link>
          <Link href="/crear" className={cta}>Creá tu página gratis</Link>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-muted/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div>
          <Wordmark className="mk-display text-2xl" />
          <p className="mt-3 max-w-[32ch] text-sm text-muted-foreground">Tu página que vende y crece con vos. Hecha en Argentina para emprendedores y comercios chicos.</p>
          {SUPPORT_WHATSAPP && (
            <a href={`https://wa.me/${SUPPORT_WHATSAPP.replace(/\D/g, "")}`} className="mt-4 inline-block text-sm font-semibold " target="_blank" rel="noopener noreferrer">Soporte por WhatsApp</a>
          )}
        </div>
        <FooterCol title="Producto" links={[["Cómo funciona", "/como-funciona"], ["Rubros y ejemplos", "/rubros"], ["Cuotas sin interés", "/cuotas"], ["Funciones", "/funciones"], ["Precios y preguntas", "/precios"], ["Probar la demo", "/probar"]]} />
        <FooterCol title="Recursos" links={[["Centro de ayuda", "/ayuda"], ["Blog", "/blog"], ["Contacto", "/contacto"], ["Crear mi página", "/crear"]]} />
        <FooterCol title="Legales" links={[["Términos y condiciones", "/terminos"], ["Política de privacidad", "/privacidad"], ["Política de cancelación", "/cancelacion"], ["Botón de arrepentimiento", "/arrepentimiento"]]} />
      </div>
      <p className="border-t border-border px-5 py-4 text-center text-xs text-muted-foreground">© MiShowo</p>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <nav aria-label={title}>
      <p className="mk-display text-base font-bold">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map(([label, href]) => (
          <li key={href}><Link href={href} className="text-muted-foreground hover:text-foreground">{label}</Link></li>
        ))}
      </ul>
    </nav>
  );
}
