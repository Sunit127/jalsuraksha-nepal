/**
 * Simplified demo road network around Narayanghat / Bharatpur (Chitwan).
 *
 * SIMULATED: node positions approximate real streets but this is NOT survey
 * data. It lets the prototype demonstrate hazard-aware evacuation routing
 * deterministically and offline. Replace with OSM-derived data (OSRM/Valhalla)
 * for real deployment.
 */
import type { LatLng } from "@/types/domain";

export type RoadNode = LatLng & { id: string; name: string };
export type RoadEdge = { from: string; to: string; name: string; bridge?: boolean };

export const ROAD_NODES: RoadNode[] = [
  { id: "start", name: "Riverside Tole", lat: 27.6935, lng: 84.415 },
  // Route A — shortest, crosses the Riverside Link Bridge
  { id: "a1", name: "Riverside Lane", lat: 27.6912, lng: 84.418 },
  { id: "bridge_w", name: "Riverside Link Bridge (west)", lat: 27.6893, lng: 84.4212 },
  { id: "bridge_e", name: "Riverside Link Bridge (east)", lat: 27.6887, lng: 84.4232 },
  { id: "a2", name: "Hospital Road", lat: 27.6876, lng: 84.4265 },
  { id: "a3", name: "Balkumari Chowk", lat: 27.6866, lng: 84.4298 },
  // Route B — northern detour via Pulchowk and Narayangarh Chowk
  { id: "b1", name: "Riverside North Lane", lat: 27.6962, lng: 84.4188 },
  { id: "b2", name: "Pulchowk", lat: 27.6978, lng: 84.424 },
  { id: "b3", name: "Narayangarh Chowk", lat: 27.6945, lng: 84.429 },
  { id: "b4", name: "Lions Chowk", lat: 27.69, lng: 84.4312 },
  // Route C — southern riverside road (low-lying)
  { id: "c1", name: "South Riverside Road", lat: 27.689, lng: 84.4152 },
  { id: "c2", name: "Riverside lane (south)", lat: 27.6858, lng: 84.4185 },
  { id: "c3", name: "Airport Road", lat: 27.6842, lng: 84.424 },
  { id: "c4", name: "Bharatpur Hospital Chowk", lat: 27.6838, lng: 84.4295 },
  // Onward links to other shelters
  { id: "d1", name: "Chaubiskothi Road", lat: 27.684, lng: 84.4365 },
  { id: "f1", name: "Hakimchowk Road", lat: 27.679, lng: 84.4435 },
  { id: "e1", name: "Mugling Road", lat: 27.6985, lng: 84.4335 },
  // Shelter access points (ids match shelter ids via SHELTER_NODE)
  { id: "sh_balkumari", name: "Balkumari Evacuation Centre", lat: 27.6858, lng: 84.4322 },
  { id: "sh_coveredhall", name: "Bharatpur Covered Hall", lat: 27.6828, lng: 84.4402 },
  { id: "sh_ward10", name: "Ward 10 Community Hall", lat: 27.6755, lng: 84.446 },
  { id: "sh_ward3", name: "Bharatpur-3 Ward Office Shelter", lat: 27.7002, lng: 84.44 },
];

export const ROAD_EDGES: RoadEdge[] = [
  { from: "start", to: "a1", name: "Riverside Lane" },
  { from: "a1", to: "bridge_w", name: "Riverside Lane" },
  { from: "bridge_w", to: "bridge_e", name: "Riverside Link Bridge", bridge: true },
  { from: "bridge_e", to: "a2", name: "Hospital Road" },
  { from: "a2", to: "a3", name: "Hospital Road" },
  { from: "a3", to: "sh_balkumari", name: "Balkumari Road" },

  { from: "start", to: "b1", name: "Riverside North Lane" },
  { from: "b1", to: "b2", name: "Pulchowk Road" },
  { from: "b2", to: "b3", name: "Narayanghat–Mugling Road" },
  { from: "b3", to: "b4", name: "Lions Chowk Road" },
  { from: "b4", to: "sh_balkumari", name: "Balkumari Road" },

  { from: "start", to: "c1", name: "South Riverside Road" },
  { from: "c1", to: "c2", name: "South Riverside Road" },
  { from: "c2", to: "c3", name: "Airport Road" },
  { from: "c3", to: "c4", name: "Airport Road" },
  { from: "c4", to: "sh_balkumari", name: "Hospital Chowk Road" },
  { from: "a2", to: "c4", name: "Hospital Link Road" },

  { from: "sh_balkumari", to: "d1", name: "Chaubiskothi Road" },
  { from: "d1", to: "sh_coveredhall", name: "Chaubiskothi Road" },
  { from: "sh_coveredhall", to: "f1", name: "Hakimchowk Road" },
  { from: "f1", to: "sh_ward10", name: "Hakimchowk Road" },
  { from: "b3", to: "e1", name: "Narayanghat–Mugling Road" },
  { from: "e1", to: "sh_ward3", name: "Narayanghat–Mugling Road" },
];
