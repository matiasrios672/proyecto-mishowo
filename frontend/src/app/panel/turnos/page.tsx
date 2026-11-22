import type { Metadata } from "next";
import { AppointmentsPanel } from "@/components/panel/AppointmentsPanel";

export const metadata: Metadata = { title: "Turnos" };

export default function Page() {
  return <AppointmentsPanel />;
}
