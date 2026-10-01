"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState error={error} retry={retry} title="This operations view failed to load" homeHref="/dashboard" homeLabel="Operations overview" />;
}
