"use client";

import { Crosshair, FlaskConical, Loader2, MapPin, MapPinned } from "lucide-react";
import { LocationPicker } from "@/components/map/location-picker";
import { useCitizenData } from "@/components/shared/citizen-data";
import { LOCATION_ERROR_MESSAGE } from "@/lib/utilities/use-location";
import { cn } from "@/lib/utils";

const linkBtn = "flex shrink-0 cursor-pointer items-center gap-1 font-semibold text-primary";

/**
 * Shows where "your location" comes from and lets the user switch between
 * GPS, the demo scenario location, or placing themselves on the map (fallback
 * when GPS is denied or unavailable).
 */
export function LocationChip({ className }: { className?: string }) {
  const { location, demoMode } = useCitizenData();
  const Icon = location.loading
    ? Loader2
    : location.source === "demo"
      ? FlaskConical
      : location.source === "manual"
        ? MapPinned
        : MapPin;

  return (
    <div className={cn("grid gap-1", className)}>
      <div className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5">
          <Icon
            className={cn(
              "size-3.5 shrink-0",
              location.loading && "animate-spin",
              location.source === "gps" ? "text-info" : location.source === "manual" ? "text-high-ink" : "text-muted-foreground",
            )}
            aria-hidden
          />
          <span className="truncate">
            {location.loading ? "Finding your location…" : (location.label ?? "Location not available")}
            {location.source === "gps" && location.accuracyM !== null && (
              <span className="text-muted-foreground"> · ±{location.accuracyM} m</span>
            )}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {location.source !== "gps" && !location.loading && (
            <button type="button" onClick={location.useGps} className={linkBtn}>
              <Crosshair className="size-3.5" aria-hidden /> {location.error ? "Retry GPS" : "Use my GPS"}
            </button>
          )}
          {location.source === "gps" && demoMode && (
            <button type="button" onClick={location.useDemo} className={linkBtn}>
              Use demo location
            </button>
          )}
        </span>
      </div>
      {(location.error || location.source === "manual") && (
        <div className="flex items-start justify-between gap-2 px-1">
          <p role={location.error ? "alert" : undefined} className={cn("text-xs", location.error ? "text-danger-ink" : "text-muted-foreground")}>
            {location.error
              ? LOCATION_ERROR_MESSAGE[location.error]
              : "Approximate location placed by you. Responders will call to confirm."}
          </p>
          <LocationPicker
            initial={location.location}
            onPick={location.setManual}
            trigger={
              <button type="button" className={cn(linkBtn, "text-xs")}>
                <MapPinned className="size-3.5" aria-hidden /> {location.source === "manual" ? "Adjust" : "Set on map"}
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}
