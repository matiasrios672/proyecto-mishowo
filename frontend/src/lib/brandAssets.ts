import { readFile } from "node:fs/promises";
import path from "node:path";

/** Imagen de /public/brand como data URI, para usarla dentro de imágenes generadas (Open Graph). Devuelve null si no se encuentra. */
export async function brandDataUri(file: "logo.png" | "logo-claro.png" | "isotipo.png"): Promise<string | null> {
  try {
    const buf = await readFile(path.join(process.cwd(), "public", "brand", file));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch { return null; }
}
