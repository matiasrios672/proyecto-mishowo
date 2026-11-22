import type { Metadata } from "next";
import { ContentPage } from "@/components/marketing/ContentPage";
import { LEGAL_UPDATED, getLegal } from "@/content/legal";

const doc = getLegal("privacidad")!;

export const metadata: Metadata = { title: doc.title, description: doc.description, alternates: { canonical: "/privacidad" } };

export default function Page() {
  return <ContentPage title={doc.title} meta={`Última actualización: ${LEGAL_UPDATED}`} body={doc.body} />;
}
