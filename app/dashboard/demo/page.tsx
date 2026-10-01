import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoControlPanel } from "@/components/dashboard/demo-control-panel";
import { DEMO_MODE } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Presentation mode" };

export default function DemoPage() {
  if (!DEMO_MODE) notFound();
  return <DemoControlPanel />;
}
