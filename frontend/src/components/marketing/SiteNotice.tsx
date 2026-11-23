import { Suspense } from "react";
import Link from "next/link";
import { getSiteConfig } from "@/lib/siteConfig";

async function Notice() {
  const { banner, maintenance } = await getSiteConfig();
  if (!banner && !maintenance) return null;
  return (
    <div data-testid="site-notices">
      {maintenance && (
        <p role="status" className="bg-amber-100 px-4 py-2.5 text-center text-sm font-semibold text-amber-950" data-testid="maintenance-notice">
          En mantenimiento: {maintenance.message} Por ahora no se pueden crear cuentas nuevas.
        </p>
      )}
      {banner && (
        <p className="bg-[#2F6FB0] px-4 py-2.5 text-center text-sm font-semibold text-white" data-testid="global-banner">
          {banner.link ? (
            <Link href={banner.link} className="" {...(banner.link.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{banner.text}</Link>
          ) : banner.text}
        </p>
      )}
    </div>
  );
}

/** Aviso global y de mantenimiento arriba de todo. Sin nada cargado no ocupa lugar. */
export function SiteNotice() {
  return <Suspense fallback={null}><Notice /></Suspense>;
}
