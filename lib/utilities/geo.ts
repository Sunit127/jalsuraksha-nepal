import type { LatLng } from "@/types/domain";

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Local equirectangular projection (metres) — accurate enough at city scale. */
function project(p: LatLng, origin: LatLng): { x: number; y: number } {
  return {
    x: toRad(p.lng - origin.lng) * EARTH_RADIUS_M * Math.cos(toRad(origin.lat)),
    y: toRad(p.lat - origin.lat) * EARTH_RADIUS_M,
  };
}

/** Shortest distance (m) from point `p` to the segment `a`–`b`. */
export function distanceToSegmentMeters(p: LatLng, a: LatLng, b: LatLng): number {
  const P = project(p, a);
  const B = project(b, a);
  const len2 = B.x * B.x + B.y * B.y;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (P.x * B.x + P.y * B.y) / len2));
  const dx = P.x - t * B.x;
  const dy = P.y - t * B.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Ray-casting point-in-polygon test. Polygon is an array of [lat, lng]. */
export function pointInPolygon(p: LatLng, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    const intersect =
      yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

/** Parse a jsonb polygon column into typed [lat, lng] pairs, dropping bad points. */
export function parsePolygon(value: unknown): [number, number][] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (pt): pt is [number, number] =>
      Array.isArray(pt) &&
      pt.length === 2 &&
      typeof pt[0] === "number" &&
      typeof pt[1] === "number",
  );
}
