/* eslint-disable @next/next/no-img-element -- las fotos ya salen del backend en WebP con srcset propio */
"use client";

import { useCallback, useEffect, useState } from "react";
import { Section } from "@/components/ui/fields";
import { api, apiUpload } from "@/lib/authClient";
import type { TabProps } from "./types";

interface MediaItem { id: string; kind: "image" | "video"; productId: string | null; src: string; srcSet: string | null }

const ERR: Record<string, string> = {
  photo_limit: "Llegaste al máximo de fotos de tu plan en este lugar. Borrá una o pasate a un plan con más fotos.",
  video_limit: "Ya tenés un video. Borrá el actual para subir otro.",
  file_too_large: "El archivo pesa más que el máximo de tu plan. Probá con uno más liviano.",
  unsupported_file: "Ese archivo no sirve. Subí una foto JPG, PNG o WebP, o un video MP4, MOV o WebM.",
  invalid_image: "No pudimos leer esa foto. Probá con otra.",
  image_too_large: "Esa foto es demasiado grande en píxeles. Probá con una más chica.",
  sync_first: "Todavía se está guardando el producto. Esperá un segundo y probá de nuevo.",
  network: "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.",
};

function Gallery({ title, hint, items, accept, busy, error, onAdd, onRemove }: {
  title: string; hint: string; items: MediaItem[]; accept: string; busy: boolean; error: string | null;
  onAdd: (f: File) => void; onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border p-3" data-testid="gallery">
      <p className="font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <ul className="flex flex-wrap gap-2">
        {items.map((m) => (
          <li key={m.id} className="group relative">
            {m.kind === "video"
              ? <video src={m.src} muted playsInline preload="metadata" className="size-20 rounded-lg object-cover" aria-label="Video" />
              : <img src={m.src} alt="" className="size-20 rounded-lg object-cover" />}
            <button type="button" aria-label="Borrar este archivo" onClick={() => onRemove(m.id)}
              className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-destructive text-xs text-white shadow">×</button>
          </li>
        ))}
        <li>
          <label className={`grid size-20 cursor-pointer place-items-center rounded-lg border-2 border-dashed text-center text-xs ${busy ? "opacity-50" : "hover:bg-muted"}`}>
            {busy ? "Subiendo…" : "+ Subir"}
            <input type="file" accept={accept} className="sr-only" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onAdd(f); }} />
          </label>
        </li>
      </ul>
      {error && <p role="alert" className="text-sm text-destructive">{ERR[error] ?? "No se pudo subir. Probá de nuevo."}</p>}
    </div>
  );
}

export function FotosTab({ draft, account }: TabProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const enabled = account?.enabled ?? false;

  const load = useCallback(async () => {
    const r = await api<{ media: MediaItem[] }>("/me/media");
    if (r.ok) setMedia(r.data.media);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    api<{ media: MediaItem[] }>("/me/media").then((r) => { if (alive && r.ok) setMedia(r.data.media); });
    return () => { alive = false; };
  }, [enabled]);

  if (!enabled)
    return (
      <Section title="Fotos y videos" description="Las fotos hacen que vendas más.">
        <div className="rounded-xl border border-dashed p-5 text-sm">
          <p className="font-medium">Para subir fotos necesitás una cuenta.</p>
          <p className="mt-1 text-muted-foreground">Podés armar todo tu catálogo sin cuenta. Cuando guardes tu página, vas a poder subir fotos y videos de tu portada y de cada producto.</p>
        </div>
      </Section>
    );

  async function add(key: string, target: string, file: File) {
    setBusy(key); setErrors((e) => ({ ...e, [key]: null }));
    await account!.settle(); // el producto tiene que existir en el servidor antes de colgarle una foto
    const r = await apiUpload(`/me/media?${target}`, file);
    setBusy(null);
    if (!r.ok) return setErrors((e) => ({ ...e, [key]: r.data.error ?? "network" }));
    await load();
  }
  async function remove(key: string, id: string) {
    const r = await api(`/me/media/${id}`, { method: "DELETE" });
    if (!r.ok) return setErrors((e) => ({ ...e, [key]: "network" }));
    await load();
  }

  const products = draft.categories.flatMap((c) => c.products).filter((p) => !p.isExample);
  const cover = media.filter((m) => m.productId === null);
  return (
    <Section title="Fotos y videos" description="Las fotos hacen que vendas más. Las achicamos y les sacamos los datos de ubicación automáticamente.">
      <Gallery title="Portada" hint="Hasta 5 fotos y 1 video (JPG, PNG, WebP, MP4, MOV o WebM). Se muestra arriba de todo en tu página."
        items={cover} accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" busy={busy === "cover"} error={errors.cover ?? null}
        onAdd={(f) => void add("cover", "kind=cover", f)} onRemove={(id) => void remove("cover", id)} />
      {products.length === 0 && <p className="text-sm text-muted-foreground">Cuando cargues productos, vas a poder ponerle fotos a cada uno.</p>}
      {products.map((p) => (
        <Gallery key={p.id} title={p.name || "Producto sin nombre"} hint="La primera foto es la que se ve en el catálogo."
          items={media.filter((m) => m.productId === p.id)} accept="image/jpeg,image/png,image/webp" busy={busy === p.id} error={errors[p.id] ?? null}
          onAdd={(f) => void add(p.id, `productId=${encodeURIComponent(p.id)}`, f)} onRemove={(id) => void remove(p.id, id)} />
      ))}
    </Section>
  );
}
