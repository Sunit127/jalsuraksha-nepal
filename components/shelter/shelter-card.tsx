import Link from "next/link";
import { Droplets, HeartPulse, Navigation, Phone, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/shared/status-badges";
import { formatDistance } from "@/lib/utilities/geo";
import { cn } from "@/lib/utils";
import type { Shelter, SupplyStatus } from "@/types/domain";

const SUPPLY_TEXT: Record<SupplyStatus, string> = {
  available: "Available",
  limited: "Limited",
  unavailable: "Not available",
};
const SUPPLY_TONE: Record<SupplyStatus, string> = {
  available: "text-safe-ink bg-safe-soft",
  limited: "text-watch-ink bg-watch-soft",
  unavailable: "text-danger-ink bg-danger-soft",
};

export function capacityTone(remaining: number, capacity: number) {
  if (remaining <= 0) return { bar: "bg-danger", text: "text-danger-ink", label: "FULL" };
  if (remaining / capacity < 0.15) return { bar: "bg-high", text: "text-high-ink", label: "ALMOST FULL" };
  return { bar: "bg-safe", text: "text-safe-ink", label: "SPACE AVAILABLE" };
}

export function ShelterCard({
  shelter,
  distanceM,
  title,
  showNavigate = true,
}: {
  shelter: Shelter;
  distanceM?: number;
  title?: string;
  showNavigate?: boolean;
}) {
  const remaining = shelter.remaining_capacity ?? Math.max(shelter.capacity - shelter.current_occupancy, 0);
  const tone = capacityTone(remaining, shelter.capacity);
  const occupiedPct = Math.min(100, Math.round((shelter.current_occupancy / shelter.capacity) * 100));

  return (
    <article className="rounded-2xl border bg-card p-4">
      {title && <p className="label-caps text-muted-foreground">{title}</p>}
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug">{shelter.name}</h3>
          <p className="truncate text-xs text-muted-foreground">{shelter.address}</p>
        </div>
        {distanceM !== undefined && Number.isFinite(distanceM) && (
          <span className="shrink-0 rounded-lg bg-muted px-2 py-1 text-sm font-semibold tabular">
            {formatDistance(distanceM)}
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className={cn("font-bold tabular", tone.text)}>
            {remaining > 0 ? `${remaining} spaces available` : "Shelter full"}
          </span>
          <span className="text-xs text-muted-foreground tabular">
            {shelter.current_occupancy}/{shelter.capacity}
          </span>
        </div>
        <div
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={occupiedPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${occupiedPct}% occupied — ${tone.label}`}
        >
          <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${occupiedPct}%` }} />
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
        <li className={cn("flex items-center gap-1 rounded-md px-2 py-1 font-medium", SUPPLY_TONE[shelter.water_status])}>
          <Droplets className="size-3.5" aria-hidden /> Water: {SUPPLY_TEXT[shelter.water_status]}
        </li>
        <li className={cn("flex items-center gap-1 rounded-md px-2 py-1 font-medium", SUPPLY_TONE[shelter.food_status])}>
          <Utensils className="size-3.5" aria-hidden /> Food: {SUPPLY_TEXT[shelter.food_status]}
        </li>
        <li
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 font-medium",
            shelter.medical_assistance ? "bg-info-soft text-info-ink" : "bg-muted text-muted-foreground",
          )}
        >
          <HeartPulse className="size-3.5" aria-hidden /> Medical: {shelter.medical_assistance ? "Yes" : "No"}
        </li>
      </ul>

      <div className="mt-3 flex items-center gap-2">
        {showNavigate && remaining > 0 && (
          <Button asChild variant="safe" className="flex-1">
            <Link href={`/citizen/route?shelter=${shelter.id}`}>
              <Navigation /> NAVIGATE
            </Link>
          </Button>
        )}
        {shelter.contact_phone && (
          <Button asChild variant="outline" size={showNavigate && remaining > 0 ? "icon" : "default"} aria-label={`Call ${shelter.name}`}>
            <a href={`tel:${shelter.contact_phone}`}>
              <Phone />
              {!(showNavigate && remaining > 0) && "Call shelter"}
            </a>
          </Button>
        )}
        {shelter.is_demo && <DemoBadge className="ml-auto" label="DEMO" />}
      </div>
    </article>
  );
}
