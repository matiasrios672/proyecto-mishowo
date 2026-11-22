import type { Metadata } from "next";
import { System } from "@/components/admin/AdminOps";

export const metadata: Metadata = { title: "Sistema" };

export default function Page() {
  return <System />;
}
