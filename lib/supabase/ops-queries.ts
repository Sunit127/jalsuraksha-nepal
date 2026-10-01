import "server-only";

import { unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import { applyLiveReadings, type DataMode, type HydrometStation, type LiveRiskZone } from "@/lib/hydromet/live";
import { maybeSyncHydromet } from "@/lib/hydromet/sync";
import type {
  Alert,
  HazardReport,
  Hospital,
  Profile,
  RescueAssignment,
  RescueTeam,
  Shelter,
  SosRequest,
} from "@/types/domain";
import type { Database } from "@/types/database.types";
import { createSupabaseServerClient } from "./server";

/** SOS columns for staff views (the guest tracking token is never sent). */
export const SOS_STAFF_COLUMNS =
  "id, reference_code, user_id, phone, latitude, longitude, location_accuracy_m, location_name, location_updated_at, people_count, children_count, elderly_count, injured, situation, description, photo_path, priority_score, priority_level, priority_factors, operator_priority_override, priority_override_note, effective_priority, status, assigned_team_id, source, is_demo, acknowledged_at, resolved_at, created_at, updated_at";

export type StaffSos = Omit<SosRequest, "tracking_token">;

/** Citizen family-safety reports (SAFE / EVACUATED / NEED HELP) for staff. */
export const CITIZEN_STATUS_COLUMNS =
  "id, full_name, phone, role, district, municipality, ward, emergency_contact, safety_status, safety_updated_at";
export type CitizenStatus = Pick<
  Profile,
  "id" | "full_name" | "phone" | "role" | "district" | "municipality" | "ward" | "emergency_contact" | "safety_status" | "safety_updated_at"
>;

export type OpsSnapshot = {
  sos: StaffSos[];
  teams: RescueTeam[];
  assignments: RescueAssignment[];
  shelters: Shelter[];
  hazards: HazardReport[];
  zones: LiveRiskZone[];
  alerts: Alert[];
  citizens: CitizenStatus[];
  hospitals: Hospital[];
  stations: HydrometStation[];
  dataMode: DataMode;
  hydrometSync: { at: string; ok: boolean; error?: string } | null;
  teamLocations: Database["public"]["Tables"]["team_locations"]["Row"][];
  fetchedAt: string;
  ok: boolean;
};

const EMPTY_OPS = (): OpsSnapshot => ({
  sos: [],
  teams: [],
  assignments: [],
  shelters: [],
  hazards: [],
  zones: [],
  alerts: [],
  citizens: [],
  hospitals: [],
  stations: [],
  dataMode: "live",
  hydrometSync: null,
  teamLocations: [],
  fetchedAt: new Date().toISOString(),
  ok: false,
});

/**
 * Everything the operations centre needs (RLS: staff only). Never throws: on
 * failure the dashboard renders with a "data may be incomplete" banner and
 * realtime/resync fill it in once the connection recovers.
 */
export async function getOpsSnapshot(): Promise<OpsSnapshot> {
  after(maybeSyncHydromet);
  try {
    return await loadOpsSnapshot();
  } catch (error) {
    unstable_rethrow(error);
    console.error("[ops] snapshot failed", error);
    return EMPTY_OPS();
  }
}

async function loadOpsSnapshot(): Promise<OpsSnapshot> {
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();

  const [sos, teams, assignments, shelters, hazards, zones, alerts, citizens, stations, settings, hospitals, teamLocations] = await Promise.all([
    supabase
      .from("sos_requests")
      .select(SOS_STAFF_COLUMNS)
      .or(`status.not.in.(resolved,cancelled),created_at.gte.${since}`)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("rescue_teams").select("*").order("call_sign"),
    supabase
      .from("rescue_assignments")
      .select("*")
      .or(`status.not.in.(completed,cancelled),assigned_at.gte.${since}`)
      .order("assigned_at", { ascending: false })
      .limit(300),
    supabase.from("shelters").select("*").order("name"),
    supabase
      .from("hazard_reports")
      .select("*")
      .gte("created_at", new Date(Date.now() - 72 * 3600_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("risk_zones").select("*"),
    supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(50),
    supabase
      .from("profiles")
      .select(CITIZEN_STATUS_COLUMNS)
      .eq("role", "citizen")
      .neq("safety_status", "unknown")
      .order("safety_updated_at", { ascending: false, nullsFirst: false })
      .limit(300),
    supabase.from("hydromet_stations").select("*").order("name"),
    supabase.from("app_settings").select("key, value").in("key", ["data_mode", "hydromet_last_sync"]),
    supabase.from("facilities").select("id, name, latitude, longitude, phone").eq("kind", "hospital").order("name"),
    supabase.from("team_locations").select("*"),
  ]);

  const error =
    sos.error ?? teams.error ?? assignments.error ?? shelters.error ?? hazards.error ?? zones.error ?? alerts.error ?? citizens.error;
  if (error) console.error("[ops] snapshot failed", error.message);

  const dataMode: DataMode = settings.data?.find((r) => r.key === "data_mode")?.value === "simulation" ? "simulation" : "live";
  const sync = settings.data?.find((r) => r.key === "hydromet_last_sync")?.value as OpsSnapshot["hydrometSync"] | undefined;

  return {
    sos: (sos.data as StaffSos[] | null) ?? [],
    teams: teams.data ?? [],
    assignments: assignments.data ?? [],
    shelters: shelters.data ?? [],
    hazards: hazards.data ?? [],
    zones: applyLiveReadings(zones.data ?? [], stations.data ?? [], dataMode),
    alerts: alerts.data ?? [],
    citizens: (citizens.data as CitizenStatus[] | null) ?? [],
    hospitals: (hospitals.data ?? []).map((h) => ({ id: h.id, name: h.name, latitude: h.latitude, longitude: h.longitude, phone: h.phone ?? undefined })),
    stations: stations.data ?? [],
    dataMode,
    hydrometSync: sync ?? null,
    teamLocations: teamLocations.data ?? [],
    fetchedAt: new Date().toISOString(),
    ok: !error,
  };
}
