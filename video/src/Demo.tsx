import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, display, text } from "./brand";

export const DURATION = 450;

/** Aparece al empezar y se desvanece al terminar: así las escenas se funden entre sí. */
const Fade = ({ children, frames, edge = 10 }: { children: ReactNode; frames: number; edge?: number }) => {
  const f = useCurrentFrame();
  const opacity = interpolate(f, [0, edge, frames - edge, frames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

const useIn = (delay: number, damping = 200) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
};

/** Sol: círculo con rayos que giran despacio. Es el símbolo de la marca. */
const Sun = ({ size, style }: { size: number; style?: CSSProperties }) => {
  const f = useCurrentFrame();
  const rays = Array.from({ length: 16 }, (_, i) => i);
  return (
    <svg width={size} height={size} viewBox="-100 -100 200 200" style={style}>
      <g transform={`rotate(${f * 0.35})`}>
        {rays.map((i) => (
          <path key={i} d={i % 2 ? "M0 -62 L6 -96 L-6 -96Z" : "M0 -62 L4 -84 L-4 -84Z"} fill={C.sol} transform={`rotate(${(i * 360) / 16})`} />
        ))}
      </g>
      <circle r="52" fill={C.sol} />
    </svg>
  );
};

/** Celular con una página de negocio adentro. */
const Phone = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ width: 330, height: 640, borderRadius: 46, background: C.tinta, padding: 12, boxShadow: "0 40px 80px rgba(14,27,44,0.28)", ...style }}>
    <div style={{ width: "100%", height: "100%", borderRadius: 36, overflow: "hidden", position: "relative", background: C.blanco }}>{children}</div>
  </div>
);

const THEMES = [
  { name: "Terracota", bg: "#FBF1EC", fg: "#3A1F16", primary: "#AE432A", muted: "#6A4538", card: "#FFFFFF" },
  { name: "Glaciar", bg: "#F0F6FA", fg: "#0F2433", primary: "#1B6390", muted: "#40596B", card: "#FFFFFF" },
  { name: "Carbón", bg: "#1A1A1A", fg: "#F2F2F2", primary: "#F5C542", muted: "#B5B5B5", card: "#242424" },
];
const ITEMS: [string, string][] = [["Empanada de carne", "$ 1.800"], ["Jamón y queso", "$ 1.700"], ["Milanesa napolitana", "$ 9.500"]];

const rise = (p: number, dist = 46): CSSProperties => ({ opacity: p, transform: `translateY(${(1 - p) * dist}px)` });

/* ───────── Escena 1: el nombre del negocio ───────── */
const Scene1 = () => {
  const l1 = useIn(4, 18);
  const l2 = useIn(14, 18);
  const sub = useIn(34);
  const sun = useIn(0, 30);
  return (
    <AbsoluteFill style={{ background: C.cielo }}>
      <Sun size={620} style={{ position: "absolute", right: -120, top: 40 + (1 - sun) * 260, opacity: 0.95 }} />
      <div style={{ position: "absolute", left: 96, top: 170, fontFamily: display, color: C.tinta }}>
        <div style={{ fontSize: 132, fontWeight: 800, lineHeight: 1, letterSpacing: -3, ...rise(l1) }}>Tu negocio,</div>
        <div style={{ fontSize: 132, fontWeight: 800, lineHeight: 1, letterSpacing: -3, color: C.celesteDeep, ...rise(l2) }}>en un link.</div>
        <div style={{ marginTop: 34, fontFamily: text, fontSize: 34, fontWeight: 400, maxWidth: 640, lineHeight: 1.3, ...rise(sub, 30) }}>
          La página de tu negocio, lista desde el celular en minutos.
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Step = ({ label, delay }: { label: string; delay: number }) => {
  const p = useIn(delay);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 26, opacity: p, transform: `translateX(${(1 - p) * -40}px)` }}>
      <span style={{ width: 22, height: 22, borderRadius: 11, background: C.sol }} />
      <span style={{ fontSize: 54, fontWeight: 700, letterSpacing: -1 }}>{label}</span>
    </div>
  );
};

/* ───────── Escena 2: la página se arma ───────── */
const Scene2 = () => {
  const f = useCurrentFrame();
  const phone = useIn(0, 16);
  const idx = Math.min(THEMES.length - 1, Math.floor(Math.max(0, f - 62) / 30));
  const theme = THEMES[idx]!;
  const fresh = Math.max(0, f - 62) % 30;
  const pulse = f >= 62 && fresh < 8 ? 1 + (1 - fresh / 8) * 0.04 : 1;
  const typed = "Empanadas de Lupe".slice(0, Math.max(0, Math.floor((f - 10) / 1.6)));
  return (
    <AbsoluteFill style={{ background: C.celeste }}>
      <div style={{ position: "absolute", left: 96, top: 190, fontFamily: display, color: C.tinta }}>
        <Step label="Elegís tu rubro" delay={18} />
        <Step label="Cambiás colores y estilo" delay={40} />
        <Step label="Cargás tus productos" delay={62} />
      </div>
      <Phone style={{ position: "absolute", right: 150, top: 20 + (1 - phone) * 700, transform: `scale(${pulse})` }}>
        <div style={{ position: "absolute", inset: 0, background: theme.bg, color: theme.fg, fontFamily: text, padding: 26 }}>
          <div style={{ fontFamily: display, fontSize: 34, fontWeight: 800, lineHeight: 1.05, minHeight: 74, marginTop: 24 }}>
            {typed}
            <span style={{ opacity: f % 16 < 8 ? 1 : 0 }}>|</span>
          </div>
          <div style={{ fontSize: 15, color: theme.muted, marginTop: 6 }}>Hechas hoy, calentitas siempre</div>
          <div style={{ marginTop: 18, display: "inline-block", background: theme.primary, color: theme.bg, borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 15 }}>Hacer mi pedido</div>
          <div style={{ marginTop: 26, background: theme.card, borderRadius: 8, padding: 18, boxShadow: "0 12px 24px rgba(0,0,0,0.12)", transform: "rotate(-1.4deg)" }}>
            {ITEMS.map(([n, p], i) => {
              const r = interpolate(f, [34 + i * 8, 42 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div key={n} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 15, padding: "7px 0", opacity: r, clipPath: `inset(0 0 ${(1 - r) * 100}% 0)` }}>
                  <span style={{ fontWeight: 600 }}>{n}</span>
                  <span style={{ flex: 1, borderBottom: `2px dotted ${theme.fg}`, opacity: 0.25, alignSelf: "flex-end", marginBottom: 5 }} />
                  <span style={{ fontWeight: 700 }}>{p}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Phone>
      <div style={{ position: "absolute", right: 150, top: 668, width: 330, textAlign: "center", fontFamily: text, fontWeight: 700, fontSize: 22, color: C.tinta, opacity: f > 62 ? 1 : 0 }}>
        Estilo: {theme.name}
      </div>
    </AbsoluteFill>
  );
};

/* ───────── Escena 3: el pedido llega por WhatsApp ───────── */
const Scene3 = () => {
  const f = useCurrentFrame();
  const phone = useIn(0, 18);
  const chat = useIn(54, 16);
  const chip = useIn(100, 12);
  const taps = [18, 34];
  const count = taps.filter((t) => f >= t).length;
  const bump = taps.some((t) => f >= t && f < t + 8) ? 1.12 : 1;
  const lines = ["Hola! Quiero hacer este pedido:", "Pedido #12", "• 2 x Empanada de carne — $ 3.600", "Total: $ 3.600"];
  const shown = Math.min(lines.length, Math.max(0, Math.floor((f - 62) / 9)));
  return (
    <AbsoluteFill style={{ background: C.cielo }}>
      <Phone style={{ position: "absolute", left: 130, top: 20 + (1 - phone) * 700 }}>
        <div style={{ position: "absolute", inset: 0, background: "#FBF1EC", color: "#3A1F16", fontFamily: text, padding: 26 }}>
          <div style={{ fontFamily: display, fontSize: 30, fontWeight: 800, marginTop: 24 }}>Nuestros productos</div>
          {ITEMS.slice(0, 2).map(([n, p], i) => {
            const tapped = f >= taps[i]!;
            const pressing = f >= taps[i]! && f < taps[i]! + 6;
            return (
              <div key={n} style={{ marginTop: 22, borderBottom: "1px solid #e6cfc4", paddingBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 17 }}><span>{n}</span><span>{p}</span></div>
                <div style={{ marginTop: 10, display: "inline-block", borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: 14, background: "#AE432A", color: "#FBF1EC", transform: `scale(${pressing ? 0.9 : 1})` }}>
                  {tapped ? "Agregado ✓" : "Agregar"}
                </div>
              </div>
            );
          })}
          {count > 0 && (
            <div style={{ position: "absolute", left: 18, right: 18, bottom: 18, background: "#AE432A", color: "#FBF1EC", borderRadius: 12, padding: "14px 18px", display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16, transform: `scale(${bump})` }}>
              <span>Ver mi pedido · {count} {count === 1 ? "producto" : "productos"}</span>
              <span>$ {(count * 1800).toLocaleString("es-AR")}</span>
            </div>
          )}
        </div>
      </Phone>

      <div style={{ position: "absolute", right: 110, top: 150, width: 560, opacity: chat, transform: `translateX(${(1 - chat) * 160}px)`, fontFamily: text }}>
        <div style={{ background: C.tinta, color: C.blanco, borderRadius: "20px 20px 0 0", padding: "18px 24px", fontWeight: 700, fontSize: 24 }}>Empanadas de Lupe</div>
        <div style={{ background: "#ECE5DD", padding: 24, minHeight: 250, borderRadius: "0 0 20px 20px" }}>
          <div style={{ background: C.wa, borderRadius: 16, padding: "16px 20px", fontSize: 23, lineHeight: 1.45, color: "#111" }}>
            {lines.slice(0, shown).map((l, i) => <div key={i} style={{ fontWeight: i === 1 || i === 3 ? 700 : 400 }}>{l}</div>)}
            {shown === 0 && <div style={{ opacity: 0.4 }}>…</div>}
            <div style={{ textAlign: "right", fontSize: 15, opacity: 0.55, marginTop: 6 }}>{shown >= 4 ? "✓✓" : ""}</div>
          </div>
        </div>
        <div style={{ marginTop: 26, display: "inline-flex", alignItems: "center", gap: 12, background: C.sol, color: C.tinta, borderRadius: 999, padding: "14px 26px", fontWeight: 700, fontSize: 25, opacity: chip, transform: `scale(${0.7 + chip * 0.3})` }}>
          <span style={{ width: 14, height: 14, borderRadius: 7, background: C.tinta }} />
          Pedido #12 registrado en tu panel
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ───────── Escena 4: cierre ───────── */
const Scene4 = () => {
  const f = useCurrentFrame();
  const a = useIn(2, 20);
  const b = useIn(16, 20);
  const c = useIn(34);
  const breathe = 1 + Math.sin(f / 9) * 0.015;
  return (
    <AbsoluteFill style={{ background: C.tinta, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <Sun size={360} style={{ position: "absolute", top: -90, transform: `scale(${breathe})`, opacity: 0.95 }} />
      <div style={{ marginTop: 190, fontFamily: display, color: C.blanco }}>
        <div style={{ fontSize: 108, fontWeight: 800, letterSpacing: -3, lineHeight: 1, ...rise(a, 40) }}>Creá tu página gratis</div>
        <div style={{ fontFamily: text, fontSize: 38, marginTop: 26, color: C.celeste, fontWeight: 600, ...rise(b, 40) }}>Sin tarjeta. Sin instalar nada.</div>
        <div style={{ marginTop: 44, display: "inline-block", background: C.sol, color: C.tinta, borderRadius: 18, padding: "20px 46px", fontSize: 46, fontWeight: 800, ...rise(c, 40) }}>mishowo.com</div>
      </div>
    </AbsoluteFill>
  );
};

export const Demo = () => (
  <AbsoluteFill style={{ background: C.tinta }}>
    <Sequence from={0} durationInFrames={115}><Fade frames={115}><Scene1 /></Fade></Sequence>
    <Sequence from={105} durationInFrames={145}><Fade frames={145}><Scene2 /></Fade></Sequence>
    <Sequence from={240} durationInFrames={125}><Fade frames={125}><Scene3 /></Fade></Sequence>
    <Sequence from={355} durationInFrames={DURATION - 355}><Fade frames={DURATION - 355} edge={8}><Scene4 /></Fade></Sequence>
  </AbsoluteFill>
);
