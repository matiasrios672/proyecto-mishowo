export const RESERVED_SLUGS = new Set([
  "admin", "www", "api", "app", "mail", "smtp", "ftp", "static", "assets", "cdn", "blog", "ayuda",
  "help", "soporte", "support", "login", "registro", "signup", "dashboard", "panel", "editor",
  "mishowo", "coolify", "status", "test", "demo", "ejemplo", "root", "billing", "pagos",
]);

// Lista mínima de palabras ofensivas; se amplía desde el admin (Épica 13).
const BLOCKED_WORDS = ["puto", "puta", "mierda", "nazi", "pedofil", "porno", "sexo"];

export type SlugCheck = { ok: true; slug: string } | { ok: false; reason: "formato" | "reservado" | "prohibido" };

const FORMAT = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

export function normalizeSlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}

export function checkSlug(input: string, extraReserved: Iterable<string> = []): SlugCheck {
  const slug = input.trim().toLowerCase();
  if (!FORMAT.test(slug) || slug.includes("--")) return { ok: false, reason: "formato" };
  if (RESERVED_SLUGS.has(slug) || new Set(extraReserved).has(slug)) return { ok: false, reason: "reservado" };
  if (BLOCKED_WORDS.some((w) => slug.includes(w))) return { ok: false, reason: "prohibido" };
  return { ok: true, slug };
}
