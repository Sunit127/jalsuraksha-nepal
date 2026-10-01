"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function CitizenError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState error={error} retry={retry} homeHref="/citizen" homeLabel="Citizen home" compact />;
}
