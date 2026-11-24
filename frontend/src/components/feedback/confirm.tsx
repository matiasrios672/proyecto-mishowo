"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Acciones que no se pueden deshacer: el botón se pinta de rojo. */
  danger?: boolean;
}
interface Pending extends ConfirmOptions { resolve: (ok: boolean) => void }

let pending: Pending | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** «¿Estás seguro?» accesible. Devuelve true si la persona confirma. Sin pantalla (tests de servidor) confirma solo. */
export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(true);
  pending?.resolve(false);
  return new Promise<boolean>((resolve) => { pending = { ...opts, resolve }; emit(); });
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

/** Ventana de confirmación (usa <dialog>: foco atrapado y Escape cancelan de fábrica). Va una sola vez en el marco de la app. */
export function ConfirmHost() {
  const p = useSyncExternalStore(subscribe, () => pending, () => null);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (p && !d.open) d.showModal();
    if (!p && d.open) d.close();
  }, [p]);
  const answer = (ok: boolean) => { const cur = pending; pending = null; emit(); cur?.resolve(ok); };
  return (
    <dialog ref={ref} aria-labelledby="confirm-title" aria-describedby="confirm-msg" data-testid="confirm-dialog"
      onCancel={(e) => { e.preventDefault(); answer(false); }}
      onClick={(e) => { if (e.target === ref.current) answer(false); }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-[#E5E7EB] bg-white p-0 text-[#0E1B2C] shadow-2xl backdrop:bg-[#0E1B2C]/50">
      {p && (
        <div className="space-y-4 p-6">
          <h2 id="confirm-title" className="text-xl font-extrabold leading-tight">{p.title}</h2>
          {p.message && <p id="confirm-msg" className="text-[15px] text-[#47566A]">{p.message}</p>}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" autoFocus onClick={() => answer(false)} className="min-h-11 rounded-xl border border-[#D1D5DB] px-5 font-semibold hover:bg-[#F1F3F5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{p.cancelLabel ?? "Cancelar"}</button>
            <button type="button" onClick={() => answer(true)} data-testid="confirm-yes"
              className={`min-h-11 rounded-xl px-5 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${p.danger ? "bg-[#B42318] text-white hover:bg-[#912018]" : "bg-[#1F2937] text-white hover:bg-[#111827]"}`}>{p.confirmLabel ?? "Confirmar"}</button>
          </div>
        </div>
      )}
    </dialog>
  );
}
