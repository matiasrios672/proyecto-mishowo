import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSite } from "@/lib/api";
import { publicToSite } from "@/lib/site";
import { SiteView } from "@/components/site/SiteView";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSite(slug);
  if (!site?.business) return { title: "Página no disponible", robots: { index: false } };
  return { title: { absolute: site.business.name }, description: site.business.description };
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

  return (
    <SiteView site={publicToSite(site)} orderable={{ slug }} />
  );
}
