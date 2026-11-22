import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { forgetSite } from "@/lib/siteExists";

// El backend llama acá cuando cambia la página de un negocio, para que se vea al instante (sin esperar que venza el caché).
// Solo acepta pedidos con el secreto compartido (REVALIDATE_SECRET).
const SLUG = /^[a-z0-9-]{2,60}$/;

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  const given = request.headers.get("x-revalidate-secret") ?? "";
  if (!secret || secret.length < 16 || !sameSecret(given, secret)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { slug?: unknown } | null;
  if (typeof body?.slug !== "string" || !SLUG.test(body.slug)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  // expire: 0 -> la próxima visita trae datos frescos (no se sirve la versión vieja).
  revalidateTag(`site:${body.slug}`, { expire: 0 });
  forgetSite(body.slug); // y el proxy vuelve a preguntar si la página existe (publicar o despublicar cambia eso)
  return NextResponse.json({ ok: true });
}
