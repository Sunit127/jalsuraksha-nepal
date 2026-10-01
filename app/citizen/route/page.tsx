import type { Metadata } from "next";
import { Suspense } from "react";
import { SafeRouteView } from "@/components/shelter/safe-route-view";

export const metadata: Metadata = { title: "Safe route" };

export default function SafeRoutePage() {
  return (
    <Suspense>
      <SafeRouteView />
    </Suspense>
  );
}
