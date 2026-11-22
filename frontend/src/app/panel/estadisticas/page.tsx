import type { Metadata } from "next";
import { StatsPanel } from "@/components/panel/StatsPanel";

export const metadata: Metadata = { title: "Estadísticas" };

export default function Page() {
  return <StatsPanel />;
}
