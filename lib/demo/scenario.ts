/**
 * Hackathon demo scenario constants. Everything here is SIMULATED and uses
 * approximate locations around Bharatpur / Narayanghat, Chitwan.
 */
import type { Hospital, LatLng } from "@/types/domain";

export const DEMO_SOURCE_LABEL = "JalSuraksha Hackathon Demo";

export const DEMO_REGION = {
  name: "Narayani Basin",
  district: "Chitwan",
  municipality: "Bharatpur Metropolitan City",
  center: { lat: 27.6925, lng: 84.4235 } satisfies LatLng,
  zoom: 14,
};

/** Simulated citizen location: low-lying riverside settlement. */
export const DEMO_CITIZEN_LOCATION = {
  lat: 27.6935,
  lng: 84.415,
  label: "Riverside Tole, Bharatpur-1 (demo location)",
} as const;

/** The bridge that becomes flooded during the routing demo (step 4). */
export const DEMO_BRIDGE = {
  lat: 27.689,
  lng: 84.4222,
  name: "Riverside Link Bridge",
  locationName: "Riverside Link Bridge, Bharatpur-1",
} as const;

/** Demo SOS inputs for step 5 of the presentation script. */
export const DEMO_SOS_INPUT = {
  phone: "9800000001",
  peopleCount: 5,
  childrenCount: 2,
  elderlyCount: 1,
  injured: true,
  situation: "water_rising" as const,
  description: "Ground floor flooded, water rising fast. One elderly person with a leg injury.",
};

export const DEMO_RESCUE_CALL_SIGN = "R-03";

/** Static hospital reference points (illustrative, not verified facility data). */
export const HOSPITALS: Hospital[] = [
  { id: "hosp-bharatpur", name: "Bharatpur Hospital", latitude: 27.6822, longitude: 84.4337, phone: "056-520111" },
  { id: "hosp-cmc", name: "Chitwan Medical College Teaching Hospital", latitude: 27.6862, longitude: 84.4418 },
  { id: "hosp-bpkmch", name: "BP Koirala Memorial Cancer Hospital", latitude: 27.6719, longitude: 84.4384 },
];

/**
 * Nationwide emergency numbers in Nepal. Cached for offline use.
 * Verify locally before any real deployment.
 */
export const EMERGENCY_CONTACTS = [
  { name: "Nepal Police", number: "100" },
  { name: "Fire Brigade", number: "101" },
  { name: "Ambulance", number: "102" },
];

export const SAFETY_INSTRUCTIONS = [
  "Move to higher ground immediately if water is rising — do not wait for it to reach your door.",
  "Never walk or drive through moving water. 15 cm of fast water can knock you down.",
  "Switch off electricity and gas at the mains if it is safe to do so.",
  "Take medicines, documents, a phone, a torch and drinking water.",
  "Keep children and elderly people with you; tell neighbours you are leaving.",
  "Follow instructions from local authorities, Nepal Police and Armed Police Force.",
];
