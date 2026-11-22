import sharp from "sharp";

// Anchos que se generan de cada foto (WebP). Se sirven con srcset para que cada pantalla baje solo lo que necesita.
export const WIDTHS = [400, 800, 1600] as const;
export const MAX_PIXELS = 40_000_000; // ~8000 x 5000: más que eso es casi seguro una imagen-bomba

export class ImageError extends Error {
  constructor(public code: "image_too_large" | "invalid_image") { super(code); }
}

export interface Variant { width: number; data: Buffer }

/**
 * Procesa una foto subida: aplica la orientación del EXIF, **borra todos los metadatos** (incluida la ubicación GPS
 * de las fotos del celular), y la convierte a WebP en varios tamaños. Nunca agranda una imagen chica.
 */
export async function processImage(input: Buffer): Promise<{ variants: Variant[]; width: number; height: number }> {
  try {
    const base = () => sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" }).rotate(); // rotate() sin argumentos = respetar el EXIF
    const { info } = await base().toBuffer({ resolveWithObject: true });
    const variants: Variant[] = [];
    for (const w of WIDTHS) {
      // Sin .withMetadata(): sharp descarta EXIF, XMP e IPTC por defecto.
      const data = await base().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toBuffer();
      variants.push({ width: w, data });
    }
    return { variants, width: info.width, height: info.height };
  } catch (e) {
    if (e instanceof Error && /pixel limit/i.test(e.message)) throw new ImageError("image_too_large");
    throw new ImageError("invalid_image");
  }
}

export const variantKey = (base: string, width: number) => `${base}-${width}.webp`;
