/**
 * Transparent, rule-based flood risk scoring (decision support only).
 *
 * This is NOT a forecast and NOT machine learning. Each input is normalised to
 * 0–1 with a documented rule, multiplied by a configurable weight, and summed
 * to a 0–100 score. Every contribution is returned so the UI can explain it.
 * See PROJECT_SPEC.md §11.
 */

export type RiskCategory = "safe" | "watch" | "high" | "danger";

export type FloodRiskInput = {
  /** Current river level (m) at the nearest gauge. */
  riverLevelM: number;
  /** Official warning level (m) for that gauge. */
  warningLevelM: number;
  /** Official danger level (m) for that gauge. */
  dangerLevelM: number;
  /** Rainfall in the last 24 h (mm). */
  rainfallMm24h: number;
  /** Distance from the area to the river bank (m). */
  distanceToRiverM: number;
  /** 0 (high ground) – 1 (low-lying / historically inundated). */
  elevationVulnerability: number;
  /** Open community hazard reports within the area. */
  communityReports: number;
  /** 0 (all roads open) – 1 (all access roads cut). */
  roadAccessReduction: number;
  /**
   * Live data quality. A gauge with no recent reading must not count as a
   * calm river: its factor is excluded and labelled instead (default true).
   */
  riverAvailable?: boolean;
  rainfallAvailable?: boolean;
  /** Gauge / rain station names and reading age, shown in the explanation. */
  riverSource?: string;
  rainfallSource?: string;
  /** True when the gauge publishes no danger level (warning level used). */
  dangerLevelEstimated?: boolean;
};

export type RiskFactorKey =
  | "river"
  | "rainfall"
  | "proximity"
  | "elevation"
  | "reports"
  | "roads";

export type RiskWeights = Record<RiskFactorKey, number>;

export const DEFAULT_RISK_WEIGHTS: RiskWeights = {
  river: 30,
  rainfall: 20,
  proximity: 15,
  elevation: 10,
  reports: 15,
  roads: 10,
};

export type RiskFactor = {
  key: RiskFactorKey;
  label: string;
  /** Normalised input 0–1. */
  normalized: number;
  weight: number;
  /** Points added to the score (normalized × weight, rounded). */
  contribution: number;
  /** Plain-language description of the observed input. */
  detail: string;
};

export type FloodRiskResult = {
  score: number;
  category: RiskCategory;
  factors: RiskFactor[];
};

export const RISK_THRESHOLDS: { max: number; category: RiskCategory }[] = [
  { max: 25, category: "safe" },
  { max: 50, category: "watch" },
  { max: 75, category: "high" },
  { max: 100, category: "danger" },
];

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** Linear ramp: 0 at `from`, 1 at `to` (works for descending ramps too). */
export function ramp(value: number, from: number, to: number): number {
  if (from === to) return value >= to ? 1 : 0;
  return clamp01((value - from) / (to - from));
}

export function riskCategoryForScore(score: number): RiskCategory {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return RISK_THRESHOLDS.find((t) => s <= t.max)?.category ?? "danger";
}

/** River factor: 0 below 80% of the warning level, 1 at/above danger level. */
export function normalizeRiver(level: number, warning: number, danger: number): number {
  return ramp(level, warning * 0.8, danger);
}

/** Rainfall factor: 0 at ≤20 mm/24h, 1 at ≥150 mm/24h. */
export function normalizeRainfall(mm: number): number {
  return ramp(mm, 20, 150);
}

/** Proximity factor: 1 within 250 m of the river, 0 beyond 3 km. */
export function normalizeProximity(distanceM: number): number {
  return ramp(distanceM, 3000, 250);
}

/** Community report factor: 0 with no reports, 1 at 5 or more. */
export function normalizeReports(count: number): number {
  return ramp(count, 0, 5);
}

function validateWeights(weights: RiskWeights): RiskWeights {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total <= 0 || Object.values(weights).some((w) => w < 0 || !Number.isFinite(w))) {
    throw new Error("Risk weights must be non-negative and sum to more than 0");
  }
  // Scale so the maximum possible score is always 100.
  if (Math.abs(total - 100) < 1e-9) return weights;
  const scale = 100 / total;
  return Object.fromEntries(
    Object.entries(weights).map(([k, w]) => [k, w * scale]),
  ) as RiskWeights;
}

export function calculateFloodRisk(
  input: FloodRiskInput,
  weights: RiskWeights = DEFAULT_RISK_WEIGHTS,
): FloodRiskResult {
  const w = validateWeights(weights);

  const riverPct =
    input.dangerLevelM > 0 ? Math.round((input.riverLevelM / input.dangerLevelM) * 100) : 0;
  const riverState =
    input.riverLevelM >= input.dangerLevelM
      ? "above danger level"
      : input.riverLevelM >= input.warningLevelM
        ? "above warning level"
        : "below warning level";

  const riverAvailable = input.riverAvailable !== false;
  const rainfallAvailable = input.rainfallAvailable !== false;
  const riverSuffix = input.riverSource ? ` · ${input.riverSource}` : "";
  const rainSuffix = input.rainfallSource ? ` · ${input.rainfallSource}` : "";

  const raw: Omit<RiskFactor, "contribution">[] = [
    {
      key: "river",
      label: "River warning level",
      normalized: riverAvailable ? normalizeRiver(input.riverLevelM, input.warningLevelM, input.dangerLevelM) : 0,
      weight: w.river,
      detail: !riverAvailable
        ? `No recent gauge reading — river level not included${riverSuffix}`
        : input.dangerLevelEstimated
          ? `${input.riverLevelM.toFixed(1)} m — ${input.riverLevelM >= input.warningLevelM ? "above" : "below"} warning level ${input.warningLevelM.toFixed(1)} m (no official danger level; full weight at warning)${riverSuffix}`
          : `${input.riverLevelM.toFixed(1)} m — ${riverState} (${riverPct}% of danger level ${input.dangerLevelM.toFixed(1)} m)${riverSuffix}`,
    },
    {
      key: "rainfall",
      label: "Rainfall intensity",
      normalized: rainfallAvailable ? normalizeRainfall(input.rainfallMm24h) : 0,
      weight: w.rainfall,
      detail: rainfallAvailable
        ? `${Math.round(input.rainfallMm24h)} mm in the last 24 h${rainSuffix}`
        : `No recent rainfall reading — not included${rainSuffix}`,
    },
    {
      key: "proximity",
      label: "Distance from river",
      normalized: normalizeProximity(input.distanceToRiverM),
      weight: w.proximity,
      detail:
        input.distanceToRiverM >= 1000
          ? `${(input.distanceToRiverM / 1000).toFixed(1)} km from the river bank`
          : `${Math.round(input.distanceToRiverM)} m from the river bank`,
    },
    {
      key: "elevation",
      label: "Low-lying terrain",
      normalized: clamp01(input.elevationVulnerability),
      weight: w.elevation,
      detail:
        input.elevationVulnerability >= 0.7
          ? "Low-lying, historically inundated"
          : input.elevationVulnerability >= 0.4
            ? "Moderately low terrain"
            : "Relatively high ground",
    },
    {
      key: "reports",
      label: "Community hazard reports",
      normalized: normalizeReports(input.communityReports),
      weight: w.reports,
      detail: `${input.communityReports} open report${input.communityReports === 1 ? "" : "s"} nearby`,
    },
    {
      key: "roads",
      label: "Road access reduced",
      normalized: clamp01(input.roadAccessReduction),
      weight: w.roads,
      detail:
        input.roadAccessReduction <= 0
          ? "All access roads open"
          : `${Math.round(input.roadAccessReduction * 100)}% of access routes affected`,
    },
  ];

  const factors: RiskFactor[] = raw.map((f) => ({
    ...f,
    contribution: Math.round(f.normalized * f.weight),
  }));

  const score = Math.max(
    0,
    Math.min(100, factors.reduce((sum, f) => sum + f.contribution, 0)),
  );

  return { score, category: riskCategoryForScore(score), factors };
}

export const RISK_CATEGORY_LABEL: Record<RiskCategory, string> = {
  safe: "SAFE",
  watch: "WATCH",
  high: "HIGH",
  danger: "DANGER",
};

export const RISK_CATEGORY_HEADLINE: Record<RiskCategory, string> = {
  safe: "Low flood risk",
  watch: "Flood watch",
  high: "High flood risk",
  danger: "Flood danger",
};
