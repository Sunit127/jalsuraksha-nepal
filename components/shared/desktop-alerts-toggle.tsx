"use client";

import { useSyncExternalStore } from "react";
import { BellOff, BellRing } from "lucide-react";
import {
  readDesktopPermission,
  requestDesktopAlerts,
  serverDesktopPermission,
  subscribeDesktopPermission,
} from "@/lib/utilities/desktop-alerts";
import { cn } from "@/lib/utils";

/**
 * Opt-in control for device notifications. Renders the current state honestly:
 * a button to enable, a confirmation when on, how to fix it when blocked, and
 * nothing at all where the browser cannot show them (e.g. plain-http LAN).
 */
export function DesktopAlertsToggle({
  enableLabel,
  onLabel,
  className,
}: {
  enableLabel: string;
  onLabel: string;
  className?: string;
}) {
  const permission = useSyncExternalStore(subscribeDesktopPermission, readDesktopPermission, serverDesktopPermission);

  if (permission === "unsupported") return null;
  if (permission === "granted") {
    return (
      <p className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <BellRing className="size-3.5 shrink-0" aria-hidden /> {onLabel}
      </p>
    );
  }
  if (permission === "denied") {
    return (
      <p className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <BellOff className="size-3.5 shrink-0" aria-hidden /> Notifications are blocked — allow them for this site in your browser settings.
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={() => void requestDesktopAlerts()}
      className={cn("flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-primary hover:underline", className)}
    >
      <BellRing className="size-3.5 shrink-0" aria-hidden /> {enableLabel}
    </button>
  );
}
