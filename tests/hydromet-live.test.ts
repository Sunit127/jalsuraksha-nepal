import { describe, expect, it } from "vitest";
import { applyLiveReadings, gaugeAlertLevel, isFresh, pickRainStation, pickRiverStation, type HydrometStation } from "@/lib/hydromet/live";
import { scoreZone } from "@/lib/risk-engine/zones";
import type { RiskZone } from "@/types/domain";

const NOW = new Date("2026-10-01T04:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

function station(p: Partial<HydrometStation> & Pick<HydrometStation, "id" | "kind" | "name">): HydrometStation {
  return {
    basin: "Narayani",
    latitude: 27.71,
    longitude: 84.43,
    district_code: 35,
    municipality_code: 35001,
    warning_level_m: null,
    danger_level_m: null,
    water_level_m: null,
    trend: null,
    official_status: null,
    rain_1h_mm: null,
    rain_3h_mm: null,
    rain_6h_mm: null,
    rain_12h_mm: null,
    rain_24h_mm: null,
    observed_at: hoursAgo(0.5),
    fetched_at: NOW.toISOString(),
    data_source: "DHM (hydrology.gov.np) via BIPAD portal",
    source_url: null,
    updated_at: NOW.toISOString(),
    ...p,
  };
}

const devghat = station({ id: "bipad:river:25", kind: "river", name: "Narayani at Devghat", water_level_m: 4.74, warning_level_m: 7.3, danger_level_m: 9.0, trend: "STEADY" });
const rain = station({ id: "bipad:rain:280", kind: "rain", name: "Narayani Field Office", latitude: 27.677, longitude: 84.435, rain_1h_mm: 2, rain_24h_mm: 64 });

const zone = {
  id: "z1",
  name: "Narayani Riverside",
  district: "Chitwan",
  municipality: "Bharatpur",
  river_basin: "Narayani",
  river_name: "Narayani",
  polygon: [[27.69, 84.40], [27.70, 84.42], [27.68, 84.43]],
  center_latitude: 27.69,
  center_longitude: 84.415,
  radius_m: 1500,
  river_level_m: 7.9,
  warning_level_m: 6.5,
  danger_level_m: 7.5,
  rainfall_mm_24h: 140,
  distance_to_river_m: 200,
  elevation_vulnerability: 0.8,
  road_access_reduction: 0.3,
  source_type: "simulated",
  observed_at: hoursAgo(1),
  river_station_id: null,
  rain_station_id: null,
} as unknown as RiskZone;

describe("freshness", () => {
  it("treats readings older than the window as stale", () => {
    expect(isFresh(hoursAgo(1), 6, NOW)).toBe(true);
    expect(isFresh(hoursAgo(7), 6, NOW)).toBe(false);
    expect(isFresh(null, 6, NOW)).toBe(false);
  });
});

describe("station selection", () => {
  it("picks the gauge on the zone's own river and the nearest live rain station", () => {
    const otherRiver = station({ id: "bipad:river:70", kind: "river", name: "East Rapti at Rajaiya", water_level_m: 1.3, warning_level_m: 3.3, latitude: 27.69, longitude: 84.42 });
    expect(pickRiverStation(zone, [otherRiver, devghat], NOW)?.id).toBe("bipad:river:25");
    expect(pickRainStation(zone, [rain], NOW)?.id).toBe("bipad:rain:280");
  });
});

describe("applyLiveReadings", () => {
  it("replaces simulated values with fresh official readings", () => {
    const [live] = applyLiveReadings([zone], [devghat, rain], "live", NOW);
    expect(Number(live.river_level_m)).toBe(4.74);
    expect(Number(live.danger_level_m)).toBe(9);
    expect(Number(live.rainfall_mm_24h)).toBe(64);
    expect(live.source_type).toBe("official");
    expect(live.reading.river?.fresh).toBe(true);
  });

  it("never uses a stale 'above danger' reading as the current level", () => {
    const stale = { ...devghat, water_level_m: 10.4, official_status: "ABOVE DANGER LEVEL", observed_at: hoursAgo(24 * 30) };
    const [live] = applyLiveReadings([zone], [stale], "live", NOW);
    expect(live.reading.river?.fresh).toBe(false);
    expect(gaugeAlertLevel(stale, NOW)).toBeNull();
    const scored = scoreZone(live, []);
    const river = scored.risk.factors.find((f) => f.key === "river")!;
    expect(river.contribution).toBe(0);
    expect(river.detail).toMatch(/No recent gauge reading/);
  });

  it("leaves zones untouched in simulation mode", () => {
    const [sim] = applyLiveReadings([zone], [devghat], "simulation", NOW);
    expect(Number(sim.river_level_m)).toBe(7.9);
    expect(sim.reading.mode).toBe("simulation");
  });
});

describe("gaugeAlertLevel", () => {
  it("raises warning/danger only from fresh readings at official thresholds", () => {
    expect(gaugeAlertLevel(devghat, NOW)).toBeNull();
    expect(gaugeAlertLevel({ ...devghat, water_level_m: 7.5 }, NOW)).toBe("warning");
    expect(gaugeAlertLevel({ ...devghat, water_level_m: 9.2 }, NOW)).toBe("danger");
    // No published danger level: never claims "danger", warning still applies.
    expect(gaugeAlertLevel({ ...devghat, danger_level_m: null, water_level_m: 9.5 }, NOW)).toBe("warning");
  });
});
