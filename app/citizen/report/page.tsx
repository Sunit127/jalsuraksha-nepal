import type { Metadata } from "next";
import { HazardReportForm } from "@/components/alerts/hazard-report-form";

export const metadata: Metadata = { title: "Report a hazard" };

export default function ReportPage() {
  return <HazardReportForm />;
}
