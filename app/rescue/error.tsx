"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function RescueError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState error={error} retry={retry} title="The rescue console failed to load" homeHref="/rescue" homeLabel="Reload console" />;
}
