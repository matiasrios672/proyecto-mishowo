import type { Metadata } from "next";
import { PageWrap } from "@/components/marketing/ContentPage";
import { ContactForm } from "@/components/marketing/ContactForm";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Escribinos y te respondemos por email lo antes posible.",
  alternates: { canonical: "/contacto" },
};

export default function Contacto() {
  return (
    <PageWrap>
      <h1 className="mk-display text-[clamp(2.2rem,6vw,3.6rem)] font-extrabold leading-[1.02] tracking-tight">Contacto</h1>
      <p className="mt-4 max-w-[54ch] text-xl leading-snug text-muted-foreground">Contanos en qué te ayudamos y te respondemos por email.</p>
      <div className="mt-10"><ContactForm kind="contacto" /></div>
    </PageWrap>
  );
}
