import type { Config } from "../config.js";
import { WIDTHS } from "./image.js";

export interface MediaUrls { src: string; srcSet: string | null }

/** URLs absolutas de un archivo del negocio. Las fotos traen srcset (400/800/1600 px); los videos, solo la URL. */
export function mediaUrls(config: Pick<Config, "API_PUBLIC_URL">, path: string, kind: string): MediaUrls {
  const base = `${config.API_PUBLIC_URL.replace(/\/$/, "")}/uploads/${path}`;
  if (kind === "video") return { src: base, srcSet: null };
  return { src: `${base}-800.webp`, srcSet: WIDTHS.map((w) => `${base}-${w}.webp ${w}w`).join(", ") };
}

export const CONTENT_TYPES: Record<string, string> = { webp: "image/webp", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
/** Solo se sirve lo que MiShowo generó: 16 hex del hash + tamaño .webp, o el video con su extensión. Nada más. */
export const PUBLIC_FILE = /^[a-f0-9]{16}(?:-(?:400|800|1600)\.webp|\.(?:mp4|webm|mov))$/;
