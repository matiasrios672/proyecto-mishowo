// Íconos mínimos en línea (sin librería, para no sumar peso a la página pública).
type P = { className?: string };
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const IconPin = ({ className }: P) => (
  <svg {...base} className={className}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
);
export const IconInstagram = ({ className }: P) => (
  <svg {...base} className={className}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" stroke="none" /></svg>
);
export const IconCart = ({ className }: P) => (
  <svg {...base} className={className}><path d="M3 4h2.2l1.6 10.2a1.5 1.5 0 0 0 1.5 1.3h8.1a1.5 1.5 0 0 0 1.5-1.2L19.5 8H6" /><circle cx="9" cy="19.5" r="1.2" /><circle cx="17" cy="19.5" r="1.2" /></svg>
);
/**
 * WhatsApp dibujado a mano sobre una grilla de 24: el círculo está EXACTAMENTE en el centro (12, 12) y la colita queda
 * adentro del cuadro. Así el ícono se centra por el círculo (lo que ve el ojo) y no por el cuadro que incluye la colita.
 */
export const IconWhatsApp = ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
    <path fillRule="evenodd" d="M12 2.4a9.6 9.6 0 1 0 0 19.2 9.6 9.6 0 0 0 0-19.2Zm0 1.9a7.7 7.7 0 1 1 0 15.4 7.7 7.7 0 0 1 0-15.4Z" />
    <path d="M3.3 21 4.7 16.2l3.2 3.1Z" />
    <path transform="translate(12 12) scale(.56) translate(-12 -12)" d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
  </svg>
);
