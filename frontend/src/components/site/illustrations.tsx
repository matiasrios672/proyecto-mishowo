import type { ReactNode } from "react";

// Ilustraciones de producto para las páginas sin foto (demos, ejemplos y negocios que todavía no subieron las suyas).
// Se eligen por palabras clave del nombre. Son SVG livianos con sombra y luz suaves, para que una carta o un catálogo
// "de ejemplo" se vea como un producto real y no como un casillero vacío.

const shadow = <ellipse cx="50" cy="86" rx="30" ry="5" fill="#000" opacity="0.14" />;

const Empanada = (
  <g>
    {shadow}
    <path d="M14 70c0-26 18-44 40-44s34 16 34 44H14Z" fill="#D8923F" />
    <path d="M14 70c0-26 18-44 40-44s34 16 34 44" fill="none" stroke="#B5701F" strokeWidth="3" strokeLinecap="round" />
    <path d="M22 66c3-18 15-30 32-32 14 1 24 12 26 32Z" fill="#E7A957" />
    {Array.from({ length: 9 }, (_, i) => <circle key={i} cx={22 + i * 8.2} cy={70 - Math.abs(4.5 - i) * 1.1} r="3.2" fill="#C98230" />)}
    <path d="M30 52c6-8 14-12 24-12" stroke="#F4C78A" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8" />
  </g>
);

const Pizza = (
  <g>
    {shadow}
    <circle cx="50" cy="50" r="36" fill="#E3A24E" />
    <circle cx="50" cy="50" r="31" fill="#C9372C" />
    <circle cx="50" cy="50" r="28" fill="#F5D36B" />
    {[[38, 38], [58, 34], [64, 54], [44, 62], [30, 52], [52, 48]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" fill="#B3261E" />)}
    {[[48, 36], [60, 44], [38, 54], [56, 62]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="2.600" ry="1.600" fill="#2F7A33" transform={`rotate(${i * 40} ${x} ${y})`} />)}
  </g>
);

const Burger = (
  <g>
    {shadow}
    <path d="M16 46c0-18 15-28 34-28s34 10 34 28Z" fill="#D9913F" />
    {[[34, 30], [48, 25], [62, 30], [42, 37], [58, 38]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="2.800" ry="1.500" fill="#F7DDA8" />)}
    <path d="M14 50h72l-4 6H18Z" fill="#6EA83A" />
    <path d="M16 56h68l-3 6H19Z" fill="#F2B632" />
    <rect x="15" y="62" width="70" height="9" rx="4.500" fill="#6B3A22" />
    <path d="M16 72h68c0 8-8 13-34 13S16 80 16 72Z" fill="#D9913F" />
  </g>
);

const Drink = (
  <g>
    {shadow}
    <path d="M28 28h40l-4 54c-.3 3-2.500 5-5.500 5H37.500c-3 0-5.200-2-5.500-5L28 28Z" fill="#F2B632" />
    <path d="M70 38h6c6 0 9 4 9 10v14c0 6-3 10-9 10h-8" fill="none" stroke="#D9D9D9" strokeWidth="5" strokeLinecap="round" opacity="0.9" />
    <path d="M28 28h40l-1 8H29Z" fill="#fff" opacity="0.9" />
    <path d="M27 28c0-9 8-12 14-9 3-6 13-6 16 0 7-3 12 1 12 9Z" fill="#fff" />
    <path d="M36 44v32M46 46v32" stroke="#fff" strokeWidth="2.500" opacity="0.35" strokeLinecap="round" />
  </g>
);

const Cake = (
  <g>
    {shadow}
    <path d="M12 74 50 24l38 50Z" fill="#F6E3C0" />
    <path d="M12 74 50 24l38 50Z" fill="none" stroke="#E3C892" strokeWidth="2" strokeLinejoin="round" />
    <path d="M24 58h52v8H20Z" fill="#7A3E24" />
    <path d="M30 46h40l-4 6H34Z" fill="#7A3E24" opacity="0.9" />
    <path d="M12 74h76v10H12Z" fill="#fff" stroke="#EDE3D2" />
    <path d="M12 74 50 24" stroke="#fff" strokeWidth="3" opacity="0.5" />
    <circle cx="50" cy="22" r="5" fill="#C9372C" />
  </g>
);

const Shirt = (
  <g>
    {shadow}
    <path d="M34 18 18 28l8 16 8-4v42h32V40l8 4 8-16-16-10c-2 7-8 11-16 11s-14-4-16-11Z" fill="#5B8DB8" />
    <path d="M34 18c2 7 8 11 16 11s14-4 16-11" fill="none" stroke="#3F6E96" strokeWidth="3" />
    <path d="M34 40v42M66 40v42" stroke="#fff" strokeWidth="2" opacity="0.18" />
  </g>
);

const Nail = (
  <g>
    {shadow}
    <rect x="30" y="46" width="40" height="38" rx="9" fill="#E9759B" />
    <rect x="30" y="46" width="40" height="12" rx="6" fill="#fff" opacity="0.28" />
    <rect x="42" y="22" width="16" height="26" rx="4" fill="#2A2A2E" />
    <rect x="46" y="12" width="8" height="12" rx="3" fill="#2A2A2E" />
    <circle cx="40" cy="70" r="3" fill="#fff" opacity="0.4" />
  </g>
);

const Dumbbell = (
  <g>
    {shadow}
    <rect x="30" y="46" width="40" height="8" rx="3" fill="#8A93A0" />
    {[[14, 30, 14, 40], [24, 36, 8, 28]].map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} rx="3" fill="#2A3140" />)}
    {[[72, 36, 8, 28], [72, 30, 14, 40]].map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} rx="3" fill="#2A3140" />)}
  </g>
);

const Chair = (
  <g>
    {shadow}
    <rect x="30" y="14" width="36" height="34" rx="6" fill="#B9854F" />
    <rect x="26" y="46" width="44" height="10" rx="4" fill="#9E6B3B" />
    <path d="M30 56 26 84M66 56l4 28M36 56l-2 28M60 56l2 28" stroke="#7B5230" strokeWidth="5" strokeLinecap="round" />
    <path d="M38 22v18M48 22v18M58 22v18" stroke="#fff" strokeWidth="2" opacity="0.25" strokeLinecap="round" />
  </g>
);

const Bag = (
  <g>
    {shadow}
    <path d="M22 34h56l5 50H17Z" fill="#E7B25B" />
    <path d="M38 40v-8c0-8 5-12 12-12s12 4 12 12v8" fill="none" stroke="#B88428" strokeWidth="4" strokeLinecap="round" />
    <path d="M22 34h56l1 8H21Z" fill="#fff" opacity="0.25" />
  </g>
);

const Scissors = (
  <g>
    {shadow}
    <circle cx="32" cy="70" r="11" fill="none" stroke="#2A2A2E" strokeWidth="6" />
    <circle cx="68" cy="70" r="11" fill="none" stroke="#2A2A2E" strokeWidth="6" />
    <path d="M38 62 74 14M62 62 26 14" stroke="#B9C2CC" strokeWidth="6" strokeLinecap="round" />
    <circle cx="50" cy="40" r="3.500" fill="#2A2A2E" />
  </g>
);

const RULES: [RegExp, ReactNode][] = [
  [/empanada|tarta|pastel|hojaldre|criollo|calzone/, Empanada],
  [/pizza|fugazz|muzza|fainá|faina/, Pizza],
  [/hamburgues|burger|sandwich|lomito|milanesa|panchos?|tostado|picada|rabas|provoleta|parrilla|asado|pollo|ravioles|fideos|pasta|noquis|ñoquis/, Burger],
  [/cerveza|birra|fernet|vino|tragos?|gin|limonada|jugo|licuado|cafe|café|te\b|té\b|gaseosa|agua|mate|bebida|coca/, Drink],
  [/torta|postre|flan|volcan|volcán|alfajor|budin|budín|brownie|cheesecake|helado|dulce|chocolate|cupcake|medialuna/, Cake],
  [/remera|buzo|campera|camisa|pantalon|pantalón|jean|short|vestido|pollera|zapatilla|medias|gorra|ropa|conjunto|calza/, Shirt],
  [/uñas|unas|esmalt|manicur|semipermanente|depila|pedicur|maquill|cejas|pestañas|facial/, Nail],
  [/corte|peluquer|tintura|color|barber|barba|brushing|peinado/, Scissors],
  [/clase|pase|entrenamiento|gimnasio|musculaci|crossfit|funcional|pilates|yoga|personal|spinning/, Dumbbell],
  [/mesa|silla|sillon|sillón|living|mueble|placard|escritorio|biblioteca|cama|respaldo|vajilla|alquiler/, Chair],
];

/** Ilustración para un producto (o null si no hay una que le quede bien: se usa la inicial). Si no hay coincidencia, una bolsa genérica. */
export function ProductIllustration({ name, generic = true }: { name: string; generic?: boolean }) {
  const n = name.toLowerCase();
  const hit = RULES.find(([re]) => re.test(n))?.[1] ?? (generic ? Bag : null);
  if (!hit) return null;
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="size-[62%] max-w-44 drop-shadow-[0_8px_10px_rgba(0,0,0,0.08)]" focusable="false">
      {hit}
    </svg>
  );
}
