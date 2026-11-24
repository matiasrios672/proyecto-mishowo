"use client";

import { dismissToast, useToasts, type ToastKind } from "./toastStore";

const STYLE: Record<ToastKind, { bar: string; icon: string; label: string }> = {
  success: { bar: "border-l-[#15803D]", icon: "✓", label: "Listo" },
  error: { bar: "border-l-[#B42318]", icon: "!", label: "Error" },
  info: { bar: "border-l-[#FC5502]", icon: "i", label: "Aviso" },
};

/** Avisos emergentes arriba a la derecha. Errores con `role=alert`, el resto con `role=status`. */
export function Toaster() {
  const toasts = useToasts();
  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[100] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2 sm:right-5 sm:top-5" data-testid="toaster">
      {toasts.map((t) => {
        const s = STYLE[t.kind];
        return (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"} data-testid="toast" data-kind={t.kind}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border border-[#E5E7EB] border-l-4 ${s.bar} bg-white p-3.5 text-[15px] text-[#0E1B2C] shadow-[0_18px_40px_-18px_rgba(14,27,44,0.45)] motion-safe:animate-[toast-in_.22s_ease-out]`}>
            <span aria-hidden className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-extrabold text-white ${t.kind === "success" ? "bg-[#15803D]" : t.kind === "error" ? "bg-[#B42318]" : "bg-[#C73E00]"}`}>{s.icon}</span>
            <p className="min-w-0 flex-1 break-words"><span className="sr-only">{s.label}: </span>{t.text}</p>
            <button type="button" onClick={() => dismissToast(t.id)} aria-label="Cerrar aviso"
              className="-m-1.5 grid size-9 shrink-0 place-items-center rounded-lg text-[#47566A] hover:bg-[#F1F3F5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">×</button>
          </div>
        );
      })}
    </div>
  );
}
