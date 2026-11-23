/* eslint-disable @next/next/no-img-element -- el logo es un PNG chico y fijo: se sirve directo desde /public/brand */
// Único lugar donde vive la marca (logo y isotipo en /public/brand). Cambiar el archivo actualiza toda la app.
// El tamaño sale del `text-*` que reciba: el logo mide un poco más que la altura del texto.

/** Logotipo «MiShowo.» (con la tinta oscura). Sobre fondos oscuros usar `variant="claro"`. */
export function Wordmark({ className = "", variant = "normal" }: { className?: string; variant?: "normal" | "claro" }) {
  return (
    <span className={`inline-flex items-center text-xl ${className}`}>
      <img src={variant === "claro" ? "/brand/logo-claro.png" : "/brand/logo.png"} alt="MiShowo" width={891} height={153} style={{ height: "1.1em", width: "auto" }} />
    </span>
  );
}

/** Isotipo: el cuadrado azul con la «M.». Para espacios chicos, íconos y sellos. */
export function Isotipo({ className = "size-8" }: { className?: string }) {
  return <img src="/brand/isotipo.png" alt="MiShowo" width={512} height={512} className={className} />;
}
