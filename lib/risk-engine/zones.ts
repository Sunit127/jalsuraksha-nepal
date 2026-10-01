import type { HazardReport, LatLng, RiskZone } from "@/types/domain";
import { parsePolygon, pointInPolygon } from "@/lib/utilities/geo";
import {
  calculateFloodRisk,
  DEFAULT_RISK_WEIGHTS,
  type FloodRiskResult,
  type RiskCategory,
  type RiskWeights,
} from "./flood-risk";

export type ZoneRiskInputRow = Pick<
  RiskZone,
  | "id"
  | "name"
  | "polygon"
  | "river_level_m"
  | "warning_level_m"
  | "danger_level_m"
  | "rainfall_mm_24h"
  | "distance_to_river_m"
  | "elevation_vulnerability"
  | "road_access_reduction"
>;

export type HazardForRisk = Pick<HazardReport, "latitude" | "longitude" | "status" | "duplicate_of"> &
  Partial<Pick<HazardReport, "source_type">>;

export type ScoredZone<Z extends ZoneRiskInputRow = RiskZone> = Z & {
  risk: FloodRiskResult;
  communityReports: number;
};

const RISK_ORDER: Record<RiskCategory, number> = { safe: 0, watch: 1, high: 2, danger: 3 };

/** Open, non-duplicate community reports that fall inside the zone polygon. */
export function countReportsInZone(zone: Pick<RiskZone, "polygon">, hazards: HazardForRisk[]) {
  const polygon = parsePolygon(zone.polygon);
  if (polygon.length < 3) return 0;
  return hazards.filter(
    (h) =>
      (h.status === "open" || h.status === "verified") &&
      !h.duplicate_of &&
      pointInPolygon({ lat: h.latitude, lng: h.longitude }, polygon),
  ).length;
}

/** Live-data flags attached by lib/hydromet/live.ts (absent for plain zones). */
type ReadingFlags = {
  reading?: {
    mode: "live" | "simulation";
    river: { fresh: boolean; stationName: string; dangerEstimated: boolean } | null;
    rain: { fresh: boolean; stationName: string } | null;
  };
};

export function scoreZone<Z extends ZoneRiskInputRow>(
  zone: Z,
  hazards: HazardForRisk[],
  weights: RiskWeights = DEFAULT_RISK_WEIGHTS,
): ScoredZone<Z> {
  const reading = (zone as Z & ReadingFlags).reading;
  const live = reading?.mode === "live";
  // Live mode: simulated demo reports must not move a real risk level.
  const communityReports = countReportsInZone(zone, live ? hazards.filter((h) => h.source_type !== "simulated") : hazards);
  const risk = calculateFloodRisk(
    {
      riverLevelM: Number(zone.river_level_m),
      warningLevelM: Number(zone.warning_level_m),
      dangerLevelM: Number(zone.danger_level_m),
      rainfallMm24h: Number(zone.rainfall_mm_24h),
      distanceToRiverM: Number(zone.distance_to_river_m),
      elevationVulnerability: Number(zone.elevation_vulnerability),
      communityReports,
      roadAccessReduction: Number(zone.road_access_reduction),
      ...(live && {
        riverAvailable: Boolean(reading.river?.fresh),
        rainfallAvailable: Boolean(reading.rain?.fresh),
        riverSource: reading.river ? `DHM gauge: ${reading.river.stationName}` : "no DHM gauge for this river nearby",
        rainfallSource: reading.rain ? `rain station: ${reading.rain.stationName}` : "no live rain station nearby",
        dangerLevelEstimated: Boolean(reading.river?.fresh && reading.river.dangerEstimated),
      }),
    },
    weights,
  );
  return { ...zone, risk, communityReports };
}

export function scoreZones<Z extends ZoneRiskInputRow>(
  zones: Z[],
  hazards: HazardForRisk[],
  weights?: RiskWeights,
): ScoredZone<Z>[] {
  return zones.map((z) => scoreZone(z, hazards, weights));
}

/** The highest-risk zone containing the point, or null. */
export function zoneForPoint<Z extends ZoneRiskInputRow>(
  point: LatLng,
  zones: ScoredZone<Z>[],
): ScoredZone<Z> | null {
  let best: ScoredZone<Z> | null = null;
  for (const z of zones) {
    if (!pointInPolygon(point, parsePolygon(z.polygon))) continue;
    if (!best || RISK_ORDER[z.risk.category] > RISK_ORDER[best.risk.category] ||
      (z.risk.category === best.risk.category && z.risk.score > best.risk.score)) {
      best = z;
    }
  }
  return best;
}

export function highestRiskZone<Z extends ZoneRiskInputRow>(zones: ScoredZone<Z>[]) {
  return zones.reduce<ScoredZone<Z> | null>(
    (best, z) => (!best || z.risk.score > best.risk.score ? z : best),
    null,
  );
}
