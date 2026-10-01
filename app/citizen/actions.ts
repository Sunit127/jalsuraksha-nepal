"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { haversineMeters } from "@/lib/utilities/geo";
import {
  firstIssue,
  hazardReportSchema,
  profileSchema,
  safetyStatusSchema,
  uuidSchema,
  type HazardReportInput,
  type ProfileInput,
} from "@/lib/validation/schemas";
import type { SafetyStatus } from "@/types/domain";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

const SIGN_IN_REQUIRED = "Please sign in with your phone number to do this.";

/** Duplicate grouping: same hazard type within this radius in the last 12 h. */
const DUPLICATE_RADIUS_M = 150;
const DUPLICATE_WINDOW_H = 12;

async function requireCitizen() {
  const session = await getSessionContext();
  if (!session.userId || session.isAnonymous) return null;
  return { ...session, userId: session.userId };
}

export async function confirmHazard(reportId: string): Promise<ActionResult> {
  const id = uuidSchema.safeParse(reportId);
  if (!id.success) return { ok: false, error: "Unknown report." };
  const session = await requireCitizen();
  if (!session) return { ok: false, error: SIGN_IN_REQUIRED };

  const supabase = await createSupabaseServerClient();
  const { data: report } = await supabase
    .from("hazard_reports")
    .select("id, reporter_id, duplicate_of")
    .eq("id", id.data)
    .maybeSingle();
  if (!report) return { ok: false, error: "This report no longer exists." };
  if (report.reporter_id === session.userId) {
    return { ok: false, error: "You reported this hazard, so you cannot confirm it yourself." };
  }

  // Confirmations of a grouped duplicate count towards the primary report.
  const targetId = report.duplicate_of ?? report.id;
  const { error } = await supabase
    .from("hazard_confirmations")
    .insert({ report_id: targetId, user_id: session.userId });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "You have already confirmed this hazard." };
    console.error("[hazard] confirm failed", error.message);
    return { ok: false, error: "Could not save your confirmation. Please try again." };
  }
  return { ok: true, message: "Thank you — your confirmation helps responders." };
}

export async function submitHazardReport(
  input: HazardReportInput,
): Promise<ActionResult<{ id: string; groupedWith: string | null }>> {
  const session = await requireCitizen();
  if (!session) return { ok: false, error: SIGN_IN_REQUIRED };

  const parsed = hazardReportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const v = parsed.data;

  const supabase = await createSupabaseServerClient();

  // Basic duplicate detection: an open/verified primary report of the same
  // type close by. The new report is kept but grouped under it.
  const since = new Date(Date.now() - DUPLICATE_WINDOW_H * 3600_000).toISOString();
  const { data: candidates } = await supabase
    .from("hazard_reports")
    .select("id, reporter_id, latitude, longitude, created_at")
    .eq("type", v.type)
    .in("status", ["open", "verified"])
    .is("duplicate_of", null)
    .gte("created_at", since)
    .gte("latitude", v.latitude - 0.01)
    .lte("latitude", v.latitude + 0.01)
    .gte("longitude", v.longitude - 0.01)
    .lte("longitude", v.longitude + 0.01);

  const primary = (candidates ?? [])
    .map((c) => ({ ...c, d: haversineMeters({ lat: v.latitude, lng: v.longitude }, { lat: c.latitude, lng: c.longitude }) }))
    .filter((c) => c.d <= DUPLICATE_RADIUS_M)
    .sort((a, b) => a.d - b.d)[0];

  const { data, error } = await supabase
    .from("hazard_reports")
    .insert({
      reporter_id: session.userId,
      type: v.type,
      severity: v.severity,
      latitude: v.latitude,
      longitude: v.longitude,
      location_name: v.locationName ?? null,
      description: v.description ?? null,
      photo_url: v.photoUrl ?? null,
      duplicate_of: primary?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[hazard] insert failed", error?.message);
    return { ok: false, error: "Could not submit your report. Please try again." };
  }

  // A nearby duplicate from someone else also counts as a confirmation of the
  // original report (re-reporting your own hazard does not).
  const ownPrimary = primary?.reporter_id === session.userId;
  if (primary && !ownPrimary) {
    await supabase.from("hazard_confirmations").insert({ report_id: primary.id, user_id: session.userId });
  }

  revalidatePath("/citizen");
  return {
    ok: true,
    data: { id: data.id, groupedWith: primary?.id ?? null },
    message: ownPrimary
      ? "You already reported this hazard nearby — this report has been grouped with it."
      : primary
        ? "Similar report found nearby — yours has been grouped with it and counted as a confirmation."
        : "Hazard reported. Thank you for keeping your community safe.",
  };
}

export async function setSafetyStatus(status: SafetyStatus): Promise<ActionResult> {
  const parsed = safetyStatusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: "Unknown status." };
  const session = await requireCitizen();
  if (!session) return { ok: false, error: SIGN_IN_REQUIRED };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ safety_status: parsed.data, safety_updated_at: new Date().toISOString() })
    .eq("id", session.userId);
  if (error) {
    console.error("[profile] safety status failed", error.message);
    return { ok: false, error: "Could not update your status. Please try again." };
  }
  revalidatePath("/citizen", "layout");
  return { ok: true };
}

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const session = await requireCitizen();
  if (!session) return { ok: false, error: SIGN_IN_REQUIRED };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      district: parsed.data.district ?? null,
      municipality: parsed.data.municipality ?? null,
      ward: parsed.data.ward ?? null,
      emergency_contact: parsed.data.emergencyContact ?? null,
    })
    .eq("id", session.userId);
  if (error) {
    console.error("[profile] update failed", error.message);
    return { ok: false, error: "Could not save your profile. Please try again." };
  }
  revalidatePath("/citizen", "layout");
  return { ok: true, message: "Profile saved." };
}
