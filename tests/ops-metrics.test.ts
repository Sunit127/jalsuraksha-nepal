import { describe, expect, it } from "vitest";
import {
  computeKpis,
  hourlySeries,
  matchesFilter,
  medianResponseMinutes,
  rankTeamsForIncident,
  sortIncidents,
  type IncidentLike,
} from "@/lib/utilities/ops-metrics";
import { friendlyWorkflowError } from "@/lib/utilities/errors";

const base: IncidentLike = {
  id: "x",
  status: "received",
  effective_priority: "low",
  created_at: "2026-09-30T08:00:00Z",
  resolved_at: null,
  people_count: 2,
  assigned_team_id: null,
  latitude: 27.69,
  longitude: 84.42,
  location_name: null,
};
const inc = (o: Partial<IncidentLike>): IncidentLike => ({ ...base, ...o });

describe("incident filters and sorting", () => {
  const list = [
    inc({ id: "a", effective_priority: "high", created_at: "2026-09-30T08:10:00Z" }),
    inc({ id: "b", effective_priority: "critical", created_at: "2026-09-30T08:20:00Z", status: "en_route" }),
    inc({ id: "c", effective_priority: "critical", created_at: "2026-09-30T08:05:00Z" }),
    inc({ id: "d", status: "resolved", people_count: 7 }),
  ];

  it("filters by queue tab", () => {
    expect(list.filter((s) => matchesFilter(s, "open")).map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(list.filter((s) => matchesFilter(s, "critical")).map((s) => s.id)).toEqual(["b", "c"]);
    expect(list.filter((s) => matchesFilter(s, "unassigned")).map((s) => s.id)).toEqual(["a", "c"]);
    expect(list.filter((s) => matchesFilter(s, "assigned")).map((s) => s.id)).toEqual(["b"]);
    expect(list.filter((s) => matchesFilter(s, "completed")).map((s) => s.id)).toEqual(["d"]);
  });

  it("puts unopened SOS first, then priority, oldest first within a level", () => {
    expect(sortIncidents(list, "priority").map((s) => s.id)).toEqual(["c", "a", "b", "d"]);
  });

  it("keeps a new low-priority SOS above reviewed critical incidents", () => {
    const fresh = inc({ id: "new", effective_priority: "low", created_at: "2026-09-30T09:00:00Z" });
    const reviewed = inc({ id: "old", effective_priority: "critical", status: "acknowledged" });
    expect(sortIncidents([reviewed, fresh], "priority").map((s) => s.id)).toEqual(["new", "old"]);
  });

  it("sorts by newest", () => {
    expect(sortIncidents(list, "time")[0].id).toBe("b");
  });
});

describe("KPIs", () => {
  it("counts active, critical, teams, people assisted, shelters and hazards", () => {
    const k = computeKpis(
      [inc({ effective_priority: "critical" }), inc({ status: "resolved", people_count: 5 }), inc({ status: "cancelled" })],
      [{ status: "available" }, { status: "busy" }],
      [
        { is_active: true, capacity: 100, current_occupancy: 40 },
        { is_active: false, capacity: 50, current_occupancy: 0 },
      ],
      [
        { status: "open", duplicate_of: null },
        { status: "open", duplicate_of: "p" },
        { status: "resolved", duplicate_of: null },
      ],
    );
    expect(k).toMatchObject({
      activeSos: 1,
      critical: 1,
      unassigned: 1,
      teamsAvailable: 1,
      teamsTotal: 2,
      peopleAssisted: 5,
      activeShelters: 1,
      shelterOccupancyPct: 40,
      shelterSpaces: 60,
      openHazards: 1,
    });
  });
});

describe("analytics helpers", () => {
  it("buckets SOS per hour by priority", () => {
    const now = new Date("2026-09-30T10:30:00Z");
    const s = hourlySeries([inc({ created_at: "2026-09-30T10:20:00Z", effective_priority: "critical" }), inc({ created_at: "2026-09-29T10:00:00Z" })], 12, now);
    expect(s).toHaveLength(12);
    expect(s.at(-1)?.critical).toBe(1);
    expect(s.reduce((a, b) => a + b.low, 0)).toBe(0);
  });

  it("computes median dispatch-to-arrival minutes", () => {
    expect(
      medianResponseMinutes([
        { assigned_at: "2026-09-30T08:00:00Z", arrived_at: "2026-09-30T08:20:00Z" },
        { assigned_at: "2026-09-30T08:00:00Z", arrived_at: "2026-09-30T08:30:00Z" },
        { assigned_at: "2026-09-30T08:00:00Z", arrived_at: null },
      ]),
    ).toBe(25);
    expect(medianResponseMinutes([])).toBeNull();
  });

  it("ranks available teams first, then by distance", () => {
    const ranked = rankTeamsForIncident(
      [
        { status: "busy" as const, latitude: 27.6935, longitude: 84.415 },
        { status: "available" as const, latitude: 27.75, longitude: 84.5 },
        { status: "available" as const, latitude: 27.7, longitude: 84.42 },
      ],
      { lat: 27.6935, lng: 84.415 },
    );
    expect(ranked.map((t) => t.status)).toEqual(["available", "available", "busy"]);
    expect(ranked[0].distanceM).toBeLessThan(ranked[1].distanceM);
  });
});

describe("friendlyWorkflowError", () => {
  it("maps database error codes to safe messages", () => {
    expect(friendlyWorkflowError("FORBIDDEN: operator role required")).toBe("You do not have permission to do that.");
    expect(friendlyWorkflowError("TEAM_UNAVAILABLE: team R-01 is busy")).toContain("team R-01 is busy");
    expect(friendlyWorkflowError('relation "secret_table" does not exist')).toBe("Something went wrong. Please try again.");
    expect(friendlyWorkflowError(null)).toBe("Something went wrong. Please try again.");
  });
});
