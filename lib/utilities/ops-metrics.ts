import { PRIORITY_RANK } from "@/lib/risk-engine/sos-priority";
import type { HazardReport, LatLng, PriorityLevel, RescueAssignment, RescueTeam, Shelter, SosStatus } from "@/types/domain";
import { haversineMeters } from "./geo";
import { isSosOpen } from "./status";

export type IncidentLike = {
  id: string;
  status: SosStatus;
  effective_priority: PriorityLevel | null;
  created_at: string;
  resolved_at: string | null;
  people_count: number;
  assigned_team_id: string | null;
  latitude: number;
  longitude: number;
  location_name: string | null;
};

export type IncidentFilter = "open" | "critical" | "high" | "unassigned" | "assigned" | "completed";
export type IncidentSort = "priority" | "time" | "location";

export const INCIDENT_FILTER_LABEL: Record<IncidentFilter, string> = {
  open: "All open",
  critical: "Critical",
  high: "High",
  unassigned: "Unassigned",
  assigned: "Assigned",
  completed: "Completed",
};

export function matchesFilter(s: IncidentLike, filter: IncidentFilter): boolean {
  const open = isSosOpen(s.status);
  switch (filter) {
    case "open":
      return open;
    case "critical":
      return open && s.effective_priority === "critical";
    case "high":
      return open && s.effective_priority === "high";
    case "unassigned":
      return open && (s.status === "received" || s.status === "acknowledged");
    case "assigned":
      return open && !(s.status === "received" || s.status === "acknowledged");
    case "completed":
      return !open;
  }
}

const rank = (p: PriorityLevel | null) => PRIORITY_RANK[p ?? "low"];

export function sortIncidents<T extends IncidentLike>(list: T[], sort: IncidentSort, origin?: LatLng): T[] {
  const copy = [...list];
  if (sort === "priority") {
    // SOS no operator has opened yet come first so a new request is never
    // buried below the fold; then highest priority, waiting longest first.
    const unopened = (s: T) => (s.status === "received" ? 1 : 0);
    copy.sort(
      (a, b) =>
        unopened(b) - unopened(a) ||
        rank(b.effective_priority) - rank(a.effective_priority) ||
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  } else if (sort === "time") {
    copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } else {
    const o = origin ?? { lat: 27.6925, lng: 84.4235 };
    copy.sort(
      (a, b) =>
        haversineMeters(o, { lat: a.latitude, lng: a.longitude }) -
        haversineMeters(o, { lat: b.latitude, lng: b.longitude }),
    );
  }
  return copy;
}

export type Kpis = {
  activeSos: number;
  critical: number;
  unassigned: number;
  teamsAvailable: number;
  teamsTotal: number;
  peopleAssisted: number;
  activeShelters: number;
  shelterOccupancyPct: number;
  shelterSpaces: number;
  openHazards: number;
};

export function computeKpis(
  sos: IncidentLike[],
  teams: Pick<RescueTeam, "status">[],
  shelters: Pick<Shelter, "is_active" | "capacity" | "current_occupancy">[],
  hazards: Pick<HazardReport, "status" | "duplicate_of">[],
): Kpis {
  const open = sos.filter((s) => isSosOpen(s.status));
  const activeShelters = shelters.filter((s) => s.is_active);
  const capacity = activeShelters.reduce((a, s) => a + s.capacity, 0);
  const occupied = activeShelters.reduce((a, s) => a + s.current_occupancy, 0);
  return {
    activeSos: open.length,
    critical: open.filter((s) => s.effective_priority === "critical").length,
    unassigned: open.filter((s) => s.status === "received" || s.status === "acknowledged").length,
    teamsAvailable: teams.filter((t) => t.status === "available").length,
    teamsTotal: teams.length,
    peopleAssisted: sos.filter((s) => s.status === "resolved").reduce((a, s) => a + s.people_count, 0),
    activeShelters: activeShelters.length,
    shelterOccupancyPct: capacity > 0 ? Math.round((occupied / capacity) * 100) : 0,
    shelterSpaces: Math.max(capacity - occupied, 0),
    openHazards: hazards.filter((h) => (h.status === "open" || h.status === "verified") && !h.duplicate_of).length,
  };
}

/** SOS count per hour for the last `hours` hours, split by effective priority. */
export function hourlySeries(sos: IncidentLike[], hours = 12, now = new Date()) {
  const buckets: { hour: string; critical: number; high: number; moderate: number; low: number }[] = [];
  // Align buckets to Kathmandu clock hours (UTC+5:45, no DST) so results and
  // labels don't depend on the server's or browser's timezone.
  const NPT_OFFSET = 345 * 60_000;
  const nptHourStart = Math.floor((now.getTime() + NPT_OFFSET) / 3600_000) * 3600_000 - NPT_OFFSET;
  const start = new Date(nptHourStart - (hours - 1) * 3600_000);
  for (let i = 0; i < hours; i++) {
    const d = new Date(start.getTime() + i * 3600_000);
    buckets.push({
      hour: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kathmandu" }),
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
    });
  }
  for (const s of sos) {
    const idx = Math.floor((new Date(s.created_at).getTime() - start.getTime()) / 3600_000);
    if (idx >= 0 && idx < hours) buckets[idx][s.effective_priority ?? "low"] += 1;
  }
  return buckets;
}

/** Median minutes from assignment to arrival for completed missions. */
export function medianResponseMinutes(assignments: Pick<RescueAssignment, "assigned_at" | "arrived_at">[]): number | null {
  const mins = assignments
    .filter((a) => a.arrived_at)
    .map((a) => (new Date(a.arrived_at!).getTime() - new Date(a.assigned_at).getTime()) / 60000)
    .filter((m) => m >= 0)
    .sort((a, b) => a - b);
  if (mins.length === 0) return null;
  const mid = Math.floor(mins.length / 2);
  return Math.round(mins.length % 2 ? mins[mid] : (mins[mid - 1] + mins[mid]) / 2);
}

/** Available teams ordered by straight-line distance to an incident. */
export function rankTeamsForIncident<T extends Pick<RescueTeam, "status" | "latitude" | "longitude">>(
  teams: T[],
  incident: LatLng,
): (T & { distanceM: number })[] {
  return teams
    .map((t) => ({ ...t, distanceM: haversineMeters(incident, { lat: t.latitude, lng: t.longitude }) }))
    .sort((a, b) => {
      const avail = Number(b.status === "available") - Number(a.status === "available");
      return avail || a.distanceM - b.distanceM;
    });
}
