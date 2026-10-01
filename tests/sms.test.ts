import { describe, expect, it } from "vitest";
import { parseSosSms } from "@/lib/services/sms";

describe("parseSosSms", () => {
  it("parses the canonical 'SOS 5 2 1' format", () => {
    expect(parseSosSms("SOS 5 2 1")).toMatchObject({
      ok: true,
      peopleCount: 5,
      childrenCount: 2,
      elderlyCount: 1,
      injured: false,
      situation: "water_rising",
    });
  });

  it("is case-insensitive and understands keywords", () => {
    expect(parseSosSms("  sos 3 0 1 inj med ")).toMatchObject({
      ok: true,
      peopleCount: 3,
      injured: true,
      situation: "medical",
    });
  });

  it("keeps free text as the description", () => {
    const r = parseSosSms("SOS 4 TRAP roof of blue house");
    expect(r).toMatchObject({ ok: true, peopleCount: 4, situation: "trapped" });
    if (r.ok) expect(r.description).toContain("roof of blue house");
  });

  it("defaults to one person", () => {
    expect(parseSosSms("SOS")).toMatchObject({ ok: true, peopleCount: 1, childrenCount: 0, elderlyCount: 0 });
  });

  it("rejects messages that are not SOS", () => {
    expect(parseSosSms("hello")).toMatchObject({ ok: false });
    expect(parseSosSms("")).toMatchObject({ ok: false });
  });

  it("rejects impossible counts", () => {
    expect(parseSosSms("SOS 2 3 1")).toMatchObject({ ok: false });
    expect(parseSosSms("SOS 0")).toMatchObject({ ok: false });
  });
});
