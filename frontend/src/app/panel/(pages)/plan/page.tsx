import type { Metadata } from "next";
import { PlanPanel } from "@/components/panel/PlanPanel";

export const metadata: Metadata = { title: "Plan y pagos" };

export default function PlanPage() {
  return <PlanPanel />;
}
