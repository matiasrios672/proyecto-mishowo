import type { Metadata } from "next";
import { Consultas } from "@/components/admin/AdminMail";

export const metadata: Metadata = { title: "Consultas" };

export default function Page() {
  return <Consultas />;
}
