/**
 * The simulated demo dataset. Used by:
 *   - scripts/generate-seed.ts  → supabase/seed.sql (timestamps relative to now())
 *   - /api/demo/reset           → re-inserts the same rows at presentation time
 *
 * All rows are clearly labelled simulated (source_type = 'simulated' / is_demo).
 * Locations are approximate and illustrative.
 */
import { calculateSosPriority, type SosSituationKey } from "@/lib/risk-engine/sos-priority";
import { scoreZones, zoneForPoint } from "@/lib/risk-engine/zones";
import type { Database } from "@/types/database.types";
import { DEMO_SOURCE_LABEL } from "./scenario";

type Insert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

/** A timestamp producer: minutes before "now" → serialised timestamp. */
export type TimeFn = (minutesAgo: number) => string;

const id = (prefix: string, n: number) =>
  `${prefix}000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

export const DEMO_IDS = {
  alert: (n: number) => id("a1", n),
  zone: (n: number) => id("b2", n),
  shelter: (n: number) => id("c3", n),
  hazard: (n: number) => id("d4", n),
  team: (n: number) => id("e5", n),
  sos: (n: number) => id("f6", n),
  assignment: (n: number) => id("0a", n),
  history: (n: number) => id("1b", n),
};

/** Shelter used as the evacuation destination in the demo script. */
export const DEMO_PRIMARY_SHELTER_ID = DEMO_IDS.shelter(1);
export const DEMO_TEAM_R03_ID = DEMO_IDS.team(3);

export type DemoDataset = {
  alerts: Insert<"alerts">[];
  risk_zones: Insert<"risk_zones">[];
  shelters: Insert<"shelters">[];
  rescue_teams: Insert<"rescue_teams">[];
  hazard_reports: Insert<"hazard_reports">[];
  sos_requests: Insert<"sos_requests">[];
  rescue_assignments: Insert<"rescue_assignments">[];
  incident_status_history: Insert<"incident_status_history">[];
};

export function buildDemoDataset(t: TimeFn): DemoDataset {
  // -------------------------------------------------------------------------
  // Alerts
  // -------------------------------------------------------------------------
  const alerts: Insert<"alerts">[] = [
    {
      id: DEMO_IDS.alert(1),
      title: "Narayani River above danger level at Narayanghat",
      description:
        "Rapid river-level rise detected in demo scenario. Residents in low-lying areas of Bharatpur-1, Bharatpur-2 and Gaindakot riverside should prepare to evacuate to higher ground now.",
      severity: "danger",
      district: "Chitwan",
      municipality: "Bharatpur Metropolitan City",
      river_basin: "Narayani",
      source: DEMO_SOURCE_LABEL,
      source_type: "simulated",
      created_at: t(14),
      expires_at: t(-720),
    },
    {
      id: DEMO_IDS.alert(2),
      title: "Heavy rainfall watch — Chitwan and Nawalpur",
      description:
        "Simulated forecast of 100–150 mm rainfall in 24 hours across the Narayani basin. Avoid river banks and low-lying roads.",
      severity: "high",
      district: "Chitwan",
      river_basin: "Narayani",
      source: DEMO_SOURCE_LABEL,
      source_type: "simulated",
      created_at: t(75),
      expires_at: t(-1440),
    },
    {
      id: DEMO_IDS.alert(3),
      title: "East Rapti rising near Sauraha",
      description:
        "River level approaching warning level (demo data). Riverside hotels and homes in Sauraha should monitor updates.",
      severity: "watch",
      district: "Chitwan",
      municipality: "Ratnanagar Municipality",
      river_basin: "East Rapti",
      source: DEMO_SOURCE_LABEL,
      source_type: "simulated",
      created_at: t(130),
      expires_at: t(-600),
    },
    {
      id: DEMO_IDS.alert(4),
      title: "Evacuation shelters open in Bharatpur",
      description:
        "Seven demo shelters are open with food, drinking water and first aid. Check remaining capacity in the app before travelling.",
      severity: "info",
      district: "Chitwan",
      municipality: "Bharatpur Metropolitan City",
      source: DEMO_SOURCE_LABEL,
      source_type: "simulated",
      created_at: t(190),
      expires_at: t(-2880),
    },
  ];

  // -------------------------------------------------------------------------
  // Risk zones (inputs only — scores are computed by the rule-based engine)
  // -------------------------------------------------------------------------
  const NARAYANI_GAUGE = { river_level_m: 7.9, warning_level_m: 6.5, danger_level_m: 7.5 };
  const risk_zones: Insert<"risk_zones">[] = [
    {
      id: DEMO_IDS.zone(1),
      name: "Narayani Riverside (Bharatpur-1, 2)",
      district: "Chitwan",
      municipality: "Bharatpur Metropolitan City",
      river_basin: "Narayani",
      river_name: "Narayani",
      polygon: [
        [27.7065, 84.415], [27.701, 84.4215], [27.693, 84.42], [27.686, 84.415],
        [27.68, 84.408], [27.685, 84.403], [27.695, 84.409], [27.704, 84.412],
      ],
      center_latitude: 27.694,
      center_longitude: 84.4135,
      radius_m: 1200,
      ...NARAYANI_GAUGE,
      rainfall_mm_24h: 140,
      distance_to_river_m: 150,
      elevation_vulnerability: 0.9,
      road_access_reduction: 0.6,
      source_type: "simulated",
      observed_at: t(10),
    },
    {
      id: DEMO_IDS.zone(2),
      name: "Narayanghat Bazaar / Pulchowk",
      district: "Chitwan",
      municipality: "Bharatpur Metropolitan City",
      river_basin: "Narayani",
      river_name: "Narayani",
      polygon: [
        [27.7065, 84.415], [27.7062, 84.428], [27.698, 84.432], [27.693, 84.42], [27.701, 84.4215],
      ],
      center_latitude: 27.7005,
      center_longitude: 84.4235,
      radius_m: 900,
      ...NARAYANI_GAUGE,
      rainfall_mm_24h: 120,
      distance_to_river_m: 700,
      elevation_vulnerability: 0.5,
      road_access_reduction: 0.3,
      source_type: "simulated",
      observed_at: t(10),
    },
    {
      id: DEMO_IDS.zone(3),
      name: "Gaindakot Riverside (Nawalpur)",
      district: "Nawalpur",
      municipality: "Gaindakot Municipality",
      river_basin: "Narayani",
      river_name: "Narayani",
      polygon: [
        [27.715, 84.405], [27.712, 84.4145], [27.7045, 84.4135], [27.699, 84.405],
        [27.697, 84.396], [27.706, 84.3945],
      ],
      center_latitude: 27.706,
      center_longitude: 84.404,
      radius_m: 1100,
      ...NARAYANI_GAUGE,
      rainfall_mm_24h: 110,
      distance_to_river_m: 400,
      elevation_vulnerability: 0.6,
      road_access_reduction: 0.2,
      source_type: "simulated",
      observed_at: t(10),
    },
    {
      id: DEMO_IDS.zone(4),
      name: "Bharatpur Central",
      district: "Chitwan",
      municipality: "Bharatpur Metropolitan City",
      river_basin: "Narayani",
      river_name: "Narayani",
      polygon: [
        [27.693, 84.42], [27.698, 84.432], [27.692, 84.4475], [27.678, 84.4475],
        [27.6745, 84.432], [27.68, 84.419], [27.686, 84.415],
      ],
      center_latitude: 27.686,
      center_longitude: 84.433,
      radius_m: 1600,
      ...NARAYANI_GAUGE,
      rainfall_mm_24h: 100,
      distance_to_river_m: 2500,
      elevation_vulnerability: 0.2,
      road_access_reduction: 0,
      source_type: "simulated",
      observed_at: t(10),
    },
    {
      id: DEMO_IDS.zone(5),
      name: "Sauraha — East Rapti bank",
      district: "Chitwan",
      municipality: "Ratnanagar Municipality",
      river_basin: "East Rapti",
      river_name: "East Rapti",
      polygon: [
        [27.5835, 84.487], [27.5835, 84.503], [27.5745, 84.503], [27.5745, 84.487],
      ],
      center_latitude: 27.579,
      center_longitude: 84.495,
      radius_m: 800,
      river_level_m: 4.6,
      warning_level_m: 4.5,
      danger_level_m: 5.5,
      rainfall_mm_24h: 95,
      distance_to_river_m: 300,
      elevation_vulnerability: 0.7,
      road_access_reduction: 0.2,
      source_type: "simulated",
      observed_at: t(20),
    },
    {
      id: DEMO_IDS.zone(6),
      name: "Meghauli — Narayani–Rapti confluence",
      district: "Chitwan",
      municipality: "Bharatpur Metropolitan City",
      river_basin: "Narayani",
      river_name: "Narayani",
      polygon: [
        [27.5865, 84.2175], [27.5865, 84.234], [27.5725, 84.234], [27.5725, 84.2175],
      ],
      center_latitude: 27.5795,
      center_longitude: 84.2257,
      radius_m: 900,
      river_level_m: 6.8,
      warning_level_m: 6.0,
      danger_level_m: 7.0,
      rainfall_mm_24h: 90,
      distance_to_river_m: 500,
      elevation_vulnerability: 0.8,
      road_access_reduction: 0.3,
      source_type: "simulated",
      observed_at: t(20),
    },
    {
      id: DEMO_IDS.zone(7),
      name: "Devghat Confluence",
      district: "Tanahun",
      municipality: "Devghat Rural Municipality",
      river_basin: "Narayani",
      // Kali Gandaki and Trishuli meet here to form the Narayani (DHM gauge "Narayani at Devghat").
      river_name: "Narayani (Kali Gandaki–Trishuli confluence)",
      polygon: [
        [27.747, 84.424], [27.747, 84.436], [27.737, 84.436], [27.737, 84.424],
      ],
      center_latitude: 27.742,
      center_longitude: 84.43,
      radius_m: 700,
      river_level_m: 5.2,
      warning_level_m: 6.0,
      danger_level_m: 7.2,
      rainfall_mm_24h: 80,
      distance_to_river_m: 300,
      elevation_vulnerability: 0.5,
      road_access_reduction: 0,
      source_type: "simulated",
      observed_at: t(25),
    },
    {
      id: DEMO_IDS.zone(8),
      name: "Ratnanagar (Tandi)",
      district: "Chitwan",
      municipality: "Ratnanagar Municipality",
      river_basin: "East Rapti",
      river_name: "East Rapti",
      polygon: [
        [27.626, 84.508], [27.626, 84.522], [27.614, 84.522], [27.614, 84.508],
      ],
      center_latitude: 27.62,
      center_longitude: 84.515,
      radius_m: 900,
      river_level_m: 4.6,
      warning_level_m: 4.5,
      danger_level_m: 5.5,
      rainfall_mm_24h: 60,
      distance_to_river_m: 4000,
      elevation_vulnerability: 0.2,
      road_access_reduction: 0,
      source_type: "simulated",
      observed_at: t(25),
    },
  ];

  // -------------------------------------------------------------------------
  // Shelters (illustrative names, demo capacities)
  // -------------------------------------------------------------------------
  const shelters: Insert<"shelters">[] = [
    {
      id: DEMO_IDS.shelter(1),
      name: "Balkumari Evacuation Centre",
      address: "Balkumari, Bharatpur-3 (higher ground)",
      latitude: 27.6858,
      longitude: 84.4322,
      district: "Chitwan",
      municipality: "Bharatpur Metropolitan City",
      ward: 3,
      capacity: 350,
      current_occupancy: 212,
      food_status: "available",
      water_status: "available",
      medical_assistance: true,
      contact_phone: "9800000101",
      is_demo: true,
    },
    {
      id: DEMO_IDS.shelter(2),
      name: "Bharatpur Covered Hall",
      address: "Bharatpur-10, near Chaubiskothi",
      latitude: 27.6828,
      longitude: 84.4402,
      district: "Chitwan",
      municipality: "Bharatpur Metropolitan City",
      ward: 10,
      capacity: 500,
      current_occupancy: 318,
      food_status: "available",
      water_status: "limited",
      medical_assistance: true,
      contact_phone: "9800000102",
      is_demo: true,
    },
    {
      id: DEMO_IDS.shelter(3),
      name: "Ward 10 Community Hall",
      address: "Bharatpur-10, Hakimchowk",
      latitude: 27.6755,
      longitude: 84.446,
      district: "Chitwan",
      municipality: "Bharatpur Metropolitan City",
      ward: 10,
      capacity: 180,
      current_occupancy: 64,
      food_status: "limited",
      water_status: "available",
      medical_assistance: false,
      contact_phone: "9800000103",
      is_demo: true,
    },
    {
      id: DEMO_IDS.shelter(4),
      name: "Gaindakot Community Shelter",
      address: "Gaindakot-2, Nawalpur (upper terrace)",
      latitude: 27.709,
      longitude: 84.389,
      district: "Nawalpur",
      municipality: "Gaindakot Municipality",
      ward: 2,
      capacity: 220,
      current_occupancy: 187,
      food_status: "limited",
      water_status: "limited",
      medical_assistance: false,
      contact_phone: "9800000104",
      is_demo: true,
    },
    {
      id: DEMO_IDS.shelter(5),
      name: "Bharatpur-3 Ward Office Shelter",
      address: "Bharatpur-3, Narayanghat–Mugling road",
      latitude: 27.7002,
      longitude: 84.44,
      district: "Chitwan",
      municipality: "Bharatpur Metropolitan City",
      ward: 3,
      capacity: 150,
      current_occupancy: 41,
      food_status: "available",
      water_status: "available",
      medical_assistance: false,
      contact_phone: "9800000105",
      is_demo: true,
    },
    {
      id: DEMO_IDS.shelter(6),
      name: "Sharadanagar School Shelter",
      address: "Sharadanagar, Bharatpur-18",
      latitude: 27.652,
      longitude: 84.421,
      district: "Chitwan",
      municipality: "Bharatpur Metropolitan City",
      ward: 18,
      capacity: 200,
      current_occupancy: 200,
      food_status: "limited",
      water_status: "unavailable",
      medical_assistance: false,
      contact_phone: "9800000106",
      is_demo: true,
    },
    {
      id: DEMO_IDS.shelter(7),
      name: "Sauraha Community Relief Camp",
      address: "Bachhauli, Ratnanagar-6",
      latitude: 27.5855,
      longitude: 84.5065,
      district: "Chitwan",
      municipality: "Ratnanagar Municipality",
      ward: 6,
      capacity: 260,
      current_occupancy: 97,
      food_status: "available",
      water_status: "available",
      medical_assistance: true,
      contact_phone: "9800000107",
      is_demo: true,
    },
    {
      id: DEMO_IDS.shelter(8),
      name: "Meghauli Secondary School Shelter",
      address: "Meghauli, Bharatpur-23",
      latitude: 27.5905,
      longitude: 84.232,
      district: "Chitwan",
      municipality: "Bharatpur Metropolitan City",
      ward: 23,
      capacity: 240,
      current_occupancy: 156,
      food_status: "available",
      water_status: "limited",
      medical_assistance: true,
      contact_phone: "9800000108",
      is_demo: true,
    },
  ];

  // -------------------------------------------------------------------------
  // Rescue teams
  // -------------------------------------------------------------------------
  const rescue_teams: Insert<"rescue_teams">[] = [
    {
      id: DEMO_IDS.team(1),
      call_sign: "R-01",
      name: "Bharatpur Metro Rescue Unit 1",
      status: "busy",
      personnel_count: 5,
      equipment: ["Boat", "Life jackets", "Rope kit"],
      base_location: "Pulchowk, Narayanghat",
      latitude: 27.7005,
      longitude: 84.407,
      contact_phone: "9800000201",
      is_demo: true,
    },
    {
      id: DEMO_IDS.team(2),
      call_sign: "R-02",
      name: "Chitwan Swift-Water Team",
      status: "assigned",
      personnel_count: 6,
      equipment: ["Inflatable boat", "First Aid", "Throw bags"],
      base_location: "Bharatpur-11",
      latitude: 27.67,
      longitude: 84.435,
      contact_phone: "9800000202",
      is_demo: true,
    },
    {
      id: DEMO_IDS.team(3),
      call_sign: "R-03",
      name: "Bharatpur Fire & Rescue — Team 3",
      status: "available",
      personnel_count: 4,
      equipment: ["Boat", "First Aid"],
      base_location: "Bharatpur Fire Station",
      latitude: 27.68,
      longitude: 84.433,
      contact_phone: "9800000203",
      is_demo: true,
    },
    {
      id: DEMO_IDS.team(4),
      call_sign: "R-04",
      name: "Gaindakot Community Rescue",
      status: "available",
      personnel_count: 4,
      equipment: ["Rope kit", "First Aid", "Stretcher"],
      base_location: "Gaindakot-2",
      latitude: 27.708,
      longitude: 84.391,
      contact_phone: "9800000204",
      is_demo: true,
    },
    {
      id: DEMO_IDS.team(5),
      call_sign: "R-05",
      name: "Medical Response Team",
      status: "busy",
      personnel_count: 3,
      equipment: ["Ambulance", "Paramedic kit", "Stretcher"],
      base_location: "Meghauli field post",
      latitude: 27.5835,
      longitude: 84.2285,
      contact_phone: "9800000205",
      is_demo: true,
    },
    {
      id: DEMO_IDS.team(6),
      call_sign: "R-06",
      name: "Sauraha Volunteer Boat Crew",
      status: "offline",
      personnel_count: 5,
      equipment: ["Boat", "Life jackets"],
      base_location: "Sauraha",
      latitude: 27.579,
      longitude: 84.499,
      contact_phone: "9800000206",
      is_demo: true,
    },
    {
      id: DEMO_IDS.team(7),
      call_sign: "R-07",
      name: "Ratnanagar Rescue Unit",
      status: "available",
      personnel_count: 4,
      equipment: ["Boat", "First Aid"],
      base_location: "Tandi, Ratnanagar",
      latitude: 27.618,
      longitude: 84.514,
      contact_phone: "9800000207",
      is_demo: true,
    },
  ];

  // -------------------------------------------------------------------------
  // Community hazard reports (simulated)
  // -------------------------------------------------------------------------
  const hazard_reports: Insert<"hazard_reports">[] = [
    {
      id: DEMO_IDS.hazard(1),
      type: "flooded_road",
      severity: "high",
      status: "verified",
      description: "Knee-deep water across the riverside lane. Motorbikes turning back.",
      location_name: "Riverside lane, Bharatpur-1",
      latitude: 27.686,
      longitude: 84.419,
      confirmation_count: 7,
      source_type: "simulated",
      created_at: t(8),
    },
    {
      id: DEMO_IDS.hazard(2),
      type: "waterlogging",
      severity: "medium",
      status: "open",
      description: "Waterlogging near the chowk, passable with care.",
      location_name: "Pulchowk, Narayanghat",
      latitude: 27.6985,
      longitude: 84.4262,
      confirmation_count: 4,
      source_type: "simulated",
      created_at: t(22),
    },
    {
      id: DEMO_IDS.hazard(3),
      type: "landslide",
      severity: "high",
      status: "verified",
      description: "Debris blocking one lane of the Narayanghat–Mugling road.",
      location_name: "Narayanghat–Mugling road, near Jalbire",
      latitude: 27.765,
      longitude: 84.435,
      confirmation_count: 12,
      source_type: "simulated",
      created_at: t(95),
    },
    {
      id: DEMO_IDS.hazard(4),
      type: "blocked_bridge",
      severity: "critical",
      status: "verified",
      description: "Culvert washed out. Do not attempt to cross.",
      location_name: "Nawalpur culvert, Gaindakot",
      latitude: 27.71,
      longitude: 84.398,
      confirmation_count: 5,
      source_type: "simulated",
      created_at: t(64),
    },
    {
      id: DEMO_IDS.hazard(5),
      type: "stranded_people",
      severity: "high",
      status: "open",
      description: "Two families on rooftops, water around houses.",
      location_name: "Meghauli, Ward 4",
      latitude: 27.58,
      longitude: 84.2245,
      confirmation_count: 3,
      source_type: "simulated",
      created_at: t(48),
    },
    {
      id: DEMO_IDS.hazard(6),
      type: "damaged_infrastructure",
      severity: "medium",
      status: "open",
      description: "Electric pole leaning into flood water. Keep away.",
      location_name: "Bharatpur-2 riverside",
      latitude: 27.696,
      longitude: 84.413,
      confirmation_count: 2,
      source_type: "simulated",
      created_at: t(31),
    },
    {
      id: DEMO_IDS.hazard(7),
      type: "flooded_road",
      severity: "medium",
      status: "open",
      description: "Road to Bachhauli partly under water.",
      location_name: "Sauraha–Bachhauli road",
      latitude: 27.58,
      longitude: 84.49,
      confirmation_count: 3,
      source_type: "simulated",
      created_at: t(57),
    },
    {
      id: DEMO_IDS.hazard(8),
      type: "other",
      severity: "high",
      status: "open",
      description: "River bank erosion, cracks visible near houses.",
      location_name: "Riverside Tole, Bharatpur-1",
      latitude: 27.692,
      longitude: 84.4105,
      confirmation_count: 6,
      source_type: "simulated",
      created_at: t(18),
    },
    {
      id: DEMO_IDS.hazard(9),
      type: "flooded_road",
      severity: "high",
      status: "open",
      description: "Same flooding as the verified riverside lane report.",
      location_name: "Riverside lane, Bharatpur-1",
      latitude: 27.6862,
      longitude: 84.4193,
      confirmation_count: 1,
      duplicate_of: DEMO_IDS.hazard(1),
      source_type: "simulated",
      created_at: t(5),
    },
    {
      id: DEMO_IDS.hazard(10),
      type: "waterlogging",
      severity: "low",
      status: "resolved",
      description: "Drained after pumps were deployed.",
      location_name: "Chaubiskothi, Bharatpur-10",
      latitude: 27.68,
      longitude: 84.442,
      confirmation_count: 2,
      source_type: "simulated",
      created_at: t(300),
    },
  ];

  // -------------------------------------------------------------------------
  // SOS requests — priority computed by the same engine the API uses
  // -------------------------------------------------------------------------
  const scored = scoreZones(
    risk_zones.map((z) => ({
      ...z,
      id: z.id!,
      polygon: z.polygon,
      rainfall_mm_24h: z.rainfall_mm_24h ?? 0,
      distance_to_river_m: z.distance_to_river_m ?? 1000,
      elevation_vulnerability: z.elevation_vulnerability ?? 0.5,
      road_access_reduction: z.road_access_reduction ?? 0,
    })),
    hazard_reports.map((h) => ({
      latitude: h.latitude,
      longitude: h.longitude,
      status: h.status ?? "open",
      duplicate_of: h.duplicate_of ?? null,
    })),
  );

  type SosSeed = {
    n: number;
    ref: string;
    phone: string;
    lat: number;
    lng: number;
    place: string;
    people: number;
    children: number;
    elderly: number;
    injured: boolean;
    situation: SosSituationKey;
    description?: string;
    minutesAgo: number;
    /** Assignment journey: each step's minutes-ago; last step is the current status. */
    team?: number;
    journey?: { status: "assigned" | "accepted" | "en_route" | "arrived" | "in_progress" | "completed"; minutesAgo: number }[];
    ackMinutesAgo?: number;
    cancelledMinutesAgo?: number;
    override?: { level: "low" | "moderate" | "high" | "critical"; note: string };
  };

  const sosSeeds: SosSeed[] = [
    // --- Active incidents ---------------------------------------------------
    {
      n: 1, ref: "SOS-NEP-0412", phone: "9841000101", lat: 27.702, lng: 84.401,
      place: "Gaindakot riverside", people: 7, children: 2, elderly: 2, injured: true,
      situation: "trapped", description: "Family trapped on first floor, stairs flooded.",
      minutesAgo: 42, ackMinutesAgo: 40, team: 1,
      journey: [
        { status: "assigned", minutesAgo: 38 },
        { status: "accepted", minutesAgo: 36 },
        { status: "en_route", minutesAgo: 30 },
      ],
    },
    {
      n: 2, ref: "SOS-NEP-0415", phone: "9845000102", lat: 27.6962, lng: 84.4118,
      place: "Bharatpur-2 riverside", people: 4, children: 1, elderly: 1, injured: false,
      situation: "water_rising", minutesAgo: 25, ackMinutesAgo: 23, team: 2,
      journey: [{ status: "assigned", minutesAgo: 20 }],
    },
    {
      n: 3, ref: "SOS-NEP-0417", phone: "9855000103", lat: 27.701, lng: 84.425,
      place: "Narayanghat Bazaar", people: 3, children: 0, elderly: 1, injured: false,
      situation: "water_entering", description: "Water entering shop and home behind it.",
      minutesAgo: 18, ackMinutesAgo: 15,
      override: { level: "moderate", note: "Elderly resident uses a wheelchair (confirmed by phone)" },
    },
    {
      n: 4, ref: "SOS-NEP-0419", phone: "9860000104", lat: 27.6905, lng: 84.412,
      place: "Riverside Tole, Bharatpur-1", people: 2, children: 0, elderly: 1, injured: true,
      situation: "medical", description: "Elderly man with chest pain, cannot walk through water.",
      minutesAgo: 6,
    },
    {
      n: 5, ref: "SOS-NEP-0418", phone: "9865000105", lat: 27.5775, lng: 84.4955,
      place: "Sauraha", people: 6, children: 2, elderly: 0, injured: false,
      situation: "water_rising", minutesAgo: 11,
    },
    {
      n: 6, ref: "SOS-NEP-0409", phone: "9847000106", lat: 27.58, lng: 84.2262,
      place: "Meghauli, Ward 4", people: 3, children: 0, elderly: 1, injured: true,
      situation: "medical", description: "Pregnant woman needs hospital transfer.",
      minutesAgo: 55, ackMinutesAgo: 53, team: 5,
      journey: [
        { status: "assigned", minutesAgo: 50 },
        { status: "accepted", minutesAgo: 49 },
        { status: "en_route", minutesAgo: 45 },
        { status: "arrived", minutesAgo: 12 },
      ],
    },
    {
      n: 7, ref: "SOS-NEP-0414", phone: "9818000107", lat: 27.741, lng: 84.4295,
      place: "Devghat", people: 5, children: 0, elderly: 0, injured: false,
      situation: "safe_temporarily", description: "On high ground but cut off by water.",
      minutesAgo: 33,
    },
    // --- Resolved over the last 24 h ----------------------------------------
    ...(
      [
        [8, "SOS-NEP-0321", 27.6955, 84.4102, "Bharatpur-2", 5, 2, 1, false, "water_rising", 1260, 3],
        [9, "SOS-NEP-0327", 27.7035, 84.3985, "Gaindakot", 4, 1, 0, false, "water_entering", 1180, 4],
        [10, "SOS-NEP-0334", 27.5805, 84.2275, "Meghauli", 8, 3, 2, true, "trapped", 1050, 5],
        [11, "SOS-NEP-0342", 27.6915, 84.414, "Bharatpur-1", 3, 0, 1, true, "medical", 930, 3],
        [12, "SOS-NEP-0355", 27.5782, 84.4975, "Sauraha", 6, 2, 0, false, "water_rising", 780, 7],
        [13, "SOS-NEP-0363", 27.6995, 84.4185, "Narayanghat", 2, 0, 0, false, "water_entering", 640, 1],
        [14, "SOS-NEP-0371", 27.6205, 84.513, "Ratnanagar", 4, 1, 1, false, "other", 520, 7],
        [15, "SOS-NEP-0380", 27.7055, 84.403, "Gaindakot riverside", 9, 3, 2, false, "trapped", 400, 4],
        [16, "SOS-NEP-0388", 27.6948, 84.4125, "Bharatpur-2", 5, 1, 1, true, "water_rising", 290, 2],
        [17, "SOS-NEP-0396", 27.5795, 84.2248, "Meghauli", 6, 2, 1, false, "trapped", 180, 5],
        [18, "SOS-NEP-0403", 27.6925, 84.4108, "Bharatpur-1", 3, 1, 0, false, "water_rising", 110, 1],
      ] as const
    ).map(([n, ref, lat, lng, place, people, children, elderly, injured, situation, ago, team]) => ({
      n, ref, phone: `98510${String(n).padStart(5, "0")}`, lat, lng, place, people, children,
      elderly, injured, situation, minutesAgo: ago, ackMinutesAgo: ago - 2, team,
      journey: [
        { status: "assigned" as const, minutesAgo: ago - 5 },
        { status: "accepted" as const, minutesAgo: ago - 7 },
        { status: "en_route" as const, minutesAgo: ago - 10 },
        { status: "arrived" as const, minutesAgo: ago - 35 },
        { status: "in_progress" as const, minutesAgo: ago - 38 },
        { status: "completed" as const, minutesAgo: ago - 70 },
      ],
    })),
    // --- Closed by citizen ----------------------------------------------------
    {
      n: 19, ref: "SOS-NEP-0399", phone: "9861000119", lat: 27.6975, lng: 84.4205,
      place: "Narayanghat", people: 2, children: 0, elderly: 0, injured: false,
      situation: "water_entering", minutesAgo: 150, ackMinutesAgo: 147, cancelledMinutesAgo: 120,
    },
  ];

  const sos_requests: Insert<"sos_requests">[] = [];
  const rescue_assignments: Insert<"rescue_assignments">[] = [];
  const incident_status_history: Insert<"incident_status_history">[] = [];
  let historyN = 1;
  const log = (
    sosId: string,
    from: Insert<"incident_status_history">["from_status"],
    to: NonNullable<Insert<"incident_status_history">["to_status"]>,
    actor: string,
    note: string,
    minutesAgo: number,
  ) =>
    incident_status_history.push({
      id: DEMO_IDS.history(historyN++),
      sos_id: sosId,
      from_status: from,
      to_status: to,
      actor_role: actor,
      note,
      created_at: t(minutesAgo),
    });

  const teamById = new Map(rescue_teams.map((tm) => [tm.id!, tm]));
  const JOURNEY_TO_SOS = {
    assigned: "assigned",
    accepted: "accepted",
    en_route: "en_route",
    arrived: "arrived",
    in_progress: "in_progress",
    completed: "resolved",
  } as const;

  for (const s of sosSeeds) {
    const zone = zoneForPoint({ lat: s.lat, lng: s.lng }, scored);
    const priority = calculateSosPriority({
      situation: s.situation,
      injured: s.injured,
      peopleCount: s.people,
      childrenCount: s.children,
      elderlyCount: s.elderly,
      zoneRisk: zone?.risk.category ?? null,
    });
    const sosId = DEMO_IDS.sos(s.n);
    const teamId = s.team ? DEMO_IDS.team(s.team) : null;
    const last = s.journey?.at(-1);

    let status: Insert<"sos_requests">["status"] = "received";
    if (s.ackMinutesAgo !== undefined) status = "acknowledged";
    if (last) status = JOURNEY_TO_SOS[last.status];
    if (s.cancelledMinutesAgo !== undefined) status = "cancelled";

    const closedAgo =
      s.cancelledMinutesAgo ?? (last?.status === "completed" ? last.minutesAgo : undefined);

    sos_requests.push({
      id: sosId,
      reference_code: s.ref,
      phone: s.phone,
      latitude: s.lat,
      longitude: s.lng,
      location_name: s.place,
      location_accuracy_m: 15,
      people_count: s.people,
      children_count: s.children,
      elderly_count: s.elderly,
      injured: s.injured,
      situation: s.situation,
      description: s.description ?? null,
      priority_score: priority.score,
      priority_level: priority.level,
      priority_factors: priority.factors,
      operator_priority_override: s.override?.level ?? null,
      priority_override_note: s.override?.note ?? null,
      status,
      assigned_team_id: teamId,
      source: "app",
      is_demo: true,
      acknowledged_at: s.ackMinutesAgo !== undefined ? t(s.ackMinutesAgo) : null,
      resolved_at: closedAgo !== undefined ? t(closedAgo) : null,
      created_at: t(s.minutesAgo),
      updated_at: t(closedAgo ?? last?.minutesAgo ?? s.ackMinutesAgo ?? s.minutesAgo),
    });

    log(sosId, null, "received", "citizen", "Request received", s.minutesAgo);
    if (s.ackMinutesAgo !== undefined) {
      log(sosId, "received", "acknowledged", "operator", "Control centre notified", s.ackMinutesAgo);
    }
    if (s.override) {
      log(
        sosId, "acknowledged", "acknowledged", "operator",
        `Priority overridden to ${s.override.level.toUpperCase()}: ${s.override.note}`,
        (s.ackMinutesAgo ?? s.minutesAgo) - 1,
      );
    }

    if (teamId && s.journey) {
      const team = teamById.get(teamId)!;
      const at = (st: string) => s.journey!.find((j) => j.status === st)?.minutesAgo;
      rescue_assignments.push({
        id: DEMO_IDS.assignment(s.n),
        sos_id: sosId,
        rescue_team_id: teamId,
        status: last!.status,
        assigned_at: t(at("assigned")!),
        accepted_at: at("accepted") !== undefined ? t(at("accepted")!) : null,
        en_route_at: at("en_route") !== undefined ? t(at("en_route")!) : null,
        arrived_at: at("arrived") !== undefined ? t(at("arrived")!) : null,
        completed_at: at("completed") !== undefined ? t(at("completed")!) : null,
        created_at: t(at("assigned")!),
        updated_at: t(last!.minutesAgo),
      });

      let prev: Insert<"incident_status_history">["from_status"] = "acknowledged";
      for (const step of s.journey) {
        const to = JOURNEY_TO_SOS[step.status];
        const note = {
          assigned: `Rescue team ${team.call_sign} assigned`,
          accepted: `Team ${team.call_sign} accepted the mission`,
          en_route: `Team ${team.call_sign} dispatched`,
          arrived: `Team ${team.call_sign} arrived on scene`,
          in_progress: `Team ${team.call_sign} rescue in progress`,
          completed: `Rescue completed by team ${team.call_sign}`,
        }[step.status];
        log(sosId, prev, to, step.status === "assigned" ? "operator" : "rescue", note, step.minutesAgo);
        prev = to;
      }
    }

    if (s.cancelledMinutesAgo !== undefined) {
      log(sosId, "acknowledged", "cancelled", "citizen", "Citizen reported safe", s.cancelledMinutesAgo);
    }
  }

  return {
    alerts,
    risk_zones,
    shelters,
    rescue_teams,
    hazard_reports,
    sos_requests,
    rescue_assignments,
    incident_status_history,
  };
}
