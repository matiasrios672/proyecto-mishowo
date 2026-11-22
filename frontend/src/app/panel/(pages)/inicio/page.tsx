import type { Metadata } from "next";
import { HomePanel } from "@/components/panel/HomePanel";

export const metadata: Metadata = { title: "Inicio" };

export default function Page() {
  return <HomePanel />;
}
