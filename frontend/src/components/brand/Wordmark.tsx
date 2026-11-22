// Único lugar donde vive la marca. Cuando llegue el logo, se reemplaza acá
// (o se apunta a /public/brand/logo.svg) y se actualiza en toda la app.
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-baseline font-heading text-xl font-bold tracking-tight ${className}`}
      aria-label="MiShowo"
    >
      Mi<span className="text-primary">Showo</span>
      <span aria-hidden className="ml-0.5 inline-block size-1.5 rounded-full bg-primary" />
    </span>
  );
}
