import type { Metadata } from "next";
import { Users } from "@/components/admin/AdminPages";

export const metadata: Metadata = { title: "Usuarios" };

export default function Page() {
  return <Users />;
}
