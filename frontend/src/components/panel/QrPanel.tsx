/* eslint-disable @next/next/no-img-element -- el QR es un data URL generado en el navegador */
"use client";

import { useEffect, useState } from "react";
import { POSTER_H, POSTER_W, renderQrPoster } from "@/lib/qrPoster";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/authClient";
import { siteUrl } from "@/lib/siteUrl";

interface Biz { business: { slug: string; status: string } | null; content: { name: string } | null }

/** QR del link del negocio. Lleva `utm_source=qr`, así las estadísticas separan a quien llegó escaneándolo. */
export function QrPanel() {
  const [biz, setBiz] = useState<{ slug: string; name: string; status: string } | null | undefined>(undefined);
  const [png, setPng] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<Biz>("/me/business").then((r) => { if (alive) setBiz(r.ok && r.data.business ? { ...r.data.business, name: r.data.content?.name ?? "" } : null); });
    return () => { alive = false; };
  }, []);

  const url = biz ? `${siteUrl(biz.slug)}/?utm_source=qr` : null;
  useEffect(() => {
    if (!url) return;
    let alive = true;
    renderQrPoster({ url, name: biz?.name ?? "", display: siteUrl(biz?.slug ?? "").replace(/^https?:\/\//, "") }).then((d) => { if (alive) setPng(d); });
    return () => { alive = false; };
  }, [url, biz]);

  if (biz === undefined) return <p className="text-muted-foreground">Cargando…</p>;
  if (!biz) return <p className="rounded-xl border border-dashed p-6 text-center">Primero creá tu página en el editor.</p>;

  const published = biz.status === "published";
  return (
    <section aria-labelledby="qr-title" className="space-y-6">
      <div className="print:hidden">
        <h1 id="qr-title" className="text-2xl font-bold">Tu código QR</h1>
        <p className="mt-2 max-w-[60ch] text-muted-foreground">Pegalo en tu local, en los paquetes o en tu vidriera: quien lo escanea con el celular entra directo a tu página.</p>
        {!published && <p role="status" className="mt-3 rounded-lg bg-muted p-3 text-sm">Tu página todavía no está publicada. El QR ya funciona, pero va a mostrar un error hasta que la publiques.</p>}
      </div>

      <div className="mx-auto max-w-sm print:max-w-none" data-testid="qr-poster">
        {png ? <img src={png} alt={`Cartel de ${biz.name} con el código QR que abre ${siteUrl(biz.slug)}`} width={POSTER_W} height={POSTER_H} className="h-auto w-full rounded-2xl border shadow-lg print:rounded-none print:border-0 print:shadow-none" data-testid="qr-image" /> : <div className="aspect-[1080/1528] w-full animate-pulse rounded-2xl bg-muted" />}
      </div>

      <div className="flex flex-wrap justify-center gap-3 print:hidden">
        {png && <a href={png} download={`qr-${biz.slug}.png`} className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground" data-testid="qr-download">Descargar PNG</a>}
        <Button variant="outline" onClick={() => window.print()}>Imprimir o guardar PDF</Button>
      </div>
    </section>
  );
}
