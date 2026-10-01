import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SosTracker } from "@/components/sos/sos-tracker";

export const metadata: Metadata = { title: "SOS status" };

export default async function SosStatusPage({ params, searchParams }: PageProps<"/citizen/sos/[ref]">) {
  const { ref } = await params;
  const { t } = await searchParams;
  if (!/^SOS-NEP-\d{4,}$/.test(ref)) notFound();
  const token = typeof t === "string" && /^[0-9a-f-]{36}$/i.test(t) ? t : null;
  return <SosTracker reference={ref} tokenFromUrl={token} />;
}
