// Extracción de color de marca desde un logo. Sin IA ni servicios externos: se cuentan los píxeles
// por "balde" de color en el navegador y se elige el más presente, ignorando fondo blanco/negro/gris.

function toHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function saturation(r: number, g: number, b: number) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/** `data` es RGBA plano (como ImageData.data). Devuelve #RRGGBB o null si no hay un color claro. */
export function dominantColor(data: ArrayLike<number>): string | null {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!, a = data[i + 3]!;
    if (a < 128) continue; // transparente
    if (r > 240 && g > 240 && b > 240) continue; // casi blanco
    if (r < 25 && g < 25 && b < 25) continue; // casi negro
    if (saturation(r, g, b) < 0.25) continue; // grises
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const cur = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    cur.n++; cur.r += r; cur.g += g; cur.b += b;
    buckets.set(key, cur);
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const v of buckets.values()) if (!best || v.n > best.n) best = v;
  if (!best || best.n < 3) return null;
  return toHex(best.r / best.n, best.g / best.n, best.b / best.n);
}

/** Navegador: lee una imagen subida, la reduce y devuelve su color dominante. */
export async function extractBrandColor(file: Blob): Promise<string | null> {
  const bmp = await createImageBitmap(file);
  const size = 64;
  const scale = Math.min(1, size / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return dominantColor(ctx.getImageData(0, 0, w, h).data);
}
