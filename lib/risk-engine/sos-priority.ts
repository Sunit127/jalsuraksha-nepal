/**
 * Transparent SOS priority recommendation (decision support only).
 *
 * The score orders the operator queue. It does not decide who deserves rescue:
 * operators review every request and can override the level. See
 * PROJECT_SPEC.md §12.
 */
import type { RiskCategory } from "./flood-risk";

export type SosSituationKey =
  | "safe_temporarily"
  | "water_entering"
  | "water_rising"
  | "trapped"
  | "medical"
  | "other";

export type PriorityLevelKey = "low" | "moderate" | "high" | "critical";

export type SosPriorityInput = {
  situation: SosSituationKey;
  injured: boolean;
  peopleCount: number;
  childrenCount: number;
  elderlyCount: number;
  /** Risk category of the zone containing the SOS location, if any. */
  zoneRisk?: RiskCategory | null;
};

export type PriorityFactor = { label: string; points: number };

export type SosPriorityResult = {
  score: number;
  level: PriorityLevelKey;
  factors: PriorityFactor[];
};

export const SITUATION_POINTS: Record<SosSituationKey, number> = {
  medical: 30,
  trapped: 30,
  water_rising: 25,
  water_entering: 15,
  other: 10,
  safe_temporarily: 0,
};

export const SITUATION_LABEL: Record<SosSituationKey, string> = {
  safe_temporarily: "Safe temporarily",
  water_entering: "Water entering home",
  water_rising: "Water rising rapidly",
  trapped: "Trapped",
  medical: "Medical emergency",
  other: "Other",
};

export const PRIORITY_RULES = {
  injury: 20,
  perChild: 4,
  maxChildren: 3,
  perElderly: 4,
  maxElderly: 3,
  perExtraPerson: 1,
  maxExtraPeople: 8,
  zone: { high: 5, danger: 10 } as Partial<Record<RiskCategory, number>>,
} as const;

export const PRIORITY_THRESHOLDS: { min: number; level: PriorityLevelKey }[] = [
  { min: 70, level: "critical" },
  { min: 50, level: "high" },
  { min: 30, level: "moderate" },
  { min: 0, level: "low" },
];

export function priorityLevelForScore(score: number): PriorityLevelKey {
  return PRIORITY_THRESHOLDS.find((t) => score >= t.min)?.level ?? "low";
}

const nonNegInt = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

export function calculateSosPriority(input: SosPriorityInput): SosPriorityResult {
  const factors: PriorityFactor[] = [];
  const add = (label: string, points: number) => {
    if (points > 0) factors.push({ label, points });
  };

  add(SITUATION_LABEL[input.situation], SITUATION_POINTS[input.situation] ?? 0);
  if (input.injured) add("Injury reported", PRIORITY_RULES.injury);

  const children = Math.min(nonNegInt(input.childrenCount), PRIORITY_RULES.maxChildren);
  add(
    `${nonNegInt(input.childrenCount)} child${nonNegInt(input.childrenCount) === 1 ? "" : "ren"}`,
    children * PRIORITY_RULES.perChild,
  );

  const elderly = Math.min(nonNegInt(input.elderlyCount), PRIORITY_RULES.maxElderly);
  add(
    `${nonNegInt(input.elderlyCount)} elderly ${nonNegInt(input.elderlyCount) === 1 ? "person" : "people"}`,
    elderly * PRIORITY_RULES.perElderly,
  );

  const people = Math.max(1, nonNegInt(input.peopleCount));
  add(
    `${people} people in group`,
    Math.min(people - 1, PRIORITY_RULES.maxExtraPeople) * PRIORITY_RULES.perExtraPerson,
  );

  if (input.zoneRisk) {
    const zonePoints = PRIORITY_RULES.zone[input.zoneRisk] ?? 0;
    add(`Inside ${input.zoneRisk.toUpperCase()} flood-risk zone`, zonePoints);
  }

  const score = Math.min(
    100,
    factors.reduce((sum, f) => sum + f.points, 0),
  );
  return { score, level: priorityLevelForScore(score), factors };
}

export const PRIORITY_LABEL: Record<PriorityLevelKey, string> = {
  low: "LOW",
  moderate: "MODERATE",
  high: "HIGH",
  critical: "CRITICAL",
};

export const PRIORITY_RANK: Record<PriorityLevelKey, number> = {
  critical: 4,
  high: 3,
  moderate: 2,
  low: 1,
};

export const PRIORITY_DISCLAIMER =
  "Automated priority recommendation — operator review required.";
