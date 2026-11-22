import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSite } from "@/lib/api";
import { themeStyle } from "@/lib/themes";
import { FONT_PAIRS, fontPairStyle } from "@/lib/fonts";

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

  const b = site.business!;
  const pair = FONT_PAIRS.find((p) => p.id === b.design.fontPair) ?? FONT_PAIRS[1]!;
  return (
    <div
      className={`${pair.classes} min-h-screen bg-background text-foreground`}
      style={{ ...themeStyle(b.design.theme, b.design.brandColor), ...fontPairStyle(b.design.fontPair) }}
    >
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>{b.name}</h1>
        <p className="mt-2 text-muted-foreground">{b.tagline ?? b.description}</p>
        <ul className="mt-6 space-y-3">
          {site.products!.map((p) => (
            <li key={p.id} className="rounded-lg border bg-card p-3">
              <p className="font-medium">{p.name}</p>
              {p.price && <p className="text-sm text-muted-foreground">${Number(p.price).toLocaleString("es-AR")}</p>}
              {!p.available && <p className="text-sm text-destructive">Agotado</p>}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
