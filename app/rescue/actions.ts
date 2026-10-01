"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { friendlyWorkflowError } from "@/lib/utilities/errors";
import { assignmentStatusSchema, firstIssue } from "@/lib/validation/schemas";
import type { AssignmentStatus } from "@/types/domain";

export type RescueResult = { ok: true } | { ok: false; error: string };

export async function updateMissionStatus(input: {
  assignmentId: string;
  status: AssignmentStatus;
  note?: string;
}): Promise<RescueResult> {
  const parsed = assignmentStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const auth = await authorize("rescue");
  if (!auth.ok) return { ok: false, error: "You do not have permission to do that." };

  const supabase = await createSupabaseServerClient();
  // The database function re-checks team membership and the transition.
  const { error } = await supabase.rpc("update_assignment_status", {
    p_assignment_id: parsed.data.assignmentId,
    p_status: parsed.data.status,
    p_note: parsed.data.note ?? undefined,
  });
  if (error) return { ok: false, error: friendlyWorkflowError(error.message) };
  revalidatePath("/rescue");
  return { ok: true };
}

export async function setAvailability(available: boolean): Promise<RescueResult> {
  const auth = await authorize("rescue");
  if (!auth.ok) return { ok: false, error: "You do not have permission to do that." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_own_team_availability", { p_available: Boolean(available) });
  if (error) return { ok: false, error: friendlyWorkflowError(error.message) };
  revalidatePath("/rescue");
  return { ok: true };
}

/**
 * Shares the team's live GPS position while on a mission. Only the team's own
 * members can write it (RLS), and it is visible only to staff, the team and
 * the citizen whose SOS the team is assigned to.
 */
export async function shareTeamLocation(input: {
  latitude: number;
  longitude: number;
  accuracyM?: number | null;
  headingDeg?: number | null;
  speedMps?: number | null;
}): Promise<RescueResult> {
  const lat = Number(input.latitude);
  const lng = Number(input.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { ok: false, error: "Invalid position." };
  }
  const auth = await authorize("rescue");
  if (!auth.ok) return { ok: false, error: "You do not have permission to do that." };
  const teamId = auth.session.profile?.rescue_team_id;
  if (!teamId) return { ok: false, error: "Your account is not linked to a rescue team." };
  const clamp = (v: number | null | undefined, min: number, max: number) =>
    v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.min(max, Math.max(min, Number(v)));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("team_locations").upsert({
    team_id: teamId,
    latitude: lat,
    longitude: lng,
    accuracy_m: clamp(input.accuracyM, 0, 100_000) === null ? null : Math.round(clamp(input.accuracyM, 0, 100_000)!),
    heading_deg: clamp(input.headingDeg, 0, 359) === null ? null : Math.round(clamp(input.headingDeg, 0, 359)!),
    speed_mps: clamp(input.speedMps, 0, 9999),
    updated_by: auth.session.userId,
  });
  if (error) return { ok: false, error: "Could not share the team position." };
  return { ok: true };
}
