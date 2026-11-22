import type { Metadata } from "next";
import { CouponsPanel } from "@/components/panel/CouponsPanel";

export const metadata: Metadata = { title: "Cupones" };

export default function Page() {
  return <CouponsPanel />;
}
