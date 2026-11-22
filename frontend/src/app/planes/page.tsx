import { redirect } from "next/navigation";

// Enlace corto y estable (lo usa la landing): lleva al panel de planes.
export default function PlanesRedirect() {
  redirect("/panel/plan");
}
