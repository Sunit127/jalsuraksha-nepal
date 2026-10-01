import type { Metadata } from "next";
import { SosForm } from "@/components/sos/sos-form";
import { MySosList } from "@/components/sos/my-sos-list";

export const metadata: Metadata = { title: "Emergency SOS" };

export default function SosPage() {
  return (
    <div className="grid gap-4">
      <MySosList />
      <SosForm />
    </div>
  );
}
