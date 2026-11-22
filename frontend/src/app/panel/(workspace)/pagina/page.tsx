import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mi página" };

// El editor vive en el layout (compartido por los tres módulos): esta página solo define la ruta.
export default function Page() {
  return null;
}
