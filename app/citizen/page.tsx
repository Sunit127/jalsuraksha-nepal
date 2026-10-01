"use client";

import Link from "next/link";
import { ChevronRight, Clock3, Map as MapIcon, Navigation, Radio, Siren, ThumbsUp } from "lucide-react";
import { AlertCard } from "@/components/alerts/alert-card";
import { PushAlertsToggle } from "@/components/alerts/push-alerts-toggle";
import { RiskStatusCard } from "@/components/alerts/risk-status-card";
import { RiverGaugeCard } from "@/components/alerts/river-gauge-card";
import { LiveMap } from "@/components/map";
import { ShelterCard } from "@/components/shelter/shelter-card";
import { useCitizenData } from "@/components/shared/citizen-data";
import { LocationChip } from "@/components/shared/location-chip";
import { HazardSeverityBadge, SafetyStatusBadge } from "@/components/shared/status-badges";
import { DEMO_REGION } from "@/lib/demo/scenario";
import { ActiveSosCard } from "@/components/sos/active-sos-card";
import { HAZARD_TYPE_LABEL, formatClock, timeAgo } from "@/lib/utilities/format";
import type { SafetyStatus } from "@/types/domain";

export default function CitizenHomePage() {
  const data = useCitizenData();
  const { focusZone, alerts, nearestShelters, hazards, location, session } = data;
  const latestAlert = alerts[0];
  const nearestOpen = nearestShelters.find((s) => (s.remaining_capacity ?? 0) > 0) ?? nearestShelters[0];
  const recentHazards = hazards.filter((h) => h.status !== "resolved" && !h.duplicate_of).slice(0, 3);
  const center = location.location ?? DEMO_REGION.center;

  return (
    <div className="grid gap-4">
      <LocationChip />
      <PushAlertsToggle variant="card" />

      <ActiveSosCard />
      <RiskStatusCard zone={focusZone} isUserZone={data.focusIsUserZone} locationLabel={location.label} />

      {latestAlert ? (
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Latest alert</h2>
            {alerts.length > 1 && (
              <Link href="/citizen/alerts" className="flex items-center text-xs font-semibold text-primary">
                All {alerts.length} alerts <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            )}
          </div>
          <AlertCard alert={latestAlert} compact />
        </div>
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No active alerts for your area right now.
        </p>
      )}

      <div className="grid gap-3">
        <Link
          href="/citizen/route"
          className="flex min-h-18 items-center justify-between gap-3 rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-md transition active:scale-[0.99]"
        >
          <span className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white/10">
              <Navigation className="size-6" aria-hidden />
            </span>
            <span>
              <span className="block text-lg font-bold tracking-tight">FIND SAFE ROUTE</span>
              <span className="block text-xs text-primary-foreground/75">To the nearest shelter, avoiding hazards</span>
            </span>
          </span>
          <ChevronRight className="size-5 opacity-70" aria-hidden />
        </Link>
        <Link
          href="/citizen/sos"
          className="flex min-h-18 items-center justify-between gap-3 rounded-2xl bg-danger px-5 py-4 text-white shadow-md shadow-red-900/20 transition active:scale-[0.99]"
        >
          <span className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white/15">
              <Siren className="size-6" aria-hidden />
            </span>
            <span>
              <span className="block text-lg font-bold tracking-tight">SEND EMERGENCY SOS</span>
              <span className="block text-xs text-white">No account needed · shares your location</span>
            </span>
          </span>
          <ChevronRight className="size-5 opacity-70" aria-hidden />
        </Link>
      </div>

      {session.userId && !session.isAnonymous && (
        <Link href="/citizen/profile" className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
          <span className="text-sm">
            <span className="block font-semibold">Family safety status</span>
            <span className="text-xs text-muted-foreground">Let responders and family know</span>
          </span>
          <SafetyStatusBadge status={(session.safetyStatus as SafetyStatus) ?? "unknown"} />
        </Link>
      )}

      {focusZone && <RiverGaugeCard zone={focusZone} />}

      <section className="grid gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Live flood map</h2>
          <Link href="/citizen/map" className="flex items-center gap-1 text-xs font-semibold text-primary">
            <MapIcon className="size-3.5" aria-hidden /> Open full map
          </Link>
        </div>
        <Link href="/citizen/map" aria-label="Open full live flood map" className="block">
          <LiveMap
            className="pointer-events-none h-52"
            center={center}
            zoom={13}
            compact
            interactive={false}
            showLegend={false}
            zones={data.zones}
            shelters={data.shelters}
            hazards={hazards}
            hospitals={data.hospitals}
            userLocation={location.location}
          />
        </Link>
      </section>

      {nearestOpen && (
        <ShelterCard shelter={nearestOpen} distanceM={nearestOpen.distanceM} title="Nearest shelter" />
      )}
      <Link href="/citizen/shelters" className="-mt-2 flex items-center justify-center gap-1 text-xs font-semibold text-primary">
        See all {nearestShelters.length} shelters <ChevronRight className="size-3.5" aria-hidden />
      </Link>

      <section className="grid gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent hazard reports</h2>
          <Link href="/citizen/report" className="text-xs font-semibold text-primary">
            Report a hazard
          </Link>
        </div>
        {recentHazards.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No recent reports.</p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {recentHazards.map((h) => (
              <li key={h.id}>
                <Link href={`/citizen/map?hazard=${h.id}`} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{HAZARD_TYPE_LABEL[h.type]}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {h.location_name ?? "Reported location"} · {timeAgo(h.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <HazardSeverityBadge severity={h.severity} />
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <ThumbsUp className="size-3" aria-hidden /> {h.confirmation_count}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="grid gap-1 rounded-xl bg-muted/70 p-3 text-[11px] text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Radio className="size-3.5" aria-hidden />
          System status: {data.online ? (data.realtime === "live" ? "Live updates connected" : "Connecting to live updates") : "Offline — showing saved data"}
        </p>
        <p className="flex items-center gap-1.5">
          <Clock3 className="size-3.5" aria-hidden />
          Last update: {data.lastSync ? `${formatClock(data.lastSync)} NPT (${timeAgo(data.lastSync)})` : "not yet synchronized"}
        </p>
        <p>Data source: JalSuraksha Hackathon Demo (simulated). Follow official instructions from local authorities.</p>
      </footer>
    </div>
  );
}
