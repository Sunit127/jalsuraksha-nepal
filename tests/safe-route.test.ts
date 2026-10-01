import { describe, expect, it } from "vitest";
import { buildDemoDataset } from "@/lib/demo/dataset";
import { DEMO_BRIDGE, DEMO_CITIZEN_LOCATION } from "@/lib/demo/scenario";
import { scoreZones } from "@/lib/risk-engine/zones";
import { findSafeRoute, isBlockingHazard, type RouteHazard, type RouteShelter } from "@/lib/routing/safe-route";

const data = buildDemoDataset(() => new Date().toISOString());
const hazards: RouteHazard[] = data.hazard_reports.map((h) => ({
  id: h.id!,
  type: h.type,
  severity: h.severity ?? "medium",
  status: h.status ?? "open",
  latitude: h.latitude,
  longitude: h.longitude,
  location_name: h.location_name ?? null,
  duplicate_of: h.duplicate_of ?? null,
}));
const shelters: RouteShelter[] = data.shelters.map((s) => ({
  id: s.id!,
  name: s.name,
  latitude: s.latitude,
  longitude: s.longitude,
  capacity: s.capacity,
  current_occupancy: s.current_occupancy ?? 0,
  remaining_capacity: s.capacity - (s.current_occupancy ?? 0),
  is_active: true,
}));
const zones = scoreZones(data.risk_zones as never, hazards as never);
const from = { lat: DEMO_CITIZEN_LOCATION.lat, lng: DEMO_CITIZEN_LOCATION.lng };

const bridgeHazard: RouteHazard = {
  id: "bridge-hazard",
  type: "blocked_bridge",
  severity: "critical",
  status: "verified",
  latitude: DEMO_BRIDGE.lat,
  longitude: DEMO_BRIDGE.lng,
  location_name: DEMO_BRIDGE.locationName,
  duplicate_of: null,
};

describe("isBlockingHazard", () => {
  const base = { ...bridgeHazard };
  it("blocks road-cutting hazard types", () => {
    expect(isBlockingHazard(base, new Set())).toBe(true);
    expect(isBlockingHazard({ ...base, type: "landslide" }, new Set())).toBe(true);
  });
  it("only blocks waterlogging when severe", () => {
    expect(isBlockingHazard({ ...base, type: "waterlogging", severity: "medium" }, new Set())).toBe(false);
    expect(isBlockingHazard({ ...base, type: "waterlogging", severity: "high" }, new Set())).toBe(true);
  });
  it("ignores resolved or rejected reports", () => {
    expect(isBlockingHazard({ ...base, status: "resolved" }, new Set())).toBe(false);
    expect(isBlockingHazard({ ...base, status: "rejected" }, new Set())).toBe(false);
  });
  it("blocks anything the user explicitly avoids", () => {
    expect(isBlockingHazard({ ...base, type: "other", severity: "low" }, new Set([base.id]))).toBe(true);
  });
});

describe("findSafeRoute — demo scenario", () => {
  it("routes to Balkumari over the Riverside Link Bridge (route A) at first", () => {
    const r = findSafeRoute({ from, shelters, hazards, zones });
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.shelter.name).toBe("Balkumari Evacuation Centre");
    expect(r.waypoints).toContain("Riverside Link Bridge");
    expect(r.distanceM).toBeGreaterThan(1500);
    expect(r.distanceM).toBeLessThan(2500);
    // The southern road is already blocked by the verified flooded-road report.
    expect(r.waypoints).not.toContain("South Riverside Road");
  });

  it("re-routes around the bridge once it is reported flooded (route B)", () => {
    const before = findSafeRoute({ from, shelters, hazards, zones });
    const after = findSafeRoute({ from, shelters, hazards: [...hazards, bridgeHazard], zones });
    expect(after.status).toBe("ok");
    if (after.status !== "ok" || before.status !== "ok") return;
    expect(after.key).not.toBe(before.key);
    expect(after.waypoints).not.toContain("Riverside Link Bridge");
    expect(after.waypoints).toContain("Pulchowk Road");
    expect(after.blockedBaseline?.blockedBy.map((h) => h.id)).toContain("bridge-hazard");
    expect(after.distanceM).toBeGreaterThan(before.distanceM);
  });

  it("honours an explicit 'avoid this hazard' request", () => {
    const erosion = hazards.find((h) => h.type === "other")!;
    const r = findSafeRoute({ from, shelters, hazards: [...hazards, { ...erosion, id: "x", latitude: 27.6912, longitude: 84.418 }], zones, avoidHazardIds: ["x"] });
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.waypoints).not.toContain("Riverside Lane");
  });

  it("skips full shelters", () => {
    const full = shelters.map((s) => (s.name.startsWith("Balkumari") ? { ...s, remaining_capacity: 0, current_occupancy: s.capacity } : s));
    const r = findSafeRoute({ from, shelters: full, hazards, zones });
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.shelter.name).not.toBe("Balkumari Evacuation Centre");
  });

  it("reports no_route when every road out is blocked", () => {
    const blockers: RouteHazard[] = [
      { ...bridgeHazard, id: "n", latitude: 27.6948, longitude: 84.4169 },
      { ...bridgeHazard, id: "e", latitude: 27.6924, longitude: 84.4165 },
      { ...bridgeHazard, id: "s", latitude: 27.6912, longitude: 84.4151 },
    ];
    const r = findSafeRoute({ from, shelters, hazards: [...hazards, ...blockers], zones });
    expect(r.status).toBe("no_route");
  });

  it("does not trap the user behind a hazard reported at their own position", () => {
    const here: RouteHazard = { ...bridgeHazard, id: "here", type: "flooded_road", status: "open", latitude: from.lat, longitude: from.lng };
    const r = findSafeRoute({ from, shelters, hazards: [...hazards, here], zones });
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.cautions.map((c) => c.id)).toContain("here");
  });

  it("explains when the user is outside the demo network", () => {
    const r = findSafeRoute({ from: { lat: 27.7172, lng: 85.324 }, shelters, hazards, zones });
    expect(r.status).toBe("out_of_area");
  });
});
