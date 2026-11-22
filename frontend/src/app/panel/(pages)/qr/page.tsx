import type { Metadata } from "next";
import { QrPanel } from "@/components/panel/QrPanel";

export const metadata: Metadata = { title: "Código QR" };

export default function Page() {
  return <QrPanel />;
}
