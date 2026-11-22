import type { ReactNode } from "react";

// Segundo set de íconos de línea (mismo estilo que Doodles.tsx): navegación del editor.
type IconProps = { className?: string };

function Svg({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const tint = { fill: "currentColor", fillOpacity: 0.14, stroke: "none" } as const;

export const IconImage = ({ className }: IconProps) => (
  <Svg className={className}><rect x="3" y="4" width="18" height="16" rx="3" {...tint} /><path d="M6 4h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3ZM3 16l5-5 4 4 3-3 6 6" /><circle cx="9" cy="9" r="1.5" fill="currentColor" /></Svg>
);
export const IconUndo = ({ className }: IconProps) => (
  <Svg className={className}><path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></Svg>
);
export const IconRedo = ({ className }: IconProps) => (
  <Svg className={className}><path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" /></Svg>
);
export const IconArrowLeft = ({ className }: IconProps) => (
  <Svg className={className}><path d="M19 12H5M11 6l-6 6 6 6" /></Svg>
);
export const IconArrowRight = ({ className }: IconProps) => (
  <Svg className={className}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
);
