import type { Metadata } from "next";
import { Team } from "@/components/admin/AdminPages";

export const metadata: Metadata = { title: "Equipo" };

export default function Page() {
  return <Team />;
}
