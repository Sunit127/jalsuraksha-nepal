import { describe, expect, it } from "vitest";
import {
  calculateFloodRisk,
  DEFAULT_RISK_WEIGHTS,
  normalizeProximity,
  normalizeRainfall,
  normalizeRiver,
  riskCategoryForScore,
  type FloodRiskInput,
} from "@/lib/risk-engine/flood-risk";

const base: FloodRiskInput = {
  riverLevelM: 3,
  warningLevelM: 6.5,
  dangerLevelM: 7.5,
  rainfallMm24h: 0,
  distanceToRiverM: 5000,
  elevationVulnerability: 0,
  communityReports: 0,
  roadAccessReduction: 0,
};

describe("risk categories", () => {
  it.each([
    [0, "safe"],
    [25, "safe"],
    [26, "watch"],
    [50, "watch"],
    [51, "high"],
    [75, "high"],
    [76, "danger"],
    [100, "danger"],
  ] as const)("score %i → %s", (score, category) => {
    expect(riskCategoryForScore(score)).toBe(category);
  });
});

describe("normalisation rules", () => {
  it("river factor ramps from 80% of warning level to danger level", () => {
    expect(normalizeRiver(5.2, 6.5, 7.5)).toBe(0);
    expect(normalizeRiver(7.5, 6.5, 7.5)).toBe(1);
    expect(normalizeRiver(9, 6.5, 7.5)).toBe(1);
    expect(normalizeRiver(6.35, 6.5, 7.5)).toBeCloseTo(0.5, 5);
  });

  it("rainfall factor is 0 at ≤20 mm and 1 at ≥150 mm", () => {
    expect(normalizeRainfall(10)).toBe(0);
    expect(normalizeRainfall(150)).toBe(1);
    expect(normalizeRainfall(85)).toBeCloseTo(0.5, 5);
  });

  it("proximity factor is 1 within 250 m and 0 beyond 3 km", () => {
    expect(normalizeProximity(100)).toBe(1);
    expect(normalizeProximity(3500)).toBe(0);
    expect(normalizeProximity(1625)).toBeCloseTo(0.5, 5);
  });
});

describe("calculateFloodRisk", () => {
  it("returns 0 / SAFE when every input is benign", () => {
    const r = calculateFloodRisk(base);
    expect(r.score).toBe(0);
    expect(r.category).toBe("safe");
  });

  it("returns 100 / DANGER when every input is at its maximum", () => {
    const r = calculateFloodRisk({
      riverLevelM: 8,
      warningLevelM: 6.5,
      dangerLevelM: 7.5,
      rainfallMm24h: 200,
      distanceToRiverM: 50,
      elevationVulnerability: 1,
      communityReports: 9,
      roadAccessReduction: 1,
    });
    expect(r.score).toBe(100);
    expect(r.category).toBe("danger");
  });

  it("explains the score: contributions sum to the score and include every factor", () => {
    const r = calculateFloodRisk({
      ...base,
      riverLevelM: 7.9,
      rainfallMm24h: 140,
      distanceToRiverM: 150,
      elevationVulnerability: 0.9,
      communityReports: 2,
      roadAccessReduction: 0.6,
    });
    expect(r.factors.map((f) => f.key)).toEqual([
      "river",
      "rainfall",
      "proximity",
      "elevation",
      "reports",
      "roads",
    ]);
    expect(r.factors.reduce((s, f) => s + f.contribution, 0)).toBe(r.score);
    expect(r.factors.find((f) => f.key === "river")?.contribution).toBe(30);
    expect(r.factors.find((f) => f.key === "river")?.detail).toMatch(/above danger level/);
    expect(r.score).toBe(84);
    expect(r.category).toBe("danger");
  });

  it("supports configurable weights and rescales them to 100", () => {
    const riverOnly = { river: 1, rainfall: 0, proximity: 0, elevation: 0, reports: 0, roads: 0 };
    const r = calculateFloodRisk({ ...base, riverLevelM: 7.5 }, riverOnly);
    expect(r.score).toBe(100);
    expect(r.factors.find((f) => f.key === "river")?.weight).toBe(100);
  });

  it("rejects invalid weights", () => {
    expect(() =>
      calculateFloodRisk(base, { ...DEFAULT_RISK_WEIGHTS, river: -5 }),
    ).toThrow();
    expect(() =>
      calculateFloodRisk(base, {
        river: 0,
        rainfall: 0,
        proximity: 0,
        elevation: 0,
        reports: 0,
        roads: 0,
      }),
    ).toThrow();
  });

  it("treats non-finite inputs as zero instead of producing NaN", () => {
    const r = calculateFloodRisk({ ...base, elevationVulnerability: Number.NaN });
    expect(Number.isNaN(r.score)).toBe(false);
  });
});
