import { describe, expect, it } from "vitest";
import { assembleOuterRing, dedupeFacilities, nameKey } from "@/lib/services/reference-data";

describe("dedupeFacilities", () => {
  const at = (name: string, lat = 27.6809, lng = 84.4333, kind = "hospital") => ({ name, latitude: lat, longitude: lng, kind });

  it("merges the same hospital listed under several spellings", () => {
    const out = dedupeFacilities([
      at("Aasha Hospital Pvt Ltd"),
      at("Aasha Hospital_Chitawan", 27.6809, 84.4332),
      at("asha hospital", 27.6809, 84.4334),
      at("Asha Hospital pvt.ltd", 27.6804, 84.4333),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Aasha Hospital Pvt Ltd");
  });

  it("keeps different facilities, far-apart namesakes and other kinds", () => {
    const out = dedupeFacilities([
      at("Alive Hospital"),
      at("Bharatpur District Hospital", 27.6812, 84.4334),
      at("Alive Hospital", 27.7, 84.45),
      at("Alive Hospital", 27.6809, 84.4333, "helipad"),
    ]);
    expect(out).toHaveLength(4);
  });

  it("does not merge schools that only share generic words", () => {
    const school = (name: string, lng: number) => ({ name, latitude: 27.68, longitude: lng, kind: "school" });
    expect(dedupeFacilities([school("Gyandarshan English School", 84.43), school("Aroma English School", 84.4304)], 60)).toHaveLength(2);
    expect(dedupeFacilities([school("Amber Everest Boarding School", 84.43), school("amber everest eng boarding school", 84.4302)], 60)).toHaveLength(1);
  });

  it("normalises names to distinctive tokens", () => {
    expect([...nameKey("Aasha Hospital Pvt. Ltd, Chitawan")]).toEqual(["asha"]);
  });
});

describe("assembleOuterRing", () => {
  it("joins boundary ways (in any direction) into one closed ring", () => {
    const way = (pts: [number, number][]) => ({ type: "way", role: "outer", geometry: pts.map(([lat, lon]) => ({ lat, lon })) });
    const ring = assembleOuterRing([
      way([[0, 0], [0, 1]]),
      way([[1, 1], [0, 1]]), // reversed
      way([[1, 1], [1, 0], [0, 0]]),
    ]);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(ring).toHaveLength(5);
  });
});
