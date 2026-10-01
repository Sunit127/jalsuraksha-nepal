/**
 * Hazard-aware evacuation routing (decision support only).
 *
 * Dijkstra over a road graph where:
 *  - edges near blocking hazards (flooded road, landslide, blocked bridge,
 *    or any hazard the user chose to avoid) are removed;
 *  - edges near other hazards get a caution penalty;
 *  - edges inside HIGH / DANGER risk zones cost more, so routes prefer
 *    leaving the danger area quickly.
 * The chosen destination is the reachable shelter with space and the lowest
 * route cost. We also compute the "normal" route (ignoring hazards) so the UI
 * can show which road was blocked and why the route changed.
 */
import type { RiskCategory } from "@/lib/risk-engine/flood-risk";
import { distanceToSegmentMeters, haversineMeters, parsePolygon, pointInPolygon } from "@/lib/utilities/geo";
import type { HazardReport, LatLng, RiskZone, Shelter } from "@/types/domain";
import { ROAD_EDGES, ROAD_NODES, type RoadEdge, type RoadNode } from "./demo-network";

export const ROUTE_DISCLAIMER =
  "Route guidance is decision support. Follow official emergency instructions.";

export type RouteHazard = Pick<
  HazardReport,
  "id" | "type" | "severity" | "status" | "latitude" | "longitude" | "location_name" | "duplicate_of"
>;
export type RouteZone = Pick<RiskZone, "polygon"> & { risk: { category: RiskCategory } };
export type RouteShelter = Pick<
  Shelter,
  "id" | "name" | "latitude" | "longitude" | "remaining_capacity" | "capacity" | "current_occupancy" | "is_active"
>;

export type RouteOptions = {
  from: LatLng;
  shelters: RouteShelter[];
  hazards: RouteHazard[];
  zones?: RouteZone[];
  /** Hazards the user explicitly asked to avoid (always blocking). */
  avoidHazardIds?: string[];
  /** Restrict to one destination shelter. */
  shelterId?: string | null;
  nodes?: RoadNode[];
  edges?: RoadEdge[];
};

export type RouteSegment = { name: string; from: LatLng; to: LatLng; lengthM: number };

export type SafeRoute = {
  status: "ok";
  shelter: RouteShelter;
  path: LatLng[];
  waypoints: string[];
  distanceM: number;
  walkingMinutes: number;
  cautions: RouteHazard[];
  /** The normal (hazard-free) route to the same shelter when it is blocked. */
  blockedBaseline: { path: LatLng[]; blockedBy: RouteHazard[] } | null;
  /** Stable key describing the path, to detect re-routing. */
  key: string;
};

export type RouteResult =
  | SafeRoute
  | { status: "out_of_area"; message: string }
  | { status: "no_shelter"; message: string }
  | { status: "no_route"; message: string; blockedBy: RouteHazard[] };

/** Hazard proximity that affects an edge. */
export const HAZARD_EDGE_RADIUS_M = 60;
/** Max distance from the network to snap the user / a shelter onto it. */
export const SNAP_MAX_M = 1500;
const SHELTER_SNAP_MAX_M = 150;
const WALK_M_PER_MIN = 75; // ~4.5 km/h, slower in water
const CAUTION_PENALTY_M = 300;
const ZONE_FACTOR: Partial<Record<RiskCategory, number>> = { danger: 0.5, high: 0.25 };

const ACTIVE = new Set(["open", "verified"]);

export function isBlockingHazard(h: RouteHazard, avoid: Set<string>): boolean {
  if (!ACTIVE.has(h.status)) return false;
  if (avoid.has(h.id)) return true;
  if (h.type === "flooded_road" || h.type === "landslide" || h.type === "blocked_bridge") return true;
  if ((h.type === "waterlogging" || h.type === "damaged_infrastructure") && (h.severity === "high" || h.severity === "critical")) {
    return true;
  }
  return false;
}

type Graph = Map<string, { to: string; edge: RoadEdge; cost: number; lengthM: number; blocked: RouteHazard[]; cautions: RouteHazard[] }[]>;

function buildGraph(
  nodes: Map<string, RoadNode>,
  edges: RoadEdge[],
  hazards: RouteHazard[],
  zones: RouteZone[],
  avoid: Set<string>,
  cautionOnly: Set<string>,
): Graph {
  const graph: Graph = new Map();
  const zonePolys = zones.map((z) => ({ poly: parsePolygon(z.polygon), cat: z.risk.category }));
  for (const edge of edges) {
    const a = nodes.get(edge.from);
    const b = nodes.get(edge.to);
    if (!a || !b) continue;
    const lengthM = haversineMeters(a, b);
    const near = hazards.filter(
      (h) => ACTIVE.has(h.status) && distanceToSegmentMeters({ lat: h.latitude, lng: h.longitude }, a, b) <= HAZARD_EDGE_RADIUS_M,
    );
    const blocks = (h: RouteHazard) => !cautionOnly.has(h.id) && isBlockingHazard(h, avoid);
    const blocked = near.filter(blocks);
    const cautions = near.filter((h) => !blocks(h));
    const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
    const zoneFactor = zonePolys.reduce((f, z) => (pointInPolygon(mid, z.poly) ? Math.max(f, ZONE_FACTOR[z.cat] ?? 0) : f), 0);
    const cost = lengthM * (1 + zoneFactor) + cautions.length * CAUTION_PENALTY_M;
    for (const [x, y] of [[edge.from, edge.to], [edge.to, edge.from]] as const) {
      if (!graph.has(x)) graph.set(x, []);
      graph.get(x)!.push({ to: y, edge, cost, lengthM, blocked, cautions });
    }
  }
  return graph;
}

function dijkstra(graph: Graph, source: string, useBlocked: boolean) {
  const dist = new Map<string, number>([[source, 0]]);
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  // Graph is tiny: a linear scan priority queue is fine and dependency-free.
  while (true) {
    let u: string | null = null;
    let best = Infinity;
    for (const [n, d] of dist) {
      if (!visited.has(n) && d < best) {
        best = d;
        u = n;
      }
    }
    if (u === null) break;
    visited.add(u);
    for (const e of graph.get(u) ?? []) {
      if (!useBlocked && e.blocked.length > 0) continue;
      const nd = best + e.cost;
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, u);
      }
    }
  }
  return { dist, prev };
}

function pathTo(prev: Map<string, string>, source: string, target: string): string[] | null {
  const out = [target];
  let cur = target;
  while (cur !== source) {
    const p = prev.get(cur);
    if (!p) return null;
    out.unshift(p);
    cur = p;
  }
  return out;
}

function nearestNode(p: LatLng, nodes: RoadNode[]): { node: RoadNode; distanceM: number } | null {
  let best: { node: RoadNode; distanceM: number } | null = null;
  for (const n of nodes) {
    const d = haversineMeters(p, n);
    if (!best || d < best.distanceM) best = { node: n, distanceM: d };
  }
  return best;
}

export function findSafeRoute(opts: RouteOptions): RouteResult {
  const nodeList = opts.nodes ?? ROAD_NODES;
  const edgeList = opts.edges ?? ROAD_EDGES;
  const nodes = new Map(nodeList.map((n) => [n.id, n]));
  const avoid = new Set(opts.avoidHazardIds ?? []);
  const hazards = opts.hazards.filter((h) => !h.duplicate_of || avoid.has(h.id));

  const origin = nearestNode(opts.from, nodeList);
  if (!origin || origin.distanceM > SNAP_MAX_M) {
    return {
      status: "out_of_area",
      message:
        "Road data for your area is not available in this prototype (demo network covers Bharatpur, Chitwan). Head to the nearest shelter on higher ground and follow local authorities.",
    };
  }

  // Shelters with space that sit on the network.
  const candidates = opts.shelters
    .filter((s) => s.is_active && (s.remaining_capacity ?? s.capacity - s.current_occupancy) > 0)
    .filter((s) => !opts.shelterId || s.id === opts.shelterId)
    .map((s) => ({ shelter: s, snap: nearestNode({ lat: s.latitude, lng: s.longitude }, nodeList) }))
    .filter((c): c is { shelter: RouteShelter; snap: { node: RoadNode; distanceM: number } } =>
      Boolean(c.snap && c.snap.distanceM <= SHELTER_SNAP_MAX_M),
    );

  if (candidates.length === 0) {
    return {
      status: "no_shelter",
      message: opts.shelterId
        ? "That shelter is full or not reachable on the demo road network. Choose another shelter."
        : "No shelter with free space is reachable on the demo road network right now.",
    };
  }

  // A hazard at the person's own position cannot be routed around — every
  // road out passes it. Blocking on it would wrongly report "no route" (e.g.
  // right after they report the flooded road outside their door), so it only
  // adds caution.
  const atOrigin = new Set(
    hazards.filter((h) => haversineMeters(opts.from, { lat: h.latitude, lng: h.longitude }) <= HAZARD_EDGE_RADIUS_M).map((h) => h.id),
  );
  const graph = buildGraph(nodes, edgeList, hazards, opts.zones ?? [], avoid, atOrigin);
  const safe = dijkstra(graph, origin.node.id, false);
  const normal = dijkstra(graph, origin.node.id, true);

  const ranked = candidates
    .map((c) => ({ ...c, cost: safe.dist.get(c.snap.node.id) ?? Infinity }))
    .sort((a, b) => a.cost - b.cost);
  const best = ranked[0];

  if (!Number.isFinite(best.cost)) {
    // Every route is blocked: report what blocks the normal route.
    const target = candidates.map((c) => ({ ...c, cost: normal.dist.get(c.snap.node.id) ?? Infinity })).sort((a, b) => a.cost - b.cost)[0];
    const ids = target && Number.isFinite(target.cost) ? pathTo(normal.prev, origin.node.id, target.snap.node.id) : null;
    return {
      status: "no_route",
      message: "All known routes to a shelter are blocked by reported hazards. Move to the highest floor or roof and send an SOS.",
      blockedBy: ids ? blockersOnPath(graph, ids) : [],
    };
  }

  const ids = pathTo(safe.prev, origin.node.id, best.snap.node.id)!;
  const path: LatLng[] = [opts.from, ...ids.map((id) => nodes.get(id)!), { lat: best.shelter.latitude, lng: best.shelter.longitude }];
  const segments = edgesOnPath(graph, ids);
  const distanceM = origin.distanceM + segments.reduce((a, e) => a + e.lengthM, 0) + best.snap.distanceM;
  const cautions = uniqueById(segments.flatMap((e) => e.cautions));

  // Normal route to the same shelter, if it differs because of a hazard.
  let blockedBaseline: SafeRoute["blockedBaseline"] = null;
  const normalIds = pathTo(normal.prev, origin.node.id, best.snap.node.id);
  if (normalIds && normalIds.join(">") !== ids.join(">")) {
    const blockedBy = blockersOnPath(graph, normalIds);
    if (blockedBy.length > 0) {
      blockedBaseline = { path: [opts.from, ...normalIds.map((id) => nodes.get(id)!)], blockedBy };
    }
  }

  const waypoints = dedupeConsecutive(segments.map((e) => e.edge.name));
  return {
    status: "ok",
    shelter: best.shelter,
    path,
    waypoints,
    distanceM,
    walkingMinutes: Math.max(1, Math.round(distanceM / WALK_M_PER_MIN)),
    cautions,
    blockedBaseline,
    key: `${best.shelter.id}:${ids.join(">")}`,
  };
}

function edgesOnPath(graph: Graph, ids: string[]) {
  const out = [];
  for (let i = 0; i < ids.length - 1; i++) {
    const e = graph.get(ids[i])?.find((x) => x.to === ids[i + 1]);
    if (e) out.push(e);
  }
  return out;
}

function blockersOnPath(graph: Graph, ids: string[]): RouteHazard[] {
  return uniqueById(edgesOnPath(graph, ids).flatMap((e) => e.blocked));
}

function uniqueById<T extends { id: string }>(list: T[]): T[] {
  return [...new Map(list.map((x) => [x.id, x])).values()];
}

function dedupeConsecutive(list: string[]): string[] {
  return list.filter((x, i) => i === 0 || list[i - 1] !== x);
}
