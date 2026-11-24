"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Tamaños reales: un celular de 390 px de ancho y una ventana de navegador de 1280. La pantalla se escala para entrar completa. */
const PHONE = { w: 390, h: 800, bezel: 11, bar: 34 };
const DESK = { w: 1280, h: 760, bar: 46 };

/**
 * Vista previa con aspecto de dispositivo real. El sitio se dibuja al ancho verdadero del aparato (sus @container responden a ese ancho,
 * no al del editor), se desplaza por dentro como en un celular y sus elementos fijos (barra del carrito, botón de WhatsApp, cajones)
 * quedan dentro de la pantalla: el contenedor con transform es su bloque de referencia.
 */
export function DeviceFrame({ device, url = "tunegocio.mishowo.com", children }: { device: "celular" | "computadora"; url?: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const phone = device === "celular";
  const natW = phone ? PHONE.w + PHONE.bezel * 2 : DESK.w;
  const natH = phone ? PHONE.h + PHONE.bezel * 2 : DESK.h + DESK.bar;
  const scale = size.w > 0 && size.h > 0 ? Math.max(0.25, Math.min(1, (size.w - 32) / natW, (size.h - 32) / natH)) : 1;

  return (
    <div ref={box} className="absolute inset-0 grid place-items-center overflow-hidden">
      <div className="relative shrink-0" style={{ width: natW * scale, height: natH * scale }}>
        <div data-testid="preview-frame" data-device={device} className="absolute left-0 top-0" style={{ width: natW, height: natH, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {phone ? (
            <div className="h-full w-full rounded-[3.4rem] bg-[#151B2B] p-[11px] shadow-[0_40px_70px_-30px_rgba(21,27,43,0.65),inset_0_0_0_2px_rgba(255,255,255,0.08)]">
              <div className="relative h-full w-full overflow-hidden rounded-[2.7rem] bg-white">
                <div aria-hidden className="absolute inset-x-0 top-0 z-20 flex h-[34px] items-center justify-between bg-white/90 px-7 text-[13px] font-semibold text-[#151B2B] backdrop-blur">
                  <span>9:41</span>
                  <span className="absolute left-1/2 top-[7px] h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-[#0A0E18]" />
                  <span className="flex items-center gap-1.5">
                    <svg viewBox="0 0 18 12" className="h-3" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5" width="3" height="7" rx="1" /><rect x="10" y="2.5" width="3" height="9.5" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
                    <svg viewBox="0 0 26 12" className="h-3" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="22" height="11" rx="3.5" opacity=".4" /><rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor" stroke="none" /><rect x="23.5" y="4" width="2" height="4" rx="1" fill="currentColor" stroke="none" opacity=".4" /></svg>
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 top-[34px] overflow-hidden bg-background" style={{ transform: "translateZ(0)" }}>
                  <div className="absolute inset-0 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>
                </div>
                <span aria-hidden className="pointer-events-none absolute bottom-2 left-1/2 z-20 h-1 w-32 -translate-x-1/2 rounded-full bg-[#151B2B]/80" />
              </div>
            </div>
          ) : (
            <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[#D5D9E2] bg-white shadow-[0_40px_70px_-30px_rgba(21,27,43,0.5)]">
              <div aria-hidden className="flex shrink-0 items-center gap-4 border-b border-[#E5E8EF] bg-[#F3F4F8] px-5" style={{ height: DESK.bar }}>
                <span className="flex gap-2"><i className="size-3 rounded-full bg-[#FF5F57]" /><i className="size-3 rounded-full bg-[#FEBC2E]" /><i className="size-3 rounded-full bg-[#28C840]" /></span>
                <span className="mx-auto flex h-8 w-[46%] items-center justify-center gap-2 rounded-lg bg-white text-[13px] font-medium text-[#5B6577] shadow-sm">
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg>
                  {url}
                </span>
                <span className="w-[52px]" />
              </div>
              <div className="relative min-h-0 flex-1 overflow-hidden bg-background" style={{ transform: "translateZ(0)" }}>
                <div className="absolute inset-0 overflow-y-auto overscroll-contain">{children}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
