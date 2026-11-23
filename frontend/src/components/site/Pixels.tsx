"use client";

import Script from "next/script";

const META = /^\d{8,20}$/;
const GA = /^G-[A-Z0-9]{6,14}$/;

/**
 * Medición de campañas del negocio (Pixel de Meta y Google Analytics 4). Solo se arma con IDs que pasan el formato:
 * nunca se inserta texto libre de nadie en un script. El servidor solo manda los IDs si el plan incluye el módulo.
 */
export function Pixels({ meta, ga }: { meta?: string; ga?: string }) {
  const okMeta = !!meta && META.test(meta);
  const okGa = !!ga && GA.test(ga);
  if (!okMeta && !okGa) return null;
  return (
    <>
      {okGa && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="mk-ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga}',{anonymize_ip:true});`}</Script>
        </>
      )}
      {okMeta && (
        <Script id="mk-meta" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${meta}');fbq('track','PageView');`}</Script>
      )}
    </>
  );
}
