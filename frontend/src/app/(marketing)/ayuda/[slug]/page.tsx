import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HELP, getHelp } from "@/content/help";
import { ContentPage } from "@/components/marketing/ContentPage";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return HELP.map((h) => ({ slug: h.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const h = getHelp((await params).slug);
  if (!h) return { title: "Artículo no encontrado", robots: { index: false } };
  return { title: h.title, description: h.description, alternates: { canonical: `/ayuda/${h.slug}` } };
}

export default async function HelpArticlePage({ params }: Props) {
  const h = getHelp((await params).slug);
  if (!h) notFound();
  return <ContentPage title={h.title} intro={h.description} body={h.body} back={{ href: "/ayuda", label: "Centro de ayuda" }} />;
}
