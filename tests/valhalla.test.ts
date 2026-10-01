import { describe, expect, it, vi } from "vitest";
import { decodePolyline6, distanceToPathM, exclusionRing, findRealSafeRoute } from "@/lib/routing/valhalla";
import type { RouteHazard, RouteShelter } from "@/lib/routing/safe-route";

/** Encodes points as a precision-6 polyline (test helper). */
function encode6(points: [number, number][]): string {
  let out = "";
  let pLat = 0;
  let pLng = 0;
  const enc = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    let s = "";
    while (n >= 0x20) {
      s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    return s + String.fromCharCode(n + 63);
  };
  for (const [lat, lng] of points) {
    const la = Math.round(lat * 1e6);
    const lo = Math.round(lng * 1e6);
    out += enc(la - pLat) + enc(lo - pLng);
    pLat = la;
    pLng = lo;
  }
  return out;
}

const from = { lat: 27.6935, lng: 84.415 };
const shelter: RouteShelter = { id: "s1", name: "Balkumari", latitude: 27.6858, longitude: 84.4322, capacity: 100, current_occupancy: 10, remaining_capacity: 90, is_active: true };
const direct: [number, number][] = [[27.6935, 84.415], [27.689, 84.423], [27.6858, 84.4322]];
const detour: [number, number][] = [[27.6935, 84.415], [27.698, 84.424], [27.6858, 84.4322]];
const bridge: RouteHazard = { id: "h1", type: "blocked_bridge", severity: "critical", status: "verified", latitude: 27.689, longitude: 84.423, location_name: "Riverside Link Bridge", duplicate_of: null };

function trip(points: [number, number][], km: number) {
  return new Response(JSON.stringify({ trip: { summary: { length: km, time: km * 800 }, legs: [{ shape: encode6(points), maneuvers: [{ street_names: ["Hospital Road"], instruction: "Walk" }] }] } }), { status: 200 });
}

describe("geometry helpers", () => {
  it("decodes precision-6 polylines", () => {
    const pts = decodePolyline6(encode6(direct));
    expect(pts).toHaveLength(3);
    expect(pts[2].lat).toBeCloseTo(27.6858, 5);
    expect(pts[2].lng).toBeCloseTo(84.4322, 5);
  });

  it("builds a closed exclusion ring in [lon, lat] order", () => {
    const ring = exclusionRing({ lat: 27.689, lng: 84.423 }, 60);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(ring[0][0]).toBeGreaterThan(84);
  });

  it("measures distance from a point to a path", () => {
    expect(distanceToPathM({ lat: 27.689, lng: 84.423 }, decodePolyline6(encode6(direct)))).toBeLessThan(5);
  });
});

describe("findRealSafeRoute", () => {
  it("routes around a blocking hazard and reports the blocked normal route", async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      return body.exclude_polygons ? trip(detour, 2.7) : trip(direct, 1.9);
    });
    const r = await findRealSafeRoute("http://valhalla", { from, shelters: [shelter], hazards: [bridge] }, fetchImpl as unknown as typeof fetch);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.distanceM).toBe(2700);
    expect(r.blockedBaseline?.blockedBy.map((h) => h.id)).toEqual(["h1"]);
    const sent = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(sent.costing).toBe("pedestrian");
    expect(sent.exclude_polygons).toHaveLength(1);
  });

  it("does not exclude a hazard at the person's own position", async () => {
    const here: RouteHazard = { ...bridge, id: "here", type: "flooded_road", latitude: from.lat, longitude: from.lng };
    const fetchImpl = vi.fn(async () => trip(direct, 1.9));
    const r = await findRealSafeRoute("http://valhalla", { from, shelters: [shelter], hazards: [here] }, fetchImpl as unknown as typeof fetch);
    expect(r.status).toBe("ok");
    const sent = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(sent.exclude_polygons).toBeUndefined();
  });

  it("reports no_route when Valhalla finds no path around the hazards", async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) =>
      JSON.parse(String(init.body)).exclude_polygons
        ? new Response(JSON.stringify({ error_code: 442, error: "No path could be found" }), { status: 400 })
        : trip(direct, 1.9),
    );
    const r = await findRealSafeRoute("http://valhalla", { from, shelters: [shelter], hazards: [bridge] }, fetchImpl as unknown as typeof fetch);
    expect(r.status).toBe("no_route");
  });

  it("skips full or closed shelters", async () => {
    const r = await findRealSafeRoute("http://valhalla", { from, shelters: [{ ...shelter, remaining_capacity: 0, current_occupancy: 100 }], hazards: [] }, vi.fn() as unknown as typeof fetch);
    expect(r.status).toBe("no_shelter");
  });
});
