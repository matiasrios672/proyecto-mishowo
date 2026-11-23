import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BLOG, getArticle } from "@/content/blog";
import { ContentPage } from "@/components/marketing/ContentPage";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return BLOG.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = getArticle((await params).slug);
  if (!a) return { title: "Artículo no encontrado", robots: { index: false } };
  return {
    title: a.title,
    description: a.description,
    alternates: { canonical: `/blog/${a.slug}` },
    openGraph: { title: a.title, description: a.description, type: "article", publishedTime: a.date, locale: "es_AR", images: [{ url: "/opengraph-image", width: 1200, height: 630 }] },
  };
}

const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

export default async function Article({ params }: Props) {
  const a = getArticle((await params).slug);
  if (!a) notFound();
  const jsonLd = { "@context": "https://schema.org", "@type": "Article", headline: a.title, description: a.description, datePublished: a.date, inLanguage: "es-AR", author: { "@type": "Organization", name: "MiShowo" } };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ContentPage title={a.title} meta={`${fmt(a.date)} · ${a.minutes} min de lectura`} body={a.body} back={{ href: "/blog", label: "Todos los artículos" }} showCta />
    </>
  );
}
