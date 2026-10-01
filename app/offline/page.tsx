import type { Metadata } from "next";
import { OfflineView } from "./offline-view";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return <OfflineView />;
}
