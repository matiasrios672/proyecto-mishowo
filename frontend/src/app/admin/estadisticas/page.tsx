import type { Metadata } from "next";
import { Estadisticas } from "@/components/admin/AdminStats";

export const metadata: Metadata = { title: "Estadísticas" };

export default function Page() {
  return <Estadisticas />;
}
