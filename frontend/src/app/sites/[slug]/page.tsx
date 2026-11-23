import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getReviewSummary, getSite } from "@/lib/api";
import { publicToSite } from "@/lib/site";
import { SiteView } from "@/components/site/SiteView";
import { localBusinessJsonLd, safeJsonLd, seoDescription } from "@/lib/seo";
import { siteUrl } from "@/lib/siteUrl";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSite(slug);
  if (!site?.business) return { title: "Página no disponible", robots: { index: false } };
  const model = publicToSite(site);
  const url = siteUrl(slug);
  const description = seoDescription(model);
  // Sin fotos, se genera una imagen con el nombre y el color de la marca (así el link nunca se comparte "pelado").
  const image = model.cover ?? model.categories.flatMap((c) => c.products).find((p) => p.image)?.image ?? model.logo ?? `${url}/og`;
  return {
    title: { absolute: model.name }, description,
    alternates: { canonical: `${url}/` },
    openGraph: { type: "website", locale: "es_AR", url: `${url}/`, siteName: model.name, title: model.name, description, images: [{ url: image }] },
    twitter: { card: "summary_large_image", title: model.name, description, images: [image] },
  };
}

export default function SitePage({ params }: Props) {
  return (
    <Suspense fallback={<main className="p-6 text-muted-foreground">Cargando…</main>}>
      <SiteContent params={params} />
    </Suspense>
  );
}

async function SiteContent({ params }: Props) {
  const { slug } = await params;
  const site = await getSite(slug);
  if (!site) notFound();

  if (site.status === "suspended") {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="mb-2 text-2xl font-semibold">Esta página no está disponible por el momento</h1>
        <p className="text-muted-foreground">Volvé a intentar más tarde.</p>
      </main>
    );
  }

  const model = publicToSite(site);
  // Sin fotos, se genera una imagen con el nombre y el color de la marca (así el link nunca se comparte "pelado").
  const image = model.cover ?? model.categories.flatMap((c) => c.products).find((p) => p.image)?.image ?? model.logo ?? `${siteUrl(slug)}/og`;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(localBusinessJsonLd(model, `${siteUrl(slug)}/`, image, await getReviewSummary(slug))) }} />
      <SiteView site={model} orderable={{ slug }} />
    </>
  );
}
