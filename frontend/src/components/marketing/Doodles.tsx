import type { ReactNode } from "react";

// Íconos de línea fina de MiShowo: trazo de 1.75 px, esquinas redondeadas y un relleno translúcido del color de marca.
export type IconProps = { className?: string };

function Svg({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const tint = { fill: "currentColor", fillOpacity: 0.14, stroke: "none" } as const;

export const IconFood = ({ className }: IconProps) => (
  <Svg className={className}><path {...tint} d="M4 12h16a8 8 0 0 1-16 0Z" /><path d="M4 12h16a8 8 0 0 1-16 0ZM9 8c0-1.5 1-1.5 1-3M14 8c0-1.5 1-1.5 1-3" /></Svg>
);
export const IconShirt = ({ className }: IconProps) => (
  <Svg className={className}><path {...tint} d="m8 3-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0Z" /><path d="m8 3-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0Z" /></Svg>
);
export const IconSparkle = ({ className }: IconProps) => (
  <Svg className={className}><path {...tint} d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7Z" /><path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7ZM19 17v4M17 19h4" /></Svg>
);
export const IconDumbbell = ({ className }: IconProps) => (
  <Svg className={className}><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /><path {...tint} d="M5 7h3v10H5zM16 7h3v10h-3z" /></Svg>
);
export const IconChair = ({ className }: IconProps) => (
  <Svg className={className}><path {...tint} d="M7 3h10l1 9H6l1-9Z" /><path d="M7 3h10l1 9H6l1-9ZM5 12h14v3H5zM7 15l-1 6M17 15l1 6" /></Svg>
);
export const IconParty = ({ className }: IconProps) => (
  <Svg className={className}><path {...tint} d="m4 20 4-11 7 7-11 4Z" /><path d="m4 20 4-11 7 7-11 4ZM13 5l.5 2M18 8l-2 1M17 3l-1 1.5M20 13l-2-.5" /></Svg>
);
export const IconStore = ({ className }: IconProps) => (
  <Svg className={className}><path {...tint} d="M4 10v10h16V10" /><path d="M3 9 5 4h14l2 5c0 1.7-1.3 3-3 3s-3-1.3-3-3c0 1.7-1.3 3-3 3s-3-1.3-3-3c0 1.7-1.3 3-3 3S3 10.700 3 9ZM4 12v8h16v-8M10 20v-5h4v5" /></Svg>
);
export const IconChat = ({ className }: IconProps) => (
  <Svg className={className}><path {...tint} d="M4 5h16v11H9l-5 4V5Z" /><path d="M4 5h16v11H9l-5 4V5ZM8 9.500h8M8 12.500h5" /></Svg>
);
export const IconQr = ({ className }: IconProps) => (
  <Svg className={className}><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2M14 18h2v2h4v-2" /><path {...tint} d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" /></Svg>
);
export const IconChart = ({ className }: IconProps) => (
  <Svg className={className}><path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6" /><path {...tint} d="M7 12h2v4H7zM11 8h2v8h-2zM15 10h2v6h-2z" /></Svg>
);
export const IconBolt = ({ className }: IconProps) => (
  <Svg className={className}><path {...tint} d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z" /><path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z" /></Svg>
);
export const IconCheck = ({ className }: IconProps) => (
  <Svg className={className}><path d="m5 12.500 4.500 4.500L19 7.500" /></Svg>
);
export const IconCross = ({ className }: IconProps) => (
  <Svg className={className}><path d="m6 6 12 12M18 6 6 18" /></Svg>
);
export const IconLink = ({ className }: IconProps) => (
  <Svg className={className}><path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1" /></Svg>
);
export const IconGoogle = ({ className }: IconProps) => (
  <Svg className={className}><circle cx="11" cy="11" r="6.500" {...tint} /><circle cx="11" cy="11" r="6.500" /><path d="m16 16 4.500 4.500" /></Svg>
);

/** Puntero de mouse: lo usa la demo del hero para "hacer clic" en la página. */
export function Cursor({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path d="M4 3v15.500l4.300-3.800 2.900 6.300 2.600-1.200-2.900-6.200 5.700-.2L4 3Z" fill="#0E1B2C" stroke="#fff" strokeWidth={1.500} strokeLinejoin="round" />
    </svg>
  );
}

/** Subrayado de resaltador, translúcido, que se dibuja al cargar. */
export function Underline({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 20" preserveAspectRatio="none" aria-hidden className={className} fill="none">
      <path className="mk-draw" pathLength={1} d="M4 12c60-9 120-9 190-3s130 4 202-2" stroke="#74ACDF" strokeOpacity={0.55} strokeWidth={10} strokeLinecap="round" />
    </svg>
  );
}
