import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { DiskStorage } from "./index.js";
import { sniff } from "./sniff.js";

const pad = (head: number[], extra = 16) => Buffer.concat([Buffer.from(head), Buffer.alloc(extra)]);

describe("sniff: el tipo real sale de los bytes, no del nombre", () => {
  it("reconoce imágenes, PDF y videos", () => {
    expect(sniff(pad([0xff, 0xd8, 0xff, 0xe0]))).toMatchObject({ mime: "image/jpeg", kind: "image" });
    expect(sniff(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toMatchObject({ mime: "image/png", ext: "png" });
    expect(sniff(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 "), Buffer.alloc(8)]))).toMatchObject({ mime: "image/webp" });
    expect(sniff(Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(16)]))).toMatchObject({ mime: "application/pdf", kind: "document" });
    expect(sniff(pad([0x1a, 0x45, 0xdf, 0xa3]))).toMatchObject({ mime: "video/webm", kind: "video" });
    expect(sniff(Buffer.concat([Buffer.alloc(4), Buffer.from("ftypisom"), Buffer.alloc(8)]))).toMatchObject({ mime: "video/mp4" });
    expect(sniff(Buffer.concat([Buffer.alloc(4), Buffer.from("ftypqt  "), Buffer.alloc(8)]))).toMatchObject({ mime: "video/quicktime", ext: "mov" });
  });
  it("rechaza ejecutables, scripts, HTML, SVG y archivos truncados", () => {
    expect(sniff(Buffer.concat([Buffer.from("MZ"), Buffer.alloc(30)]))).toBeNull(); // .exe
    expect(sniff(Buffer.from("<script>alert(1)</script>"))).toBeNull();
    expect(sniff(Buffer.from("<html><body>hola</body></html>"))).toBeNull();
    expect(sniff(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).toBeNull(); // el SVG puede traer scripts
    expect(sniff(Buffer.from("texto cualquiera de más de doce bytes"))).toBeNull();
    expect(sniff(Buffer.from([0xff, 0xd8]))).toBeNull(); // muy corto
  });
});

describe("DiskStorage", () => {
  let dir: string;
  const ready = mkdtemp(join(tmpdir(), "mishowo-st-")).then((d) => { dir = d; return new DiskStorage(d); });
  afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

  it("guarda, lee y borra", async () => {
    const st = await ready;
    await st.put("receipts/a.png", Buffer.from("hola"));
    expect((await st.get("receipts/a.png"))?.toString()).toBe("hola");
    await st.delete("receipts/a.png");
    expect(await st.get("receipts/a.png")).toBeNull();
    await st.delete("receipts/no-existe.png"); // borrar algo que no está no falla
  });
  it("no deja escapar de la carpeta con ../ ni con bytes nulos", async () => {
    const st = await ready;
    for (const key of ["../fuera.txt", "receipts/../../fuera.txt", "a\0b.png"]) await expect(st.put(key, Buffer.from("x")), key).rejects.toThrow();
    expect(await st.get("../../etc/passwd")).toBeNull();
  });
  it("una ruta que parece absoluta queda adentro de la carpeta, no en la raíz del disco", async () => {
    const st = await ready;
    await st.put("/etc/mishowo-prueba", Buffer.from("adentro"));
    expect((await readFile(join(dir, "etc", "mishowo-prueba"))).toString()).toBe("adentro");
  });
});
