/**
 * Real road routing with a Valhalla server on OpenStreetMap roads: self-hosted
 * (docker-compose.routing.yml) or a public instance such as FOSSGIS. Hazard-aware: every blocking hazard (flooded road, blocked bridge,
 * landslide, severe waterlogging…) becomes an `exclude_polygons` area so the
 * walking route goes around it; non-blocking hazards near the route are
 * reported as cautions. Returns the same RouteResult as the offline demo
 * network (lib/routing/safe-route.ts), which remains the fallback.
 */
import { distanceToSegmentMeters, haversineMeters } from "@/lib/utilities/geo";
import type { LatLng } from "@/types/domain";
import {
  HAZARD_EDGE_RADIUS_M,
  isBlockingHazard,
  type RouteHazard,
  type RouteResult,
  type RouteShelter,
} from "./safe-route";

/** Shelters tried per request (nearest by straight line). */
const CANDIDATES = 4;
const WALK_M_PER_MIN = 75;
/** Public Valhalla servers (e.g. FOSSGIS) ask clients to identify themselves. */
const ROUTING_USER_AGENT = "JalSurakshaNepal/0.1 (flood emergency response; +https://github.com/Sunit127/jalsuraksha-nepal)";

/** Decodes a Valhalla polyline (precision 6). */
export function decodePolyline6(encoded: string): LatLng[] {
  const out: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    out.push({ lat: lat / 1e6, lng: lng / 1e6 });
  }
  return out;
}

/** A closed ring of [lon, lat] around a point (Valhalla exclude_polygons format). */
export function exclusionRing(center: LatLng, radiusM = HAZARD_EDGE_RADIUS_M, sides = 10): [number, number][] {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    const a = (2 * Math.PI * i) / sides;
    ring.push([center.lng + dLng * Math.cos(a), center.lat + dLat * Math.sin(a)]);
  }
  ring.push(ring[0]);
  return ring;
}

/** Shortest distance (m) from a point to a polyline. */
export function distanceToPathM(p: LatLng, path: LatLng[]): number {
  if (path.length === 1) return haversineMeters(p, path[0]);
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) best = Math.min(best, distanceToSegmentMeters(p, path[i], path[i + 1]));
  return best;
}

type ValhallaTrip = {
  trip: {
    summary: { length: number; time: number };
    legs: { shape: string; maneuvers: { street_names?: string[]; instruction: string }[] }[];
  };
};

export type ValhallaLeg = { path: LatLng[]; lengthM: number; timeS: number; streets: string[] };

/** One pedestrian route; null when Valhalla finds no path (e.g. all blocked). */
export async function valhallaRoute(
  baseUrl: string,
  from: LatLng,
  to: LatLng,
  exclude: [number, number][][],
  fetchImpl: typeof fetch = fetch,
  costing: "pedestrian" | "auto" = "pedestrian",
): Promise<ValhallaLeg | null> {
  const res = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": ROUTING_USER_AGENT },
    body: JSON.stringify({
      locations: [
        { lat: from.lat, lon: from.lng },
        { lat: to.lat, lon: to.lng },
      ],
      costing,
      units: "kilometers",
      ...(exclude.length ? { exclude_polygons: exclude } : {}),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 400) {
    // 442 "No path could be found" / 171 "No suitable edges near location".
    const body = (await res.json().catch(() => null)) as { error_code?: number } | null;
    if (body && [442, 443, 171, 170].includes(body.error_code ?? -1)) return null;
    throw new Error(`Valhalla error ${body?.error_code ?? res.status}`);
  }
  if (!res.ok) throw new Error(`Valhalla responded ${res.status}`);
  const data = (await res.json()) as ValhallaTrip;
  const leg = data.trip.legs[0];
  const streets = leg.maneuvers.flatMap((m) => m.street_names ?? []);
  return {
    path: decodePolyline6(leg.shape),
    lengthM: data.trip.summary.length * 1000,
    timeS: data.trip.summary.time,
    streets: streets.filter((s, i) => streets.indexOf(s) === i),
  };
}

export type RealRouteOptions = {
  from: LatLng;
  shelters: RouteShelter[];
  hazards: RouteHazard[];
  avoidHazardIds?: string[];
  shelterId?: string | null;
};

/** Hazard-aware evacuation route over real roads. */
export async function findRealSafeRoute(baseUrl: string, opts: RealRouteOptions, fetchImpl: typeof fetch = fetch): Promise<RouteResult> {
  const avoid = new Set(opts.avoidHazardIds ?? []);
  const hazards = opts.hazards.filter((h) => !h.duplicate_of || avoid.has(h.id));
  // A hazard at the person's own position cannot be routed around: caution only.
  const atOrigin = (h: RouteHazard) => haversineMeters(opts.from, { lat: h.latitude, lng: h.longitude }) <= HAZARD_EDGE_RADIUS_M;
  const blocking = hazards.filter((h) => isBlockingHazard(h, avoid) && !atOrigin(h));
  const exclude = blocking.map((h) => exclusionRing({ lat: h.latitude, lng: h.longitude }));

  const candidates = opts.shelters
    .filter((s) => s.is_active && (s.remaining_capacity ?? s.capacity - s.current_occupancy) > 0)
    .filter((s) => !opts.shelterId || s.id === opts.shelterId)
    .map((s) => ({ s, d: haversineMeters(opts.from, { lat: s.latitude, lng: s.longitude }) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, CANDIDATES)
    .map((c) => c.s);
  if (candidates.length === 0) {
    return {
      status: "no_shelter",
      message: opts.shelterId ? "That shelter is full or closed. Choose another shelter." : "No open shelter with free space nearby right now.",
    };
  }

  const safe = await Promise.all(
    candidates.map(async (s) => ({ s, leg: await valhallaRoute(baseUrl, opts.from, { lat: s.latitude, lng: s.longitude }, exclude, fetchImpl) })),
  );
  const routable = safe.filter((r): r is { s: RouteShelter; leg: ValhallaLeg } => r.leg !== null).sort((a, b) => a.leg.timeS - b.leg.timeS);
  const nearestBlocked = (path: LatLng[]) => blocking.filter((h) => distanceToPathM({ lat: h.latitude, lng: h.longitude }, path) <= HAZARD_EDGE_RADIUS_M);

  if (routable.length === 0) {
    const normal = await valhallaRoute(baseUrl, opts.from, { lat: candidates[0].latitude, lng: candidates[0].longitude }, [], fetchImpl).catch(() => null);
    return {
      status: "no_route",
      message: "All known routes to a shelter are blocked by reported hazards. Move to the highest floor or roof and send an SOS.",
      blockedBy: normal ? nearestBlocked(normal.path) : blocking.slice(0, 3),
    };
  }

  const best = routable[0];
  const cautions = hazards.filter(
    (h) => !blocking.includes(h) && distanceToPathM({ lat: h.latitude, lng: h.longitude }, best.leg.path) <= HAZARD_EDGE_RADIUS_M,
  );

  // The normal route to the same shelter, shown when hazards changed it.
  let blockedBaseline: Extract<RouteResult, { status: "ok" }>["blockedBaseline"] = null;
  if (blocking.length) {
    const normal = await valhallaRoute(baseUrl, opts.from, { lat: best.s.latitude, lng: best.s.longitude }, [], fetchImpl).catch(() => null);
    const blockedBy = normal ? nearestBlocked(normal.path) : [];
    if (normal && blockedBy.length) blockedBaseline = { path: normal.path, blockedBy };
  }

  const distanceM = Math.round(best.leg.lengthM);
  return {
    status: "ok",
    shelter: best.s,
    path: best.leg.path,
    waypoints: best.leg.streets.slice(0, 8),
    distanceM,
    walkingMinutes: Math.max(1, Math.round(distanceM / WALK_M_PER_MIN)),
    cautions,
    blockedBaseline,
    key: `valhalla:${best.s.id}:${best.leg.path.length}:${distanceM}`,
  };
}
