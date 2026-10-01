"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { syncHydromet } from "@/lib/hydromet/sync";
import { importReferenceData } from "@/lib/services/reference-data";
import { sendAlertPush } from "@/lib/services/push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseShelterCsv } from "@/lib/utilities/shelter-csv";
import { authorize } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { friendlyWorkflowError } from "@/lib/utilities/errors";
import {
  alertSchema,
  assignTeamSchema,
  assignmentStatusSchema,
  firstIssue,
  hazardReviewSchema,
  priorityOverrideSchema,
  roleUpdateSchema,
  shelterOccupancySchema,
  uuidSchema,
  type AlertInput,
} from "@/lib/validation/schemas";
import { ASSIGNMENT_STATUS_LABEL } from "@/lib/utilities/status";
import type { AssignmentStatus, PriorityLevel } from "@/types/domain";

export type OpsResult = { ok: true; message?: string } | { ok: false; error: string };

const DENIED: OpsResult = { ok: false, error: "You do not have permission to do that." };

async function staffClient() {
  const auth = await authorize("dashboard");
  if (!auth.ok) return null;
  return { supabase: await createSupabaseServerClient(), session: auth.session };
}

export async function acknowledgeSos(sosId: string): Promise<OpsResult> {
  const id = uuidSchema.safeParse(sosId);
  if (!id.success) return { ok: false, error: "Unknown incident." };
  const ctx = await staffClient();
  if (!ctx) return DENIED;
  const { error } = await ctx.supabase.rpc("acknowledge_sos", { p_sos_id: id.data });
  if (error) return { ok: false, error: friendlyWorkflowError(error.message) };
  return { ok: true };
}

export async function assignRescueTeam(input: {
  sosId: string;
  teamId: string;
  expectedTeamId: string | null;
  note?: string;
}): Promise<OpsResult> {
  const parsed = assignTeamSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const ctx = await staffClient();
  if (!ctx) return DENIED;
  const { error } = await ctx.supabase.rpc("assign_rescue_team", {
    p_sos_id: parsed.data.sosId,
    p_team_id: parsed.data.teamId,
    p_note: parsed.data.note ?? undefined,
    // null is meaningful here ("no team assigned yet").
    p_expected_team_id: parsed.data.expectedTeamId as string,
  });
  if (error) return { ok: false, error: friendlyWorkflowError(error.message) };
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Rescue team assigned." };
}

export async function overridePriority(input: {
  sosId: string;
  level: PriorityLevel | null;
  note?: string;
}): Promise<OpsResult> {
  const parsed = priorityOverrideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const ctx = await staffClient();
  if (!ctx) return DENIED;
  const { error } = await ctx.supabase.rpc("set_sos_priority_override", {
    p_sos_id: parsed.data.sosId,
    // The RPC accepts null to clear the override.
    p_level: parsed.data.level as PriorityLevel,
    p_note: parsed.data.note ?? undefined,
  });
  if (error) return { ok: false, error: friendlyWorkflowError(error.message) };
  return { ok: true, message: parsed.data.level ? "Priority updated." : "Override cleared." };
}

export async function resolveSos(sosId: string, note?: string): Promise<OpsResult> {
  const id = uuidSchema.safeParse(sosId);
  if (!id.success) return { ok: false, error: "Unknown incident." };
  const ctx = await staffClient();
  if (!ctx) return DENIED;
  const { error } = await ctx.supabase.rpc("resolve_sos", {
    p_sos_id: id.data,
    p_note: (typeof note === "string" && note.trim().slice(0, 300)) || undefined,
  });
  if (error) return { ok: false, error: friendlyWorkflowError(error.message) };
  return { ok: true, message: "Incident marked resolved." };
}

export async function updateShelter(input: {
  shelterId: string;
  currentOccupancy: number;
  foodStatus?: "available" | "limited" | "unavailable";
  waterStatus?: "available" | "limited" | "unavailable";
  medicalAssistance?: boolean;
  isActive?: boolean;
}): Promise<OpsResult> {
  const parsed = shelterOccupancySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const ctx = await staffClient();
  if (!ctx) return DENIED;
  const v = parsed.data;
  const { error } = await ctx.supabase
    .from("shelters")
    .update({
      current_occupancy: v.currentOccupancy,
      ...(v.foodStatus && { food_status: v.foodStatus }),
      ...(v.waterStatus && { water_status: v.waterStatus }),
      ...(v.medicalAssistance !== undefined && { medical_assistance: v.medicalAssistance }),
      ...(v.isActive !== undefined && { is_active: v.isActive }),
    })
    .eq("id", v.shelterId);
  if (error) {
    console.error("[ops] shelter update failed", error.message);
    return {
      ok: false,
      error: error.code === "23514" ? "Occupancy is outside the allowed range for this shelter." : "Could not update the shelter.",
    };
  }
  return { ok: true, message: "Shelter updated." };
}

export async function reviewHazard(input: { reportId: string; status: "open" | "verified" | "resolved" | "rejected" }): Promise<OpsResult> {
  const parsed = hazardReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const ctx = await staffClient();
  if (!ctx) return DENIED;
  const { error } = await ctx.supabase
    .from("hazard_reports")
    .update({ status: parsed.data.status, reviewed_by: ctx.session.userId, reviewed_at: new Date().toISOString() })
    .eq("id", parsed.data.reportId);
  if (error) {
    console.error("[ops] hazard review failed", error.message);
    return { ok: false, error: "Could not update the report." };
  }
  return { ok: true, message: `Report marked ${parsed.data.status}.` };
}

export async function publishAlert(input: AlertInput): Promise<OpsResult> {
  const parsed = alertSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const ctx = await staffClient();
  if (!ctx) return DENIED;
  const v = parsed.data;
  const { data: alert, error } = await ctx.supabase.from("alerts").insert({
    title: v.title,
    description: v.description,
    severity: v.severity,
    district: v.district ?? null,
    municipality: v.municipality ?? null,
    river_basin: v.riverBasin ?? null,
    source: v.source,
    source_type: v.sourceType,
    created_by: ctx.session.userId,
    expires_at: new Date(Date.now() + v.expiresInHours * 3600_000).toISOString(),
  }).select().single();
  if (error || !alert) {
    console.error("[ops] alert insert failed", error?.message);
    return { ok: false, error: "Could not publish the alert." };
  }
  // Lock-screen notification for subscribed devices, after the response.
  after(() => sendAlertPush(alert).then(() => undefined));
  revalidatePath("/dashboard/alerts");
  return { ok: true, message: "Alert published to citizens." };
}

export async function setAlertActive(alertId: string, active: boolean): Promise<OpsResult> {
  const id = uuidSchema.safeParse(alertId);
  if (!id.success) return { ok: false, error: "Unknown alert." };
  const ctx = await staffClient();
  if (!ctx) return DENIED;
  const { error } = await ctx.supabase.from("alerts").update({ is_active: active === true }).eq("id", id.data);
  if (error) return { ok: false, error: "Could not update the alert." };
  revalidatePath("/dashboard/alerts");
  return { ok: true, message: active ? "Alert re-activated." : "Alert withdrawn." };
}

export async function setTeamStatus(teamId: string, status: "available" | "offline"): Promise<OpsResult> {
  const id = uuidSchema.safeParse(teamId);
  if (!id.success || (status !== "available" && status !== "offline")) return { ok: false, error: "Invalid request." };
  const ctx = await staffClient();
  if (!ctx) return DENIED;
  const { data: team } = await ctx.supabase.from("rescue_teams").select("status").eq("id", id.data).maybeSingle();
  if (!team) return { ok: false, error: "Unknown team." };
  if (team.status === "assigned" || team.status === "busy") {
    return { ok: false, error: "This team is on a mission. Resolve or reassign the incident first." };
  }
  const { error } = await ctx.supabase.from("rescue_teams").update({ status }).eq("id", id.data);
  if (error) return { ok: false, error: "Could not update the team." };
  return { ok: true, message: `Team marked ${status}.` };
}

export async function updateUserRole(input: { userId: string; role: string; rescueTeamId: string | null }): Promise<OpsResult> {
  const parsed = roleUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorize("admin");
  if (!auth.ok) return DENIED;
  if (parsed.data.userId === auth.session.userId && parsed.data.role !== "admin") {
    return { ok: false, error: "You cannot remove your own administrator role." };
  }
  if (parsed.data.role === "rescue" && !parsed.data.rescueTeamId) {
    return { ok: false, error: "Choose the rescue team this user belongs to." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      role: parsed.data.role,
      rescue_team_id: parsed.data.role === "rescue" ? parsed.data.rescueTeamId : null,
    })
    .eq("id", parsed.data.userId);
  if (error) {
    console.error("[admin] role update failed", error.message);
    return { ok: false, error: "Could not update the role." };
  }
  revalidatePath("/dashboard/users");
  return { ok: true, message: "Role updated." };
}

/**
 * Records a rescue team's progress on its behalf, for teams that report by
 * radio or phone instead of the rescue console. The database function applies
 * the same transition rules as the console and logs the operator as the actor.
 */
export async function recordTeamUpdate(input: { assignmentId: string; status: AssignmentStatus }): Promise<OpsResult> {
  const parsed = assignmentStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const ctx = await staffClient();
  if (!ctx) return DENIED;
  const label = ASSIGNMENT_STATUS_LABEL[parsed.data.status];
  const { error } = await ctx.supabase.rpc("update_assignment_status", {
    p_assignment_id: parsed.data.assignmentId,
    p_status: parsed.data.status,
    p_note: `${label} — reported by the team (radio/phone), recorded by the control centre`,
  });
  if (error) return { ok: false, error: friendlyWorkflowError(error.message) };
  revalidatePath("/dashboard");
  return { ok: true, message: `Recorded: ${label}` };
}

/**
 * Live DHM data vs the labelled demo scenario. Switching to live refreshes
 * the readings straight away. RLS also restricts this setting to staff.
 */
export async function setDataMode(mode: "live" | "simulation"): Promise<OpsResult> {
  if (mode !== "live" && mode !== "simulation") return { ok: false, error: "Unknown mode." };
  const ctx = await staffClient();
  if (!ctx) return DENIED;
  const { error } = await ctx.supabase
    .from("app_settings")
    .update({ value: mode, updated_by: ctx.session.userId })
    .eq("key", "data_mode");
  if (error) return { ok: false, error: friendlyWorkflowError(error.message) };
  if (mode === "live") after(() => syncHydromet().then(() => undefined));
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: mode === "live" ? "Live DHM data is now driving risk levels." : "Simulation mode on — every screen shows a SIMULATION banner.",
  };
}

/** Fetches the latest DHM gauges and rain stations now. */
export async function runHydrometSync(): Promise<OpsResult> {
  const ctx = await staffClient();
  if (!ctx) return DENIED;
  const s = await syncHydromet();
  revalidatePath("/", "layout");
  return s.ok
    ? { ok: true, message: `Synced ${s.riverStations} river gauges (${s.freshRiver} live) and ${s.rainStations} rain stations (${s.freshRain} live).` }
    : { ok: false, error: `Sync failed: ${s.error ?? "unknown error"}. Previous readings are kept and shown with their age.` };
}

/** Re-imports wards, facilities and candidate shelters (admin only). */
export async function reimportReferenceData(): Promise<OpsResult> {
  const auth = await authorize("admin");
  if (!auth.ok) return DENIED;
  try {
    const summary = await importReferenceData(createSupabaseAdminClient());
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: `Imported ${summary.wards} wards, ${summary.hospitals} hospitals, ${summary.health_facilities} health facilities, ${summary.candidate_shelters_new} new candidate shelters.`,
    };
  } catch (error) {
    return { ok: false, error: `Import failed: ${error instanceof Error ? error.message : "unknown error"}` };
  }
}

/** Confirms a candidate (or closed) shelter with a real capacity, optionally opening it. */
export async function verifyShelter(input: { shelterId: string; capacity: number; open: boolean }): Promise<OpsResult> {
  const id = uuidSchema.safeParse(input.shelterId);
  const capacity = Math.round(Number(input.capacity));
  if (!id.success) return { ok: false, error: "Unknown shelter." };
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 100_000) return { ok: false, error: "Enter a capacity between 1 and 100,000 people." };
  const ctx = await staffClient();
  if (!ctx) return DENIED;
  const { error } = await ctx.supabase
    .from("shelters")
    .update({ capacity, verification: "verified", is_active: Boolean(input.open) })
    .eq("id", id.data);
  if (error) return { ok: false, error: error.code === "23514" ? "Capacity is below the current occupancy." : "Could not update the shelter." };
  return { ok: true, message: input.open ? "Shelter verified and open to citizens." : "Shelter verified (closed)." };
}

/** Removes an unverified candidate that is not suitable as a shelter (admin). */
export async function dismissCandidateShelter(shelterId: string): Promise<OpsResult> {
  const id = uuidSchema.safeParse(shelterId);
  if (!id.success) return { ok: false, error: "Unknown shelter." };
  const auth = await authorize("admin");
  if (!auth.ok) return DENIED;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("shelters").delete().eq("id", id.data).eq("verification", "unverified");
  if (error) return { ok: false, error: "Could not remove the candidate." };
  return { ok: true, message: "Candidate removed." };
}

/**
 * Imports an official shelter list (CSV with a header row):
 *   name,latitude,longitude,capacity[,ward,municipality,address,phone]
 * Rows become verified, open shelters; re-importing updates them by name.
 */
export async function importShelterCsv(csv: string): Promise<OpsResult> {
  const auth = await authorize("admin");
  if (!auth.ok) return DENIED;
  const parsed = parseShelterCsv(csv);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("shelters").upsert(parsed.rows, { onConflict: "source_ref" });
  if (error) return { ok: false, error: `Import failed: ${error.message}` };
  return { ok: true, message: `Imported ${parsed.rows.length} official shelters (verified and open).` };
}

export type TeamInput = {
  id?: string;
  callSign: string;
  name: string;
  personnelCount: number;
  equipment: string;
  contactPhone?: string;
  baseLocation?: string;
  latitude: number;
  longitude: number;
  district?: string;
};

/** Adds or edits a real rescue team (admin). */
export async function saveTeam(input: TeamInput): Promise<OpsResult> {
  const auth = await authorize("admin");
  if (!auth.ok) return DENIED;
  // An edit with a malformed id must not silently create a second team.
  const id = input.id ? uuidSchema.safeParse(input.id) : null;
  if (id && !id.success) return { ok: false, error: "Unknown team." };
  const callSign = String(input.callSign ?? "").trim().toUpperCase().slice(0, 20);
  const name = String(input.name ?? "").trim().slice(0, 120);
  const personnel = Math.round(Number(input.personnelCount));
  const lat = Number(input.latitude);
  const lng = Number(input.longitude);
  if (!/^[A-Z0-9-]{2,20}$/.test(callSign)) return { ok: false, error: "Call sign: 2–20 letters, digits or dashes (e.g. R-08)." };
  if (name.length < 3) return { ok: false, error: "Enter the team's name." };
  if (!Number.isFinite(personnel) || personnel < 1 || personnel > 500) return { ok: false, error: "Personnel must be between 1 and 500." };
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { ok: false, error: "Enter the base location's coordinates." };
  const row = {
    call_sign: callSign,
    name,
    personnel_count: personnel,
    equipment: String(input.equipment ?? "").split(",").map((e) => e.trim()).filter(Boolean).slice(0, 20),
    contact_phone: input.contactPhone?.trim() || null,
    base_location: input.baseLocation?.trim() || null,
    latitude: lat,
    longitude: lng,
    district: input.district?.trim() || "Chitwan",
    is_demo: false,
    data_source: "Entered by administrator",
  };
  const supabase = await createSupabaseServerClient();
  const { error } = id?.success
    ? await supabase.from("rescue_teams").update(row).eq("id", id.data)
    : await supabase.from("rescue_teams").insert({ ...row, status: "offline" });
  if (error) return { ok: false, error: error.code === "23505" ? `Call sign ${callSign} is already used.` : "Could not save the team." };
  return { ok: true, message: id?.success ? `Team ${callSign} updated.` : `Team ${callSign} added (offline until marked available).` };
}

/** Removes a team (admin). Teams with mission history must be kept. */
export async function deleteTeam(teamId: string): Promise<OpsResult> {
  const id = uuidSchema.safeParse(teamId);
  if (!id.success) return { ok: false, error: "Unknown team." };
  const auth = await authorize("admin");
  if (!auth.ok) return DENIED;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("rescue_teams").delete().eq("id", id.data);
  if (error) {
    return {
      ok: false,
      error: error.code === "23503" ? "This team has mission history, so it can't be deleted. Mark it offline instead." : "Could not remove the team.",
    };
  }
  return { ok: true, message: "Team removed." };
}
