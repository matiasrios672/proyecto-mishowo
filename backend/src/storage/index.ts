import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";

/** Interfaz de almacenamiento: hoy disco (volumen persistente); mañana S3/R2/MinIO sin tocar el resto del código. */
export interface StorageProvider {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

export class DiskStorage implements StorageProvider {
  constructor(private readonly root: string) {}

  /** Resuelve la ruta y garantiza que no se escape de la carpeta raíz (ej. con "../"). */
  private path(key: string): string {
    const full = normalize(join(this.root, key));
    const root = normalize(this.root + sep);
    if (!full.startsWith(root) || key.includes("\0")) throw new Error("Clave de archivo inválida");
    return full;
  }

  async put(key: string, data: Buffer) {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
  }

  async get(key: string) {
    try { return await readFile(this.path(key)); } catch { return null; }
  }

  async delete(key: string) {
    await rm(this.path(key), { force: true });
  }
}
