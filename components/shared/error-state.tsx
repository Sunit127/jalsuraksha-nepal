"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, Phone, RefreshCcw, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Friendly error screen used by every route segment's error boundary.
 * Always keeps a path to emergency help visible.
 */
export function ErrorState({
  error,
  retry,
  title = "Something went wrong",
  homeHref = "/",
  homeLabel = "Go home",
  compact = false,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  title?: string;
  homeHref?: string;
  homeLabel?: string;
  compact?: boolean;
}) {
  useEffect(() => {
    console.error("[ui] route error", error.digest ?? "", error.message);
  }, [error]);

  return (
    <div className={compact ? "grid gap-4 py-10" : "flex min-h-[60dvh] items-center justify-center p-6"}>
      <div className="mx-auto grid max-w-md gap-4 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-high-soft text-high-ink">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This screen could not load. Your data is safe — try again, or check your connection.
            {error.digest && <span className="mt-1 block text-xs">Reference: {error.digest}</span>}
          </p>
        </div>
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={() => retry()}>
            <RefreshCcw /> Try again
          </Button>
          <Button asChild variant="outline">
            <Link href={homeHref}>{homeLabel}</Link>
          </Button>
        </div>
        <div className="grid gap-2 rounded-xl border bg-card p-3 text-sm">
          <Link href="/citizen/sos" className="flex items-center justify-center gap-2 font-semibold text-danger-ink">
            <Siren className="size-4" aria-hidden /> Need help now? Open Emergency SOS
          </Link>
          <p className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <Phone className="size-3.5" aria-hidden /> Police 100 · Fire 101 · Ambulance 102
          </p>
        </div>
      </div>
    </div>
  );
}
