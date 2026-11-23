import type { Metadata } from "next";
import { PageHead } from "@/components/marketing/PageHead";
import { InstallmentsDemo } from "@/components/marketing/InstallmentsDemo";
import { FinalCta } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Cuotas sin interés",
  description: "Mostrá «6 cuotas sin interés de $X» en cada precio de tu página y dejá que tus clientes pidan pagar en cuotas. Sin comisión de MiShowo.",
  alternates: { canonical: "/cuotas" },
};

export default function Cuotas() {
  return (
    <>
      <PageHead title="Cuotas sin interés" lead="Mostrá en cada precio que ofrecés cuotas. El cobro lo coordinás vos, con el medio que ya usás." />
      <InstallmentsDemo />
      <FinalCta />
    </>
  );
}
