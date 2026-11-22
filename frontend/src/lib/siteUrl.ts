// URL pública de la página de un negocio: https://tunegocio.mishowo.com (en desarrollo: http://tunegocio.localhost:3000).
const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const SCHEME = process.env.NEXT_PUBLIC_ROOT_SCHEME ?? "http";

export const siteUrl = (slug: string) => `${SCHEME}://${slug}.${ROOT}`;
export const siteHost = (slug: string) => `${slug}.${ROOT.replace(/:\d+$/, "")}`;

/** Sugerencia de link a partir del nombre: sin tildes, en minúsculas, con guiones, máx. 30 caracteres. */
export function suggestSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}
