/* eslint-disable @next/next/no-img-element -- el QR es un data URL generado en el navegador */
"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
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
    QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 1024, color: { dark: "#0E1B2C", light: "#FFFFFF" } }).then((d) => { if (alive) setPng(d); });
    return () => { alive = false; };
  }, [url]);

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

      <div className="mx-auto max-w-sm rounded-2xl border bg-white p-6 text-center text-[#0E1B2C] print:border-0" data-testid="qr-poster">
        <p className="text-xl font-bold">{biz.name}</p>
        {png ? <img src={png} alt={`Código QR que abre ${siteUrl(biz.slug)}`} width={320} height={320} className="mx-auto my-3 size-72" data-testid="qr-image" /> : <div className="mx-auto my-3 size-72" />}
        <p className="font-medium">Escaneá y mirá nuestros productos</p>
        <p className="mt-1 break-all text-sm opacity-70">{siteUrl(biz.slug).replace(/^https?:\/\//, "")}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3 print:hidden">
        {png && <a href={png} download={`qr-${biz.slug}.png`} className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground" data-testid="qr-download">Descargar PNG</a>}
        <Button variant="outline" onClick={() => window.print()}>Imprimir o guardar PDF</Button>
      </div>
    </section>
  );
}
