import { NextResponse, type NextRequest } from "next/server";
import { tenantFromHost } from "@/lib/tenant";

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "localhost";

// Next 16: "proxy" reemplaza a "middleware". Resuelve el negocio por subdominio.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = tenantFromHost(request.headers.get("host"), ROOT_DOMAIN);

  if (host.kind === "tenant") {
    const url = request.nextUrl.clone();
    // Evita que un visitante pida /sites/otro-negocio dentro del subdominio de otro.
    if (pathname.startsWith("/sites/")) return NextResponse.rewrite(new URL("/_not-found", request.url));
    url.pathname = `/sites/${host.slug}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  // En el dominio principal, /sites/* es interno: no se expone directamente.
  if (pathname.startsWith("/sites/")) return NextResponse.rewrite(new URL("/_not-found", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|webp|ico|txt|xml)$).*)"],
};
