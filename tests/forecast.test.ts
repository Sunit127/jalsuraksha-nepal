import { describe, expect, it } from "vitest";
import { isEarlyWarning, rainLevel, summarizeHourly } from "@/lib/hydromet/forecast";

describe("rain forecast", () => {
  it("uses DHM/IMD 24-hour bands", () => {
    expect(rainLevel(1)).toBe("none");
    expect(rainLevel(20)).toBe("moderate");
    expect(rainLevel(70)).toBe("heavy");
    expect(rainLevel(120)).toBe("very_heavy");
    expect(rainLevel(210)).toBe("extreme");
  });
  it("sums the next 24/48 h and rates by the wettest day", () => {
    const times = Array.from({ length: 48 }, (_, i) => `t${i}`);
    const mm = [...Array(24).fill(0.5), ...Array(24).fill(3)];
    const s = summarizeHourly(times, mm);
    expect(s.next24Mm).toBe(12);
    expect(s.next48Mm).toBe(84);
    expect(s.level).toBe("heavy");
    expect(s.peakAt).toBe("t24");
    expect(isEarlyWarning(s)).toBe(true);
  });
});
