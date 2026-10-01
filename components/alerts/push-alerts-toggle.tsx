"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  disablePushAlerts,
  enablePushAlerts,
  readPushState,
  refreshPushSubscription,
  type PushState,
} from "@/lib/utilities/push-alerts";
import { cn } from "@/lib/utils";

/**
 * Opt-in for lock-screen flood alerts.
 * - "card": a prominent prompt (citizen home); hidden once alerts are on.
 * - "inline": a compact status line with on/off (alerts page).
 */
export function PushAlertsToggle({ variant, className }: { variant: "card" | "inline"; className?: string }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void readPushState().then((s) => {
      if (!alive) return;
      setState(s);
      if (s === "on") void refreshPushSubscription();
    });
    return () => {
      alive = false;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    try {
      const next = await enablePushAlerts();
      setState(next);
      if (next === "on") toast.success("Lock-screen flood alerts are on for this phone.");
      else if (next === "denied") toast.error("Notifications are blocked. Allow them for this site in your browser settings.");
      else if (next === "off") toast.error("Could not turn on alerts. Please try again.");
    } catch {
      toast.error("Could not turn on alerts. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setState(await disablePushAlerts().finally(() => setBusy(false)));
  }

  if (state === null || state === "unsupported") return null;

  if (variant === "card") {
    if (state === "on") return null;
    return (
      <section
        className={cn("rounded-2xl border-2 border-danger/40 bg-danger-soft p-4 text-danger-ink", className)}
        data-testid="push-card"
      >
        <p className="flex items-center gap-2 font-bold">
          <BellRing className="size-5 shrink-0" aria-hidden /> Get flood alerts even when your phone is locked
        </p>
        {state === "needs-install" ? (
          <p className="mt-1 flex items-start gap-1.5 text-sm">
            <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden />
            On iPhone: tap Share, then &quot;Add to Home Screen&quot;. Open JalSuraksha from the Home Screen and turn
            alerts on there.
          </p>
        ) : state === "denied" ? (
          <p className="mt-1 text-sm">Notifications are blocked. Allow them for this site in your browser settings.</p>
        ) : (
          <>
            <p className="mt-1 text-sm">The control centre&apos;s warnings will sound and vibrate on your lock screen.</p>
            <button
              type="button"
              onClick={() => void turnOn()}
              disabled={busy}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-danger font-bold text-white disabled:opacity-70"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BellRing className="size-4" aria-hidden />}
              Turn on lock-screen alerts
            </button>
          </>
        )}
      </section>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 text-xs", className)} data-testid="push-inline">
      {state === "on" ? (
        <>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <BellRing className="size-3.5 shrink-0" aria-hidden /> Lock-screen flood alerts are on for this phone.
          </span>
          <button type="button" onClick={() => void turnOff()} disabled={busy} className="font-semibold text-primary">
            Turn off
          </button>
        </>
      ) : state === "denied" ? (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <BellOff className="size-3.5 shrink-0" aria-hidden /> Notifications are blocked — allow them for this site in your browser settings.
        </span>
      ) : state === "needs-install" ? (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Smartphone className="size-3.5 shrink-0" aria-hidden /> For lock-screen alerts on iPhone, add JalSuraksha to your Home Screen first.
        </span>
      ) : (
        <button type="button" onClick={() => void turnOn()} disabled={busy} className="flex items-center gap-1.5 font-semibold text-primary">
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <BellRing className="size-3.5" aria-hidden />}
          Turn on lock-screen flood alerts for this phone
        </button>
      )}
    </div>
  );
}
