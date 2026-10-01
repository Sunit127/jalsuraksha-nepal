import { describe, expect, it } from "vitest";
import {
  calculateSosPriority,
  priorityLevelForScore,
  type SosPriorityInput,
} from "@/lib/risk-engine/sos-priority";

const base: SosPriorityInput = {
  situation: "safe_temporarily",
  injured: false,
  peopleCount: 1,
  childrenCount: 0,
  elderlyCount: 0,
};

describe("priority levels", () => {
  it.each([
    [0, "low"],
    [29, "low"],
    [30, "moderate"],
    [49, "moderate"],
    [50, "high"],
    [69, "high"],
    [70, "critical"],
    [100, "critical"],
  ] as const)("score %i → %s", (score, level) => {
    expect(priorityLevelForScore(score)).toBe(level);
  });
});

describe("calculateSosPriority", () => {
  it("scores the hackathon demo scenario as CRITICAL", () => {
    const r = calculateSosPriority({
      situation: "water_rising",
      injured: true,
      peopleCount: 5,
      childrenCount: 2,
      elderlyCount: 1,
      zoneRisk: "danger",
    });
    // 25 (rising) + 20 (injury) + 8 (2 children) + 4 (1 elderly) + 4 (4 extra people) + 10 (danger zone)
    expect(r.score).toBe(71);
    expect(r.level).toBe("critical");
  });

  it("scores the same request outside a mapped risk zone as HIGH", () => {
    const r = calculateSosPriority({
      situation: "water_rising",
      injured: true,
      peopleCount: 5,
      childrenCount: 2,
      elderlyCount: 1,
    });
    expect(r.score).toBe(61);
    expect(r.level).toBe("high");
  });

  it("gives a person who is temporarily safe a LOW score", () => {
    const r = calculateSosPriority(base);
    expect(r.score).toBe(0);
    expect(r.level).toBe("low");
    expect(r.factors).toEqual([]);
  });

  it("weights medical emergencies and trapped situations highest", () => {
    const medical = calculateSosPriority({ ...base, situation: "medical" });
    const trapped = calculateSosPriority({ ...base, situation: "trapped" });
    const entering = calculateSosPriority({ ...base, situation: "water_entering" });
    expect(medical.score).toBe(30);
    expect(trapped.score).toBe(30);
    expect(entering.score).toBeLessThan(medical.score);
  });

  it("caps children, elderly and group-size contributions", () => {
    const r = calculateSosPriority({
      ...base,
      peopleCount: 60,
      childrenCount: 20,
      elderlyCount: 20,
    });
    // 3×4 + 3×4 + 8 = 32
    expect(r.score).toBe(32);
  });

  it("never exceeds 100", () => {
    const r = calculateSosPriority({
      situation: "medical",
      injured: true,
      peopleCount: 50,
      childrenCount: 10,
      elderlyCount: 10,
      zoneRisk: "danger",
    });
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("lists every contributing factor with its points (transparency)", () => {
    const r = calculateSosPriority({
      situation: "trapped",
      injured: true,
      peopleCount: 3,
      childrenCount: 1,
      elderlyCount: 0,
      zoneRisk: "high",
    });
    expect(r.factors).toEqual([
      { label: "Trapped", points: 30 },
      { label: "Injury reported", points: 20 },
      { label: "1 child", points: 4 },
      { label: "3 people in group", points: 2 },
      { label: "Inside HIGH flood-risk zone", points: 5 },
    ]);
    expect(r.score).toBe(61);
  });

  it("handles invalid counts defensively", () => {
    const r = calculateSosPriority({
      ...base,
      peopleCount: Number.NaN,
      childrenCount: -3,
      elderlyCount: Number.POSITIVE_INFINITY,
    });
    expect(r.score).toBe(0);
  });
});
