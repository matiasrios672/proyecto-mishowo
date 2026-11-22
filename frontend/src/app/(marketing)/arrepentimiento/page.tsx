import type { Metadata } from "next";
import { PageWrap } from "@/components/marketing/ContentPage";
import { ContactForm } from "@/components/marketing/ContactForm";

export const metadata: Metadata = {
  title: "Botón de arrepentimiento",
  description: "Si contrataste un plan de MiShowo y te arrepentiste, tenés 10 días corridos para cancelarlo y pedir el reintegro.",
  alternates: { canonical: "/arrepentimiento" },
};

export default function Arrepentimiento() {
  return (
    <PageWrap>
      <h1 className="mk-display text-[clamp(2.2rem,6vw,3.6rem)] font-extrabold leading-[1.02] tracking-tight">Botón de arrepentimiento</h1>
      <p className="mt-4 max-w-[54ch] text-xl leading-snug text-muted-foreground">
        Si contrataste un plan y te arrepentiste, tenés 10 días corridos desde la contratación para cancelarlo y pedir el reintegro de lo que pagaste.
      </p>
      <div className="mt-10"><ContactForm kind="arrepentimiento" /></div>
    </PageWrap>
  );
}
