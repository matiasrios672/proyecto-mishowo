// Detecta el tipo REAL de un archivo por sus primeros bytes. Nunca se confía en la extensión ni en el
// Content-Type que manda el cliente: un .exe renombrado a .png no pasa.
export interface Sniffed { mime: string; ext: string; kind: "image" | "video" | "document" }

const at = (b: Buffer, offset: number, bytes: number[]) => bytes.every((v, i) => b[offset + i] === v);
const ascii = (b: Buffer, offset: number, s: string) => b.length >= offset + s.length && b.subarray(offset, offset + s.length).toString("latin1") === s;

export function sniff(b: Buffer): Sniffed | null {
  if (b.length < 12) return null;
  if (at(b, 0, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg", kind: "image" };
  if (at(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png", kind: "image" };
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) return { mime: "image/webp", ext: "webp", kind: "image" };
  if (ascii(b, 0, "%PDF-")) return { mime: "application/pdf", ext: "pdf", kind: "document" };
  if (at(b, 0, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: "video/webm", ext: "webm", kind: "video" };
  if (ascii(b, 4, "ftyp")) {
    const brand = b.subarray(8, 12).toString("latin1");
    return brand.startsWith("qt") ? { mime: "video/quicktime", ext: "mov", kind: "video" } : { mime: "video/mp4", ext: "mp4", kind: "video" };
  }
  return null;
}
