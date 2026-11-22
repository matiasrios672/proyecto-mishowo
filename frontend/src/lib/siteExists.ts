// ¿Existe y está publicado el negocio de este subdominio? Lo usa el proxy para responder 404 de verdad.
// (Dentro de la página no se puede: ahí el "no encontrado" se decide cuando el status 200 ya se envió.)
//
// Caché corto en memoria, en `globalThis` para que lo compartan el proxy y el endpoint de revalidación.

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TTL_MS = 15_000;
const MAX_ENTRIES = 2000; // evita que alguien inflando subdominios al azar haga crecer la memoria sin límite

type Entry = { exists: boolean; until: number };
const g = globalThis as { __siteExists?: Map<string, Entry> };
const cache = (g.__siteExists ??= new Map<string, Entry>());

export function forgetSite(slug: string) {
  cache.delete(slug);
}

export async function siteExists(slug: string, now = Date.now()): Promise<boolean> {
  const hit = cache.get(slug);
  if (hit && hit.until > now) return hit.exists;
  try {
    const res = await fetch(`${API}/public/sites/${encodeURIComponent(slug)}`, { signal: AbortSignal.timeout(1500) });
    // Solo se recuerdan las respuestas claras. Un error del servidor no se cachea ni se toma como "no existe".
    if (res.status !== 404 && !res.ok) return true;
    const exists = res.ok;
    if (cache.size >= MAX_ENTRIES) cache.clear();
    cache.set(slug, { exists, until: now + TTL_MS });
    return exists;
  } catch {
    return true; // sin backend no se bloquea a nadie: la página muestra su propio estado de error
  }
}
