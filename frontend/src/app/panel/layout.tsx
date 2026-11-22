import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BrandScope } from "@/components/brand/BrandScope";
import { PanelShell } from "@/components/panel/PanelShell";

export const metadata: Metadata = { title: { default: "Mi panel", template: "%s · Mi panel" }, robots: { index: false, follow: false } };

export default function PanelLayout({ children }: { children: ReactNode }) {
  return <BrandScope><PanelShell>{children}</PanelShell></BrandScope>;
}
