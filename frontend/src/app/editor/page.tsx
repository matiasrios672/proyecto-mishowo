import type { Metadata } from "next";
import { EditorShell } from "@/components/editor/EditorShell";

export const metadata: Metadata = { title: "Editor", robots: { index: false } };

export default function EditorPage() {
  return <EditorShell />;
}
