"use client";

import { useMemo } from "react";
import { Clock3, Navigation2, Phone, Radio, Truck } from "lucide-react";
import { LiveMap, type MapRoute } from "@/components/map";
import { Button } from "@/components/ui/button";
import { formatDistance } from "@/lib/utilities/geo";
import { formatPhone, timeAgo } from "@/lib/utilities/format";
import type { AssignmentStatus, Hospital, LatLng, RescueTeam, Shelter } from "@/types/domain";

export type TeamLocation = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  headingDeg: number | null;
  updatedAt: string;
  distanceM: number;
  road: { distanceM: number; minutes: number } | null;
};

export type SafeShelter = Pick<Shelter, "id" | "name" | "address" | "latitude" | "longitude" | "remaining_capacity" | "capacity" | "contact_phone" | "is_demo" | "verification"> & {
  distanceM: number;
};
export type SafeHospital = Hospital & { distanceM: number };

/**
 * "Where is my rescue team?" — the person's SOS location, the assigned team's
 * live position (when the crew shares GPS), distance and road ETA, and the
 * nearest safe places on one map.
 */
export function RescueTeamMap({
  you,
  team,
  status,
  location,
  shelters,
  hospitals,
}: {
  you: LatLng;
  team: { call_sign: string; name: string; personnel_count: number; equipment: string[]; contact_phone?: string | null };
  status: AssignmentStatus;
  location: TeamLocation | null;
  shelters: SafeShelter[];
  hospitals: SafeHospital[];
}) {
  const teamPos = location ? { lat: location.latitude, lng: location.longitude } : null;
  const onScene = status === "arrived" || status === "in_progress";

  const mapTeams = useMemo(
    () =>
      teamPos
        ? [
            {
              id: "assigned-team",
              call_sign: team.call_sign,
              name: team.name,
              personnel_count: team.personnel_count,
              equipment: team.equipment,
              status: "busy",
              latitude: teamPos.lat,
              longitude: teamPos.lng,
              liveUpdatedAt: location!.updatedAt,
            } as unknown as RescueTeam & { liveUpdatedAt: string },
          ]
        : [],
    [teamPos?.lat, teamPos?.lng, team, location?.updatedAt], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const mapShelters = useMemo(
    () => shelters.map((s) => ({ ...s, current_occupancy: s.capacity - (s.remaining_capacity ?? 0) }) as unknown as Shelter),
    [shelters],
  );
  const routes: MapRoute[] = teamPos && !onScene ? [{ id: "team", variant: "direct", path: [teamPos, you], label: "Team → you (straight line)" }] : [];
  const fit = useMemo(
    () => ({
      key: `${teamPos ? "t" : "n"}:${shelters.length}`,
      points: [you, ...(teamPos ? [teamPos] : []), ...shelters.slice(0, 1).map((s) => ({ lat: s.latitude, lng: s.longitude }))],
    }),
    [teamPos?.lat, teamPos?.lng, you.lat, you.lng, shelters.length], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-info bg-card" data-testid="team-map">
      <div className="grid gap-1 bg-info-soft p-4 text-info-ink">
        <p className="label-caps flex items-center gap-1.5">
          <Truck className="size-3.5" aria-hidden /> Where is my rescue team?
        </p>
        {onScene ? (
          <p className="text-lg font-bold">Team {team.call_sign} has arrived at your location. Follow the team&apos;s instructions.</p>
        ) : location ? (
          <>
            <p className="text-lg font-bold">
              Team {team.call_sign} is {formatDistance(location.road?.distanceM ?? location.distanceM)} away
              {location.road ? ` by road · about ${location.road.minutes} min` : " (straight line)"}
            </p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
              <span className="flex items-center gap-1">
                <Radio className="size-3.5" aria-hidden /> Live position · updated {timeAgo(location.updatedAt)}
              </span>
              {location.road && (
                <span className="flex items-center gap-1">
                  <Clock3 className="size-3.5" aria-hidden /> Estimate by road; boats or flooded roads change it
                </span>
              )}
            </p>
          </>
        ) : (
          <p className="text-sm font-medium">
            Team {team.call_sign} is assigned. Its live position isn&apos;t shared yet (the crew may report by radio). You&apos;ll see it here
            as soon as it is.
          </p>
        )}
      </div>

      <LiveMap
        className="h-64 rounded-none border-0"
        center={teamPos ?? you}
        zoom={14}
        userLocation={you}
        userLabel="Your SOS location"
        teams={mapTeams}
        shelters={mapShelters}
        hospitals={hospitals}
        routes={routes}
        fitBounds={fit}
        compact
        showLegend={false}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Navigation2 className="size-3.5" aria-hidden /> Stay where you are and make yourself visible (cloth, torch, phone light).
        </span>
        {team.contact_phone && (
          <Button asChild size="sm" variant="outline">
            <a href={`tel:${team.contact_phone}`}>
              <Phone /> Call team {formatPhone(team.contact_phone)}
            </a>
          </Button>
        )}
      </div>
    </section>
  );
}
